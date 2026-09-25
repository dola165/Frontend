import { apiClient } from '../../api/axiosConfig';
export interface EnrollmentRequest { id:number; squad_id:number; child_name:string; date_of_birth?:string; guardian_name?:string; guardian_email?:string; existing_card_id?:number|null; status:'PENDING'|'APPROVED'|'DECLINED'|'WITHDRAWN'; decision_note:string|null; squad_name?:string; club_name?:string }
export interface Invitation { id:number; expires_at:string; revoked_at:string|null; max_uses:number; used_count:number }
export interface EnrollmentManage { invitations:Invitation[]; requests:EnrollmentRequest[]; unlinkedCards:{id:number;full_name:string;birth_year:number;parent_email:string|null}[] }
export interface ResolvedInvitation { squadId:number; squadName:string; clubName:string; expiresAt:string; children:{id:number;full_name:string;date_of_birth:string}[] }
const root='/squad-enrollment';
export const enrollmentMine=async(signal?:AbortSignal)=>(await apiClient.get<EnrollmentRequest[]>(`${root}/mine`,{signal})).data;
export const resolveInvitation=async(token:string,signal?:AbortSignal)=>(await apiClient.post<ResolvedInvitation>(`${root}/resolve`,{token},{signal})).data;
export const requestEnrollment=async(data:{requestId:string;token:string;existingCardId:number|null;childName:string;dateOfBirth:string;consent:boolean})=>(await apiClient.post<{id:number;status:string;squadId:number}>(`${root}/requests`,data)).data;
export const withdrawEnrollment=async(id:number)=>apiClient.post(`${root}/requests/${id}/withdraw`);
export const manageEnrollment=async(squad:number,signal?:AbortSignal)=>(await apiClient.get<EnrollmentManage>(`${root}/squads/${squad}`,{signal})).data;
export const createInvitation=async(squad:number,days:number,maxUses:number)=>(await apiClient.post<Invitation&{token:string}>(`${root}/squads/${squad}/invitations`,{days,maxUses})).data;
export const revokeInvitation=async(squad:number,id:number)=>apiClient.delete(`${root}/squads/${squad}/invitations/${id}`);
export const decideEnrollment=async(squad:number,id:number,approve:boolean,matchCardId:number|null,note:string)=>apiClient.post(`${root}/squads/${squad}/requests/${id}/decision`,{approve,matchCardId,note});
