import { useCallback, useEffect, useState } from 'react';
import { get, type Appointment, type Choice, type Bootstrap } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
export interface StaffRole {family?:string;key:string;title:string;description:string;permissions:string[]}
export interface RoleView {id:string;label:string;modules:string[];squadIds:number[];clubWide:boolean;appointmentId:number|null;revision:number|null}
export interface RoleRequest {id:number;user_id:number;name:string;role_key:string;squad_name:string|null;squad_id?:number|null;squad_ids?:number[];squad_names?:string[];effective_status?:string;unavailable_reason?:string|null;replace_appointment_id:number|null;permissions:string[];note:string|null;review_note:string|null;status:string;revision:number}
export interface RolesWorkspace {leadership:boolean;actorId:number;catalog:StaffRole[];views:RoleView[];current:RoleView;requestSquads:Choice[];squads:(Choice&{player_count:number})[];people:(Choice&{squad_id:number;squad_name:string})[];sessions:{id:number;title:string;starts_at:string;squad_id:number;squad_name:string}[];requests:RoleRequest[];invitations:Appointment[]}
export const rolesRoot=(club:number)=>`/clubs/${club}/workspace-roles`;
export function savedRole(club:number,user:number|null) {try{return user?localStorage.getItem(`gk-workspace-role:${club}:${user}`):null;}catch{return null;}}
export function rememberRole(club:number,user:number|null,role:string) {try{if(user)localStorage.setItem(`gk-workspace-role:${club}:${user}`,role);}catch{/* Preference storage is optional; server access remains authoritative. */}}
export function useWorkspaceRoles(club:number,view:string|null) {
 const [revision,setRevision]=useState(0),[result,setResult]=useState<{key:string;data:RolesWorkspace|null;error:string}|null>(null);
 const key=`${club}:${view??''}:${revision}`;
 useEffect(()=>{const c=new AbortController();void get<RolesWorkspace>(`${rolesRoot(club)}${view?`?view=${encodeURIComponent(view)}`:''}`,c.signal).then(data=>{if(!data?.current||!Array.isArray(data.views))throw new Error('Could not load your workspace roles.');if(!c.signal.aborted)setResult({key,data,error:''});}).catch(e=>{if(!c.signal.aborted)setResult({key,data:null,error:extractApiErrorMessage(e,'Could not load your workspace roles.')});});return()=>c.abort();},[club,view,key]);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 return {data:result?.key===key?result.data:null,loading:result?.key!==key,error:result?.key===key?result.error:'',refresh};
}
export function focusedBootstrap(boot:Bootstrap,data:RolesWorkspace):Bootstrap {
 const view=data.current;
 if(view.id==='club')return boot;
 return {...boot,defaultSquadId:!view.clubWide&&view.squadIds.length===1?view.squadIds[0]:undefined,
  squads:boot.squads.filter(s=>view.squadIds.includes(s.id)),people:data.people.filter((p,i,all)=>all.findIndex(x=>x.id===p.id)===i),
  guardians:boot.guardians.filter(g=>data.people.some(p=>p.id===g.child_id)),
  modules:boot.modules.filter(m=>view.modules.includes(m.id)).map(m=>({...m,globalWrite:m.globalWrite&&view.clubWide,writeSquads:m.writeSquads.filter(id=>view.squadIds.includes(id))})),
  links:boot.links.filter(l=>view.modules.includes(l.module)&&(view.clubWide||l.squad_id!==null&&view.squadIds.includes(l.squad_id))),
  sessions:boot.sessions.filter(s=>data.sessions.some(v=>v.id===s.id)),
 };
}
