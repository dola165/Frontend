import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Route } from 'lucide-react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { FamilyPlanWindow } from './FamilyPlanWindow';
import { dateTime } from './api';
import { replyToJourney, type JourneyEntry } from './journeyScheduleData';
import './journey-schedule.css';

export function JourneyEventDetails({entries,onClose,onSaved}:{entries:JourneyEntry[];onClose:()=>void;onSaved?:()=>void}){
 const [picked,setPicked]=useState(entries[0].id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<Record<string,string>>({});
 const entry=entries.find(e=>e.id===picked)??entries[0];
 const reply=async(subject:number,response:'GOING'|'NOT_GOING')=>{if(busy)return;setBusy(true);setError('');try{await replyToJourney(entry,subject,response);setSaved(s=>({...s,[`${entry.planId}:${entry.version}:${subject}`]:response}));onSaved?.();}catch(e){setError(extractApiErrorMessage(e,'Your reply was not saved. Retry safely.'));}finally{setBusy(false);}};
 const child=entry.subjects[0]?.id;
 return <FamilyPlanWindow className="journey-floating-window" open onClose={onClose} title="Journey event"><div className="journey-event-details">
  {entries.length>1&&<label>Journey<select value={picked} onChange={e=>setPicked(e.target.value)}>{entries.map(j=><option key={j.id} value={j.id}>{j.journeyTitle}</option>)}</select></label>}
  <span className="atlas-eyebrow">{entry.clubName} · {entry.squadName}</span><h2>{entry.title}</h2><p>{dateTime(entry.startsAt,entry.timezone)} – {dateTime(entry.endsAt,entry.timezone)} · {entry.timezone}</p>
  {entry.place&&<p className="journey-event-place"><MapPin size={18}/>{entry.place.name} · {entry.place.address}</p>}
  {entry.status==='CANCELLED'&&<p role="alert">This journey's linked event was cancelled. Contact your club about remaining travel arrangements.</p>}
  {entry.sourceChanged&&<p role="status">The fixture has changed. These are its current times; your club is reviewing the surrounding journey stops.</p>}
  <p><Route size={18}/> Part of <strong>{entry.journeyTitle}</strong></p>
  {entry.staff&&<p>{entry.attendance.going}/{entry.attendance.total} going · {entry.attendance.pending} awaiting reply</p>}
  {entry.subjects.map(s=><section className="journey-event-reply" key={s.id}><strong>{s.name} · whole journey</strong><p role="status">{(saved[`${entry.planId}:${entry.version}:${s.id}`]??s.response)==='GOING'?"Going":(saved[`${entry.planId}:${entry.version}:${s.id}`]??s.response)==='NOT_GOING'?"Not going":s.response==='RECONFIRMATION_REQUIRED'?'Please confirm the updated journey':'Awaiting your reply'}</p>
   {s.guardian&&<small>Attendance and travel permission are separate. Review any permission request in the journey.</small>}
   {s.canRespond&&entry.status!=='CANCELLED'&&<div><button disabled={busy} onClick={()=>void reply(s.id,'GOING')}>I am going</button><button disabled={busy} onClick={()=>void reply(s.id,'NOT_GOING')}>I cannot go</button></div>}
  </section>)}
  {busy&&<p role="status">Saving your reply…</p>}{error&&<p role="alert">{error}</p>}
  <Link className="journey-event-open" to={entry.staff?`/map?plans=staff&plan=${entry.planId}&club=${entry.clubId}&squad=${entry.squadId}&view=journey`:`/map?plans=family&journey=${entry.planId}${child?`&journeyChild=${child}`:''}`}><Route size={18}/> View the whole journey on the map</Link>
  {(entry.eventId||entry.sessionId)&&<Link to={entry.sessionId?`/calendar?scope=squad&squadId=${entry.squadId}&sessionId=${entry.sessionId}`:`/calendar?scope=personal&eventId=${entry.eventId}`}>Open the linked {entry.sessionId?'training session':'fixture'}</Link>}
 </div></FamilyPlanWindow>;
}
