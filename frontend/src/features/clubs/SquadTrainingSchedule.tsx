import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Globe2, LockKeyhole, MapPin } from 'lucide-react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import './family-journeys.css';

interface Session {id:string;title:string;startsAt:string;endsAt:string;status:string;location?:string|null;timezone?:string|null}
interface Timetable {squadId:number;squadName:string;visibility:'PUBLIC'|'PRIVATE';canManage:boolean;canView:boolean;revision:number;sessions:Session[];limited:boolean}
const root=(club:number,squad:number)=>`/clubs/${club}/squads/${squad}/training-schedule`;
export function SquadTrainingSchedule({clubId,squadId,management=false}:{clubId:number;squadId:number;management?:boolean}) {
 const {sessionId,status}=useAuth();
 return <TimetableContent key={`${clubId}:${squadId}:${sessionId}:${status}`} clubId={clubId} squadId={squadId} management={management}/>;
}
function TimetableContent({clubId,squadId,management}:{clubId:number;squadId:number;management:boolean}) {
 const {sessionId,status}=useAuth();const [result,setResult]=useState<Timetable|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[expanded,setExpanded]=useState(false),[saving,setSaving]=useState(false),[proposed,setProposed]=useState<'PUBLIC'|'PRIVATE'|null>(null);
 const alive=useRef(true),lock=useRef(false);
 useEffect(()=>{alive.current=true;const c=new AbortController();const load=()=>void apiClient.get<Timetable>(root(clubId,squadId),{signal:c.signal,_authSessionId:sessionId} as AuthSessionRequestConfig).then(r=>{if(!c.signal.aborted&&isCurrentAuthSession(sessionId)){setResult(r.data);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Training times could not load.'));});load();const refresh=()=>{if(!document.hidden)load();};window.addEventListener('focus',refresh);return()=>{alive.current=false;c.abort();window.removeEventListener('focus',refresh);};},[clubId,squadId,sessionId,attempt]);
 const save=async()=>{if(!result||!proposed||lock.current||!isCurrentAuthSession(sessionId))return;lock.current=true;setSaving(true);setError('');try{await apiClient.put(root(clubId,squadId)+'/publication',{visibility:proposed,revision:result.revision},{_authSessionId:sessionId} as AuthSessionRequestConfig);if(alive.current&&isCurrentAuthSession(sessionId)){setProposed(null);setAttempt(v=>v+1);}}catch(e){if(alive.current)setError(extractApiErrorMessage(e,'Could not update timetable visibility.'));}finally{lock.current=false;if(alive.current)setSaving(false);}};
 const sessions=result?.sessions??[],shown=expanded?sessions:sessions.slice(0,4);
 return <section className="club-public fj-timetable" aria-label={result?`${result.squadName} training timetable`:'Training timetable'}>
  <header><div><span className="cp-eyebrow"><CalendarDays size={14}/>Training timetable</span><h3>{result?.squadName??'Training times'}</h3></div>{result&&<span className="fj-visibility">{result.visibility==='PUBLIC'?<Globe2 size={14}/>:<LockKeyhole size={14}/>} {result.visibility==='PUBLIC'?'Public':'Squad members'}</span>}</header>
  {error&&<p role="alert" className="cp-error">{error} <button className="cp-text-button" onClick={()=>setAttempt(v=>v+1)}>Refresh</button></p>}
  {!result&&!error&&<p role="status">Loading training times…</p>}
  {result&&!result.canView&&<div className="fj-private"><LockKeyhole size={22}/><div><strong>This timetable is shared with squad members</strong><p>Ask the club about training days before joining.{status!=='authenticated'&&<> Already part of the squad? <Link to={buildLoginRedirectPath(`/clubs/${clubId}`,`?tab=teams&squad=${squadId}`)}>Sign in</Link>.</>}</p></div></div>}
  {result?.canView&&<><p className="cp-muted">Next six weeks · dates and times from the squad’s schedule.</p><div className="fj-training-dates">{shown.map(s=><TrainingDate key={s.id} session={s}/>)}</div>{!sessions.length&&<p className="cp-muted">No training sessions are scheduled in this window. Confirm the next session with the club.</p>}{sessions.length>4&&<button className="cp-text-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show fewer dates':`Show all ${sessions.length} dates`}</button>}{result.limited&&<p className="cp-muted">Only the first 200 sessions are shown.</p>}<p className="fj-timezone">Session timezone is shown where recorded; otherwise times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p></>}
  {result?.canManage&&<footer className="fj-publication"><div><Link to={`/calendar?scope=squad&squadId=${squadId}`}>Manage training sessions</Link>{!management&&<Link to={`/clubs/${clubId}/workspace?tab=squads&squad=${squadId}&view=training`}>Squad workspace</Link>}</div><details open={proposed!==null||undefined}><summary>Timetable visibility</summary><p>Publishing lets visitors see training titles, times and locations. Player lists, replies and private notes stay restricted. Separate club events keep their own publication settings.</p><label>Who can see this timetable?<select aria-label="Timetable visibility" disabled={saving} value={proposed??result.visibility} onChange={e=>setProposed(e.target.value as 'PUBLIC'|'PRIVATE')}><option value="PRIVATE">Squad members only</option><option value="PUBLIC">Everyone on the club profile</option></select></label>{proposed&&proposed!==result.visibility&&<><p className="fj-publish-note">{proposed==='PUBLIC'?'Review the training titles and places above. Saving also publishes future training sessions added to this squad.':'Saving removes the timetable from the public club view. Squad members keep access.'}</p><button className="cp-button cp-button-primary" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':proposed==='PUBLIC'?'Publish training timetable':'Make timetable private'}</button><button className="cp-text-button" disabled={saving} onClick={()=>setProposed(null)}>Cancel</button></>}</details></footer>}
 </section>;
}
function TrainingDate({session:s}:{session:Session}) {
 let timezone=s.timezone||undefined;try{if(timezone)new Intl.DateTimeFormat(undefined,{timeZone:timezone});}catch{timezone=undefined;}
 // Club calendar local times have no offset; its stored timezone labels those wall-clock times.
 const absolute=/Z$|[+-]\d{2}:\d{2}$/.test(s.startsAt),options=absolute&&timezone?{timeZone:timezone}:{};
 const start=new Date(s.startsAt),end=new Date(s.endsAt);
 return <article className={`fj-training-date${s.status==='CANCELLED'?' is-cancelled':''}`}><time dateTime={s.startsAt}><strong>{start.toLocaleDateString(undefined,{day:'numeric',...options})}</strong><span>{start.toLocaleDateString(undefined,{month:'short',...options})}</span></time><div><strong>{s.title}</strong><p>{start.toLocaleDateString(undefined,{weekday:'long',...options})} · {start.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',...options})}–{end.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',...options})}{timezone&&<small> · {timezone}</small>}</p>{s.status==='CANCELLED'?<span className="fj-cancelled">Cancelled</span>:s.location?<p><MapPin size={13}/>{s.location}</p>:<p className="cp-muted">Location to be confirmed</p>}</div></article>;
}
