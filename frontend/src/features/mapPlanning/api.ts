import { apiClient } from '../../api/axiosConfig';
import type { OperationRecord } from '../clubOperations/api';

export interface PlanPlace { key:string;name:string;address:string;latitude:number;longitude:number;type:'MANUAL'|'CLUB'|'STADIUM'|'MATCH'|'TOURNAMENT'|'TRYOUT';entityId?:number|null;notes:string;photoUrl?:string|null }
export interface PlanActivity { key:string;title:string;kind:'MATCH'|'TRAINING'|'TRAVEL'|'STAY'|'MEAL'|'ACTIVITY';startsAt:string;endsAt:string;placeKey?:string|null;eventId?:number|null;sessionId?:number|null;notes:string }
export interface PlanArrangement { key:string;kind:'TRANSPORT'|'ACCOMMODATION'|'MEALS'|'VENUE'|'OTHER';title:string;placeKey?:string|null;amountMinor:number;notes:string;financeRecordId?:number|null }
export interface PlanDraft { title:string;timezone:string;currency:string;budgetMinor:number;startsAt:string;endsAt:string;destination:string;meetingPoint:string;collectionPoint:string;supervisionContact:string;familyMessage:string;privateNotes:string;participants:number[];places:PlanPlace[];activities:PlanActivity[];arrangements:PlanArrangement[] }
export interface PlanContext { financeRecords?:{id:number;title:string;squad_id:number;kind:string;status:string}[];id:number;name:string;settings:{currency?:string;timezone?:string};squads:{id:number;name:string;canEdit:boolean}[];participants:{id:number;name:string;squad_id:number}[];events:{id:number;title:string;starts_at:string;ends_at:string;challenger_squad_id:number;target_squad_id:number;location_name?:string;location_lat?:number|null;location_lng?:number|null}[];sessions:{id:number;title:string;starts_at:string;ends_at:string;squad_id:number}[] }
export interface PlanSummary { id:number;club_id:number;squad_id:number;title:string;revision:number;published_version:number;published_revision:number|null;updated_at:string;starts_at:string }
export interface SupplierEvidence { status:'PENDING'|'CONFIRMED'|'DECLINED'|'REVIEW_REQUIRED';source:string;evidence:string;fingerprint:string;actor:number;at:string }
export interface Plan extends PlanSummary { journeyResponses?:{subject_id:number;name:string;response:string;actor_id:number;updated_at:string}[]; playerResponses?:{actor_id:number;name:string;status:string;created_at:string}[]; created_by:number;draft:PlanDraft;suppliers:Record<string,SupplierEvidence>;totalMinor:number;budgetApproved:boolean;approvedBy:number|null;rights:{edit:boolean;travel:boolean;finance:boolean;publish:boolean;leadership:boolean};issues:{severity:'BLOCKING'|'WARNING';code:string;message:string}[];history:{id:number;revision:number;action:string;note:string;created_at:string;actor:string}[];familyResponses:{child_id:number;child_name:string;version:number;acknowledged_at:string|null;permission_status:string}[];trip_id:number|null;trip:OperationRecord|null;passengers:{id:number;subject_user_id:number;status:string;revision:number;updated_at:string;name:string}[];linkedSchedule:{key:string;current:Record<string,string>|null}[];published?:FamilyItinerary }
export interface FamilyLocation { name:string;address:string;latitude:number;longitude:number;photoUrl?:string|null }
export interface FamilyItinerary { locations?:Record<string,FamilyLocation>;arrangements?:{title:string;kind:string;place:string}[];title:string;timezone:string;startsAt:string;endsAt:string;destination:string;meetingPoint:string;collectionPoint:string;supervisionContact:string;message:string;activities:{title:string;kind:string;startsAt:string;endsAt:string;place:FamilyLocation|null}[] }
export interface FamilyPlan { canRespond?:boolean;response?:{status:string;acknowledged?:boolean;updated_at?:string}; viewer?:'GUARDIAN'|'PLAYER';id:number|string;plan_id:number;club_id:number;title:string;version:number;child_id:number;child_name:string;club_name:string;acknowledged_at:string|null;published_at:string;permission_id:number;permission:OperationRecord;itinerary:FamilyItinerary;travel:{status:string;updated_at?:string;source?:string;passenger?:{status:string;updated_at:string}|null} }
export const planGet=async<T>(path:string,signal?:AbortSignal)=>(await apiClient.get<T>(`/map/plans${path}`,{signal})).data;
export const planPost=async<T=Plan>(path:string,body:unknown)=>(await apiClient.post<T>(`/map/plans${path}`,body,{timeout:20000})).data;
export const savePlan=async(id:number,revision:number,draft:PlanDraft)=>(await apiClient.put<Plan>(`/map/plans/${id}`,{revision,draft},{timeout:20000})).data;
export const permissionDecision=async(club:number,id:number,revision:number,status:string)=>(await apiClient.post(`/clubs/${club}/operations/records/${id}/transition`,{revision,status,note:null})).data;

export const money=(minor:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(minor/100);
export const dateTime=(value:string,zone:string)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(undefined,{timeZone:zone,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'Time to be confirmed';
export const localInput=(value:string,zone:string)=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
/** Resolve wall time in the plan's zone, and refuse a skipped DST time. */
export const zonedIso=(wall:string,zone:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall))throw new Error('Choose a complete date and time.');
  const target=Date.parse(wall+'Z');let guess=target;
  for(let i=0;i<3;i++){const shown=localInput(new Date(guess).toISOString(),zone);guess+=target-Date.parse(shown+'Z');}
  const result=new Date(guess).toISOString();if(localInput(result,zone)!==wall)throw new Error('This local time does not exist because the clocks change. Choose another time.');return result;
};
export const emptyDraft=(context?:PlanContext):PlanDraft=>{
  const starts=new Date();starts.setDate(starts.getDate()+7);starts.setMinutes(0,0,0);
  return {title:'',timezone:context?.settings.timezone||'Asia/Tbilisi',currency:context?.settings.currency||'GEL',budgetMinor:0,startsAt:starts.toISOString(),endsAt:new Date(+starts+8*3600000).toISOString(),destination:'',meetingPoint:'',collectionPoint:'',supervisionContact:'',familyMessage:'',privateNotes:'',participants:[],places:[],activities:[],arrangements:[]};
};
