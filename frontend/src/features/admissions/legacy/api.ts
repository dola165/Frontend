import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { AuthSessionId } from '../../../utils/authStorage';
export interface LegacyTask {
 kind:'APPLICATION'|'INVITATION'|'AFFILIATION';sourceId:number;playerId:number;playerName:string;
 organizationId:number;organizationName:string;clubId:number;sourceStatus:string;version:number;
 state:'REVIEW'|'LINKED'|'EXISTING_PARTICIPATION';caseId:number|null;destination:string|null;
 canRespond:boolean;canReconcile:boolean;nextOwner:string;nextAction:string;reason:string|null;
 groups:{id:number;version:number;name:string}[];
}
export interface LegacyReconcile {requestId:string;expectedVersion:number;sourceStatus:string;groupId:number;groupVersion:number;reason:string}
const config=(sessionId:AuthSessionId,signal?:AbortSignal):AuthSessionRequestConfig=>({_authSessionId:sessionId,signal});
export const fetchLegacyTasks=(sessionId:AuthSessionId,organizationId?:number,playerId?:number,signal?:AbortSignal)=>apiClient.get<LegacyTask[]>(organizationId?`/organizations/${organizationId}/admissions/legacy`:'/admissions/legacy',{...config(sessionId,signal),params:{playerId}}).then(r=>r.data);
export const reconcileLegacy=(task:LegacyTask,body:LegacyReconcile,sessionId:AuthSessionId)=>apiClient.post<LegacyTask>(`/admissions/legacy/${task.kind}/${task.sourceId}/reconcile`,body,config(sessionId)).then(r=>r.data);
export const respondLegacyInvitation=(id:number,accept:boolean,sessionId:AuthSessionId)=>apiClient.post(`/club-memberships/invites/${id}/${accept?'accept':'decline'}`,undefined,config(sessionId));
