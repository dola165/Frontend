import type { ScheduleWorkspaceEvent } from './workspaceTypes';
const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
/** Show spanning activities on every occupied calendar date, preserving their source identity. */
export function scheduleMonthEntries<T extends ScheduleWorkspaceEvent>(events:T[]):Record<string,T[]>{
 const groups:Record<string,T[]>={};
 for(const event of events){const start=new Date(event.startsAt),end=new Date(event.endsAt);if(!Number.isFinite(+start)||!Number.isFinite(+end))continue;const date=new Date(start);date.setHours(0,0,0,0);
  for(let i=0;i<100&&date<end;i++){const key=dayKey(date);(groups[key]??=[]).push(event);date.setDate(date.getDate()+1);}
 }return groups;
}
export function eventsForDay<T extends ScheduleWorkspaceEvent>(events:T[],day:Date):T[]{const from=new Date(day);from.setHours(0,0,0,0);const to=new Date(from);to.setDate(to.getDate()+1);
 return events.filter(e=>new Date(e.startsAt)<to&&new Date(e.endsAt)>from).map(e=>({...e,startsAt:new Date(Math.max(+new Date(e.startsAt),+from)).toISOString(),endsAt:new Date(Math.min(+new Date(e.endsAt),+to)).toISOString()}));}
