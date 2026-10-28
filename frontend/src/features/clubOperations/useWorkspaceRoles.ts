import { useCallback, useEffect, useState } from 'react';
import { get, type Appointment, type Choice } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
export interface StaffRole {family?:string;key:string;title:string;description:string;permissions:string[]}
/** `onSquads`: the view's job puts the person on its squads, so they're in My squads there (step 3, 29 October 2026). */
export interface RoleView {id:string;label:string;modules:string[];squadIds:number[];clubWide:boolean;appointmentId:number|null;revision:number|null;onSquads?:boolean}
export interface RoleRequest {id:number;user_id:number;name:string;role_key:string;squad_name:string|null;squad_id?:number|null;squad_ids?:number[];squad_names?:string[];effective_status?:string;unavailable_reason?:string|null;replace_appointment_id:number|null;permissions:string[];note:string|null;review_note:string|null;status:string;revision:number}
/** `season` and each squad's `section` (first team, academy, girls…) are backend fields to add; the sandbox fakes them. */
export interface RolesWorkspace {leadership:boolean;actorId:number;headCoachSquads?:number[];catalog:StaffRole[];views:RoleView[];current:RoleView;season?:string|null;requestSquads:Choice[];squads:(Choice&{player_count:number;section?:string|null})[];people:(Choice&{squad_id:number;squad_name:string})[];sessions:{id:number;title:string;starts_at:string;squad_id:number;squad_name:string}[];requests:RoleRequest[];invitations:Appointment[]}
export const rolesRoot=(club:number)=>`/clubs/${club}/workspace-roles`;

export function useWorkspaceRoles(club:number, view:string|null, actorId:number|null=null) {
 const [revision, setRevision] = useState(0);
 const [result, setResult] = useState<{key:string;scope:string;data:RolesWorkspace|null;error:string}|null>(null);
 const scope = `${club}:${view ?? ''}:${actorId ?? ''}`, key = `${scope}:${revision}`;
 useEffect(() => {
  const controller = new AbortController();
  void get<RolesWorkspace>(`${rolesRoot(club)}${view ? `?view=${encodeURIComponent(view)}` : ''}`, controller.signal)
   .then(data => {
    if (!data?.current || !Array.isArray(data.views)) throw new Error('Could not load your workspace roles.');
    if (!controller.signal.aborted) setResult({key, scope, data, error:''});
   })
   .catch(error => {
    if (controller.signal.aborted) return;
    const status = (error as {response?:{status?:number}}).response?.status;
    // Keep the last confirmed view through a transient refresh. A changed account,
    // club or view never inherits it; an authoritative access refusal clears it.
    setResult(previous => ({
     key, scope, data: previous?.scope === scope && ![401,403,404].includes(status ?? 0) ? previous.data : null,
     error: extractApiErrorMessage(error, 'Could not load your workspace roles.'),
    }));
   });
  return () => controller.abort();
 }, [club, view, scope, key]);
 const refresh = useCallback(() => setRevision(value => value + 1), []);
 return {data:result?.scope === scope ? result.data : null, loading:result?.key !== key, error:result?.key === key ? result.error : '', refresh};
}

