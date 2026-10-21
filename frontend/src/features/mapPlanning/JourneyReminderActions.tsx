import { useState } from 'react';
import type { NotificationItem } from '../../types/notifications';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { replyToJourney, type JourneyEntry } from './journeyScheduleData';

/** Opening a message is read-only. Only these explicit authenticated buttons submit RSVP. */
export function JourneyReminderActions({notification}:{notification:NotificationItem}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 if(notification.type!=='JOURNEY_ATTENDANCE_REMINDER')return null;
 const path=new URL(notification.linkPath??'/calendar',window.location.origin),plan=Number(path.searchParams.get('journey')),subject=Number(path.searchParams.get('journeyChild')),date=path.searchParams.get('date');
 const reply=async(response:'GOING'|'NOT_GOING')=>{if(busy||!plan||!subject||!date)return;setBusy(true);setError('');try{
  const from=new Date(`${date}T00:00:00`),to=new Date(from);to.setDate(to.getDate()+1);
  const r=await apiClient.get<JourneyEntry[]>('/journeys/schedule',{params:{from:from.toISOString(),to:to.toISOString(),childId:subject}});
  const entry=r.data.find(e=>e.planId===plan&&e.subjects.some(s=>s.id===subject&&s.canRespond));
  if(!entry||entry.status==='CANCELLED')throw new Error('This invitation changed or replies are closed. Open the latest journey details.');
  // A corrected publication needs review rather than a stale notification making a new decision.
  if(entry.sourceChanged||entry.version!==Number(path.searchParams.get('journeyVersion')))throw new Error('The fixture changed. Review its latest journey details before responding.');
  await replyToJourney(entry,subject,response);setStatus(response==='GOING'?'Going · reply saved':'Not going · reply saved');
 }catch(e){setError(extractApiErrorMessage(e,e instanceof Error?e.message:'Your reply was not saved. Retry safely.'));}finally{setBusy(false);}};
 return <div className="px-4 pb-4 sm:px-5" onClick={e=>e.stopPropagation()}>{status?<p role="status">{status}</p>:<div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={()=>void reply('GOING')}>I am going</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={()=>void reply('NOT_GOING')}>I cannot go</button></div>}{busy&&<p role="status">Saving your journey reply…</p>}{error&&<p role="alert">{error}</p>}</div>;
}
