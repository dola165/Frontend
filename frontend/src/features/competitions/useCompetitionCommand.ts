import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useAuth } from '../../context/AuthContext';
import { readIntent,writeIntent,type CommandIntent } from './commandRecovery';

/** Keep the submitted revision and UUID after an uncertain acknowledgement. */
export function useCompetitionCommand() {
  const {user,sessionId}=useAuth();
  const storageKey=`competition-command:${user?.id}:${sessionId}:${window.location.pathname}`;
  const [feedback,setFeedback]=useState({scope:storageKey,busy:false,error:'',notice:''});
  const pending=useRef(new Map<string,CommandIntent>()),running=useRef<{scope:string}|undefined>(undefined),alive=useRef(true),currentScope=useRef(storageKey);
  currentScope.current=storageKey;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function run<T>(path:string,body:Record<string,unknown>,revision:number,submit:(body:Record<string,unknown>)=>Promise<T>,saved:(value:T)=>Promise<void>,reload:()=>void){
    if(running.current?.scope===storageKey)return;
    const journal=`${storageKey}:${path}`;
    const key=JSON.stringify({scope:storageKey,path,body});
    let intent=pending.current.get(journal)??readIntent(journal);
    if(intent&&intent.key!==key){setFeedback({scope:storageKey,busy:false,error:'An earlier submission still needs confirmation. Recover it before changing this action.',notice:''});return;}
    if(intent?.key!==key)intent={key,requestId:crypto.randomUUID(),revision};
    pending.current.set(journal,intent);writeIntent(journal,intent);
    const flight={scope:storageKey};running.current=flight;setFeedback({scope:storageKey,busy:true,error:'',notice:''});
    const clear=()=>{if(pending.current.get(journal)===intent)pending.current.delete(journal);writeIntent(journal,undefined);};
    try{const value=await submit({...body,requestId:intent.requestId,revision:intent.revision});clear();if(alive.current&&currentScope.current===storageKey){try{await saved(value);if(alive.current&&currentScope.current===storageKey)setFeedback({scope:storageKey,busy:false,error:'',notice:'Saved. The competition is up to date.'});}catch(cause){if(alive.current&&currentScope.current===storageKey){setFeedback({scope:storageKey,busy:false,error:extractApiErrorMessage(cause,'The action was saved, but the refreshed view could not load. Reload to see it.'),notice:'Saved.'});reload();}}}}
    catch(cause){
      // A received rejection did not commit. Network failures retain identity so
      // a retry discovers the original commit instead of repeating the action.
      if(isAxiosError(cause)&&cause.response&&cause.response.status<500)clear();
      if(alive.current&&currentScope.current===storageKey){
      setFeedback({scope:storageKey,busy:false,error:extractApiErrorMessage(cause,'The outcome could not be confirmed. Retry the same action to check it safely.'),notice:''});reload();
    }}finally{if(running.current===flight)running.current=undefined;}
  }
  return {busy:feedback.scope===storageKey&&feedback.busy,error:feedback.scope===storageKey?feedback.error:'',notice:feedback.scope===storageKey?feedback.notice:'',run};
}
