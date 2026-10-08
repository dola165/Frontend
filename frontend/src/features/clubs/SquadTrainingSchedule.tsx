import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Globe2, LockKeyhole } from 'lucide-react';
import { TrainingWeekCalendar } from './TrainingWeekCalendar';
import type { TrainingSession } from './trainingCalendar';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import './family-journeys.css';

interface Timetable {squadId:number;squadName:string;visibility:'PUBLIC'|'PRIVATE';canManage:boolean;canView:boolean;revision:number;sessions:TrainingSession[];limited:boolean;programmeTimesPublic?:boolean;publicationConfigured?:boolean}
const root=(club:number,squad:number)=>`/clubs/${club}/squads/${squad}/training-schedule`;
export function SquadTrainingSchedule({clubId,squadId,management=false}:{clubId:number;squadId:number;management?:boolean}) {
 const {sessionId,status}=useAuth();
 return <TimetableContent key={`${clubId}:${squadId}:${sessionId}:${status}`} clubId={clubId} squadId={squadId} management={management}/>;
}
function TimetableContent({clubId,squadId,management}:{clubId:number;squadId:number;management:boolean}) {
 const {sessionId,status}=useAuth();const [result,setResult]=useState<Timetable|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[saving,setSaving]=useState(false),[proposed,setProposed]=useState<'PUBLIC'|'PRIVATE'|null>(null);
 const alive=useRef(true),lock=useRef(false);
 useEffect(()=>{alive.current=true;const c=new AbortController();const load=()=>void apiClient.get<Timetable>(root(clubId,squadId),{signal:c.signal,_authSessionId:sessionId} as AuthSessionRequestConfig).then(r=>{if(!c.signal.aborted&&isCurrentAuthSession(sessionId)){setResult(r.data);setError('');}}).catch(e=>{if(!c.signal.aborted&&isCurrentAuthSession(sessionId)){setResult(null);setError(extractApiErrorMessage(e,'Training times could not load.'));}});load();const refresh=()=>{if(!document.hidden)load();};window.addEventListener('focus',refresh);return()=>{alive.current=false;c.abort();window.removeEventListener('focus',refresh);};},[clubId,squadId,sessionId,attempt]);
 const save=async()=>{if(!result||!proposed||lock.current||!isCurrentAuthSession(sessionId))return;lock.current=true;setSaving(true);setError('');try{await apiClient.put(root(clubId,squadId)+'/publication',{visibility:proposed,revision:result.revision},{_authSessionId:sessionId} as AuthSessionRequestConfig);if(alive.current&&isCurrentAuthSession(sessionId)){setProposed(null);setAttempt(v=>v+1);}}catch(e){if(alive.current)setError(extractApiErrorMessage(e,'Could not update timetable visibility.'));}finally{lock.current=false;if(alive.current)setSaving(false);}};
 const sessions=result?.sessions??[];
 return <section className="club-public fj-timetable" aria-label={result?`${result.squadName} training timetable`:'Training timetable'}>
  <header><div><span className="cp-eyebrow"><CalendarDays size={14}/>Training timetable</span><h3>{result?.squadName??'Training times'}</h3></div>{result&&<span className="fj-visibility">{(result.visibility==='PUBLIC'||result.programmeTimesPublic)?<Globe2 size={14}/>:<LockKeyhole size={14}/>} {result.programmeTimesPublic?'Training times public':result.visibility==='PUBLIC'?'Public':'Squad members'}</span>}</header>
  {error&&<p role="alert" className="cp-error">{error} <button className="cp-text-button" onClick={()=>setAttempt(v=>v+1)}>Refresh</button></p>}
  {!result&&!error&&<p role="status">Loading training times…</p>}
  {result&&!result.canView&&<div className="fj-private"><LockKeyhole size={22}/><div><strong>This timetable is shared with squad members</strong><p>The club has not published training times for this group.{status!=='authenticated'&&<> Already part of the squad? <Link to={buildLoginRedirectPath(`/clubs/${clubId}`,`?tab=teams&squad=${squadId}`)}>Sign in</Link>.</>}</p></div></div>}
  {result?.canView&&<><p className="cp-muted">{result.programmeTimesPublic ? 'Next six weeks · compare training days and times before joining.' : 'Next six weeks · choose a session for its time and location.'}</p><TrainingWeekCalendar sessions={sessions}/>{result.limited&&<p className="cp-muted">Only the first 200 sessions are shown.</p>}</>}
  {result?.canManage&&<footer className="fj-publication"><div><Link to={`/calendar?scope=squad&squadId=${squadId}`}>Manage training sessions</Link>{!management&&<Link to={`/clubs/${clubId}/workspace?tab=squads&squad=${squadId}&view=training`}>Squad workspace</Link>}</div><details open={proposed!==null||undefined}><summary>Timetable visibility</summary><p>Published programmes automatically show training dates and times. Session titles and locations stay with squad members unless you publish the full timetable. Player lists, replies and private notes stay restricted. Separate club events keep their own publication settings.</p><label>Who can see this timetable?<select aria-label="Timetable visibility" disabled={saving} value={proposed??(result.programmeTimesPublic&&!result.publicationConfigured?'AUTOMATIC':result.visibility)} onChange={e=>setProposed(e.target.value as 'PUBLIC'|'PRIVATE')}>{result.programmeTimesPublic&&!result.publicationConfigured&&<option value="AUTOMATIC" disabled>Programme dates and times (automatic)</option>}<option value="PRIVATE">Squad members only</option><option value="PUBLIC">Everyone on the club profile</option></select></label>{proposed&&(proposed!==result.visibility||!result.publicationConfigured&&result.programmeTimesPublic)&&<><p className="fj-publish-note">{proposed==='PUBLIC'?'Review the training titles and places above. Saving also publishes future training sessions added to this squad.':'Saving removes the timetable from the public club view. Squad members keep access.'}</p><button className="cp-button cp-button-primary" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':proposed==='PUBLIC'?'Publish training timetable':'Make timetable private'}</button><button className="cp-text-button" disabled={saving} onClick={()=>setProposed(null)}>Cancel</button></>}</details></footer>}
 </section>;
}
