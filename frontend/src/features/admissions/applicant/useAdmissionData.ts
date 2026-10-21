import { useEffect, useState } from 'react';
import { isCurrentAuthSession, type AuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';

export function useAdmissionData<T>(fetcher: (signal: AbortSignal) => Promise<T>, sessionId?: AuthSessionId) {
    const [revision,setRevision]=useState(0);
    const [result,setResult]=useState<{fetcher:typeof fetcher;sessionId?:AuthSessionId;revision:number;data:T|null;error:string}|null>(null);
    const sameScope=result?.fetcher===fetcher&&result.sessionId===sessionId;
    const data=sameScope?result.data:null;
    const loading=!sameScope||result.revision!==revision;
    const error=loading?'':result.error;
    useEffect(()=>{
        const controller=new AbortController();
        const current=()=>!controller.signal.aborted&&(sessionId===undefined||isCurrentAuthSession(sessionId));
        void fetcher(controller.signal).then(data=>{if(current())setResult({fetcher,sessionId,revision,data,error:''});})
            .catch(e=>{if(current())setResult(previous=>({fetcher,sessionId,revision,data:previous?.fetcher===fetcher&&previous.sessionId===sessionId?previous.data:null,error:extractApiErrorMessage(e,'Could not load this information.')}));});
        return ()=>controller.abort();
    },[fetcher,sessionId,revision]);
    return {data,loading,error,setData:(data:T|null)=>setResult({fetcher,sessionId,revision,data,error:''}),refresh:()=>setRevision(v=>v+1)};
}
