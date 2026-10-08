import { getAuthSessionId, getStoredUserId, isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import type { PlanDraft } from './api';

export interface RecoveredPlan { key:string;planId:number;clubId:number;squadId:number;requestId:string;baseRevision:number|null;baseDraft:PlanDraft;draft:PlanDraft;savedAt:number }
const prefix='gk-map-drafts:';
const lifetime=7*24*60*60*1000;
const storageKey=()=>{const user=getStoredUserId(),session=getAuthSessionId();return user&&session?`${prefix}${user}:${session}`:null;};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const strings=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==='string');
function validDraft(value:unknown):value is PlanDraft{
 if(!object(value)||!strings(value,['title','timezone','currency','startsAt','endsAt','destination','meetingPoint','collectionPoint','supervisionContact','familyMessage','privateNotes'])||!Number.isSafeInteger(value.budgetMinor)||!Array.isArray(value.participants)||value.participants.length>100||!value.participants.every(Number.isSafeInteger))return false;
 try{new Intl.DateTimeFormat(undefined,{timeZone:value.timezone as string});new Intl.NumberFormat(undefined,{style:'currency',currency:value.currency as string});if(!Number.isFinite(Date.parse(value.startsAt as string))||!Number.isFinite(Date.parse(value.endsAt as string)))return false;}catch{return false;}
 const lists=[['places',60],['activities',100],['arrangements',60]] as const;
 if(!lists.every(([key,limit])=>Array.isArray(value[key])&&(value[key] as unknown[]).length<=limit))return false;
 return (value.places as unknown[]).every(p=>object(p)&&strings(p,['key','name','address','type','notes'])&&typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180)
  &&(value.activities as unknown[]).every(a=>object(a)&&strings(a,['key','title','kind','startsAt','endsAt','notes'])&&Number.isFinite(Date.parse(a.startsAt as string))&&Number.isFinite(Date.parse(a.endsAt as string)))
  &&(value.arrangements as unknown[]).every(a=>object(a)&&strings(a,['key','kind','title','notes'])&&Number.isSafeInteger(a.amountMinor));
}
const valid=(r:unknown):r is RecoveredPlan=>object(r)&&strings(r,['key','requestId'])&&Number.isSafeInteger(r.planId)&&Number.isSafeInteger(r.clubId)&&Number.isSafeInteger(r.squadId)&&(r.baseRevision===null||Number.isSafeInteger(r.baseRevision))&&typeof r.savedAt==='number'&&r.savedAt<=Date.now()+60_000&&Date.now()-r.savedAt<lifetime&&validDraft(r.draft)&&validDraft(r.baseDraft);
function records():RecoveredPlan[]{try{const key=storageKey();if(!key)return [];const text=localStorage.getItem(key);if(!text||text.length>2_000_000)return [];const items:unknown=JSON.parse(text);return Array.isArray(items)?items.filter(valid).sort((a,b)=>b.savedAt-a.savedAt):[];}catch{return [];}}
export function recoverPlan(key?:string){return records().find(r=>!key||r.key===key)||null;}
export const recoveryKey=(planId:number,requestId:string)=>planId?`plan:${planId}`:`draft:${requestId}`;
export function rememberPlan(record:RecoveredPlan,session:AuthSessionId):boolean{
 try{if(!isCurrentAuthSession(session))return false;const key=storageKey();if(!key)return false;const items=[record,...records().filter(r=>r.key!==record.key)];const text=JSON.stringify(items);if(text.length>2_000_000)return false;localStorage.setItem(key,text);return true;}catch{return false;}
}
export function forgetPlan(key:string,session:AuthSessionId){try{if(!isCurrentAuthSession(session))return;const storage=storageKey();if(storage)localStorage.setItem(storage,JSON.stringify(records().filter(r=>r.key!==key)));}catch{/* Existing draft remains available if storage is restricted. */}}
export function draftFingerprint(d:PlanDraft){
 const normalize=(value:unknown):unknown=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)])):value;
 return JSON.stringify(normalize({...d,places:d.places.map(p=>({...p,entityId:p.entityId??null})),activities:d.activities.map(a=>({...a,placeKey:a.placeKey??null,eventId:a.eventId??null,sessionId:a.sessionId??null})),arrangements:d.arrangements.map(a=>({...a,placeKey:a.placeKey??null,financeRecordId:a.financeRecordId??null}))}));
}
export function validatePlanDraft(d:PlanDraft):{field:string;message:string}|null{
 if(!d.title.trim())return {field:'Plan name',message:'Give this plan a name before creating it.'};
 const start=Date.parse(d.startsAt),end=Date.parse(d.endsAt);
 if(!Number.isFinite(start))return {field:'Leaving',message:'Choose a complete departure date and time.'};
 if(!Number.isFinite(end)||end<=start)return {field:'Expected return',message:'The return must be after the departure.'};
 if(end-start>90*86400000)return {field:'Expected return',message:'A plan can cover up to 90 days.'};
 if(d.activities.some(a=>Date.parse(a.startsAt)<start||Date.parse(a.endsAt)>end))return {field:'Schedule',message:'Keep each activity inside the journey dates, or update those dates.'};
 return null;
}

/** Only selection IDs, scoped to the same account/session and recovery lifetime. */
export function recoverSelection():{planId:number;clubId:number;squadId:number}|null{
 try{const key=storageKey();if(!key)return null;const row=JSON.parse(localStorage.getItem(key+':selection')||'null');return row&&Number.isSafeInteger(row.planId)&&row.planId>0&&Number.isSafeInteger(row.clubId)&&Number.isSafeInteger(row.squadId)&&typeof row.savedAt==='number'&&Date.now()-row.savedAt<lifetime?row:null;}catch{return null;}
}
export function rememberSelection(planId:number,clubId:number,squadId:number,session:AuthSessionId){
 try{const key=storageKey();if(key&&isCurrentAuthSession(session))localStorage.setItem(key+':selection',JSON.stringify({planId,clubId,squadId,savedAt:Date.now()}));}catch{/* Explicit saved journeys remain available. */}
}
