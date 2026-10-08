import { useEffect, useRef, useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { isCurrentAuthSession, type AuthSessionId } from '../../../utils/authStorage';

export type Capability = 'GUARDIAN_REVIEWER' | 'PRIVACY_REVIEWER';
export type Category = 'CASE_NOTES' | 'SESSION_CONTACTS' | 'EVIDENCE' | 'DURABLE_RECORD';
export type Reviewer = { userId:number; name:string; capability:Capability; active:boolean; version:number; policyReference:string };
export type GuardianStatus = { playerId:number; status:'NONE'|'REVIEW'|'RESOLVED'; version:number; updatedAt:string|null; outcome:string|null };
export type GuardianItem = { playerId:number; version:number; reportedAt:string };
export type GuardianDetail = { status:GuardianStatus; reason:string; currentGuardianIds:number[]; decisions:{id:number;reportVersion:number;outcome:string;basis:string;evidenceReference:string;reviewerId:number;createdAt:string}[] };
export type PrivacyItem = { id:number; caseId:number; kind:string; country:string; status:string; version:number; message:string; response:string|null; createdAt:string; targetAt:string };
export type RetentionItem = { caseId:number; playerId:number; stage:string; updatedAt:string; nextReview:string|null };
export type RetentionPreview = { caseId:number; caseVersion:number; review:{ category:Category; version:number; country:string|null; purpose:string|null; policyReference:string|null; hold:boolean; nextReview:string|null; minimizedAt:string|null }; copies:Record<string,number>; blockers:string[]; previewHash:string };
export const countries = ['GE','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'] as const;
const config = (session:AuthSessionId, signal?:AbortSignal):AuthSessionRequestConfig => ({_authSessionId:session,signal});
export const governanceGet = <T,>(path:string,session:AuthSessionId,signal?:AbortSignal) => apiClient.get<T>(path,config(session,signal)).then(r=>r.data);

// Private reports and evidence references stay in memory, never in browser storage.
// An uncertain response retains the exact body/UUID so retry cannot duplicate a decision.
export function useGovernanceWrite<T>(onSaved:(result:T)=>void) {
    const {sessionId}=useAuth();
    const [busy,setBusy]=useState(false), [error,setError]=useState(''), [pending,setPending]=useState(false);
    const request=useRef<{path:string;body:Record<string,unknown>}|null>(null);
    const controller=useRef<AbortController|null>(null);
    const mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();request.current=null;};},[sessionId]);
    async function send() {
        if(controller.current || !request.current) return;
        const abort=new AbortController(); controller.current=abort;
        setBusy(true);setError('');setPending(true);
        const current=()=>mounted.current&&!abort.signal.aborted&&isCurrentAuthSession(sessionId);
        try {
            const result=await apiClient.post<T>(request.current.path,request.current.body,config(sessionId,abort.signal));
            if(current()){request.current=null;setPending(false);onSaved(result.data);}
        } catch(e) {
            if(current()) {
                setError(extractApiErrorMessage(e,'Could not confirm the response. Retry this same request.'));
                const status=(e as {response?:{status?:number}})?.response?.status;
                if(status && status>=400 && status<500 && status!==408 && status!==429){request.current=null;setPending(false);}
            }
        } finally {if(current())setBusy(false);if(controller.current===abort)controller.current=null;}
    }
    return {busy,error,pending,retry:send,submit:(path:string,body:Record<string,unknown>)=>{
        if(request.current || controller.current) return;
        request.current={path,body:{...body,requestId:crypto.randomUUID()}};void send();
    }};
}
