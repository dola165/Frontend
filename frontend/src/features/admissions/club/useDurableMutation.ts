import { useRef, useState } from 'react';
import { newAdmissionRequestId } from '../api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useClubAdmissionCopy } from './copy';
import { assertCurrentAuthSession, isCurrentAuthSession, type AuthSessionId } from '../../../utils/authStorage';

export interface DurableBody { requestId: string; expectedVersion?: number }
interface Pending { body: DurableBody; signature: string }
const signature = (body: object) => JSON.stringify(Object.fromEntries(Object.entries(body).filter(([key]) => !['requestId','expectedVersion'].includes(key))));
export function readPending(key: string): Pending | null {
  try { const value=JSON.parse(sessionStorage.getItem(key)??'null');return value && typeof value.body?.requestId==='string' && typeof value.signature==='string' ? value : null; } catch { return null; }
}

/** Keep the exact command across a lost response. A definitive rejection allows a new reviewed command. */
export function useDurableMutation(scope: string, sessionId?: AuthSessionId) {
  const {c}=useClubAdmissionCopy();
  const key=`gk-admission-staff:${scope}`;
  const lock=useRef(false), [busy,setBusy]=useState(false), [error,setError]=useState(''), [pending,setPending]=useState(()=>readPending(key));
  const clear=() => { sessionStorage.removeItem(key);setPending(null); };
  const errorMessage=(e:unknown) => {
    const response=(e as {response?:{status?:number;data?:{code?:string}}}).response;
    const code=response?.data?.code;
    if(response?.status===403)return c('revoked');
    if(code==='STALE_VERSION')return c('stale');
    if(code==='CAPACITY_FULL')return c('full');
    if(code==='DEADLINE_PASSED')return c('expired');
    if(code==='TERMS_INCOMPLETE')return c('termsMissing');
    if(code==='GUARDIAN_REQUIRED'||code==='GUARDIAN_REVIEW')return c('guardianBlocked');
    if(!response || (response.status??500)>=500)return c('uncertain');
    return extractApiErrorMessage(e,c('error'));
  };
  async function send<T,B extends DurableBody>(draft: Omit<B,'requestId'>, operation:(body:B)=>Promise<T>):Promise<T | null> {
    if(lock.current)return null;
    lock.current=true;setBusy(true);setError('');
    try {
      if(sessionId!==undefined)assertCurrentAuthSession(sessionId);
      const previous=readPending(key), nextSignature=signature(draft);
      if(previous && previous.signature!==nextSignature) { setError(c('uncertain'));setPending(previous);return null; }
      const record=previous??{body:{...draft,requestId:newAdmissionRequestId()} as B,signature:nextSignature};
      sessionStorage.setItem(key,JSON.stringify(record));setPending(record);
      const result=await operation(record.body as B);
      if(sessionId!==undefined)assertCurrentAuthSession(sessionId);
      clear();return result;
    } catch(e) {
      if(sessionId!==undefined&&!isCurrentAuthSession(sessionId)){setPending(null);setError(c('revoked'));return null;}
      const status=(e as {response?:{status?:number}}).response?.status;
      if(status && status>=400 && status<500)clear();
      setError(errorMessage(e));return null;
    } finally { lock.current=false;setBusy(false); }
  }
  async function recover<T,B extends DurableBody>(operation:(body:B)=>Promise<T>):Promise<T | null> {
    const previous=readPending(key);if(!previous)return null;
    return send<T,B>(previous.body as B,operation);
  }
  return {busy,error,pending,send,recover,setError};
}
