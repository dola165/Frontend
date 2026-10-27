import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { promptEmailConfirmation } from '../../components/auth/emailConfirmationPrompt';
import { useOtherClub } from './leaving/useOtherClub';
import { get, post, put, root, label, appointmentScope, appointmentStatus, type Appointment, type Choice } from './api';
import './operations.css';
import { ArrowRight, Building2, ChevronDown, Eye, ShieldCheck } from 'lucide-react';
import { AppointmentSummary } from './AppointmentSummary';
import './club-connections.css';
import { FamilyClubWork } from './FamilyClubWork';
import { GuardianPermissions, type GuardianPermission } from './GuardianPermissions';

interface Inbox { appointments:Appointment[]; permissions:GuardianPermission[]; clubs:(Choice & {canWork?:boolean})[] }
export function StaffAppointments() { return <PersonalClubWork area="appointments" />; }
export function GuardianClubWork() { return <PersonalClubWork area="family" />; }
function PersonalClubWork({area}:{area:'appointments'|'family'}){const {user,sessionId}=useAuth();return <Work area={area} key={`${user?.id}-${sessionId}`}/>;}
function Work({area}:{area:'appointments'|'family'}){
  const {user,refreshNavigationCapabilities}=useAuth();
  const other=useOtherClub();
  const [params]=useSearchParams(), inFlight=useRef(false);
  const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const selectedAppointment=params.get('appointmentId');
  const appointmentId=selectedAppointment&&/^[1-9]\d*$/.test(selectedAppointment)&&Number.isSafeInteger(Number(selectedAppointment))?selectedAppointment:null;
  useEffect(()=>{const c=new AbortController();setData(null);void get<Inbox>(`/club-operations/mine${appointmentId?`?appointmentId=${appointmentId}`:''}`,c.signal).then(r=>{if(!c.signal.aborted)setData(r);}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load your club work.'));});return()=>c.abort();},[refresh,appointmentId]);
  const act=async(club:number,id:number,revision:number,status:string,appointment=false)=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setMessage('');try{await post(`${root(club)}/${appointment?'appointments':'records'}/${id}/transition`,{revision,status,note:null});setMessage(appointment?'Appointment decision saved.':`Permission ${label(status).toLowerCase()} · decision saved.`);setRefresh(v=>v+1);if(appointment)await refreshNavigationCapabilities();}catch(e){if(!other.catchOther(e,()=>void act(club,id,revision,status,appointment))&&!promptEmailConfirmation(e))setError(extractApiErrorMessage(e,'Could not record your decision.'));}finally{inFlight.current=false;setBusy(false);}};
  const visibility=async(a:Appointment)=>{setBusy(true);setError("");try{await put(`${root(a.club_id)}/appointments/${a.id}/publication`,{published:!a.published,revision:a.revision});setRefresh(v=>v+1);}catch(e){setError(extractApiErrorMessage(e,"Could not update public visibility."));}finally{setBusy(false);}};
  return <section className="club-ops club-connections club-connections-embedded"><div className="connections-content">
    {error&&<p role="alert" className="ops-alert">{error}<button onClick={()=>{setError('');setRefresh(v=>v+1);}}>Refresh requests</button></p>}
    {message&&<p className="connections-saved" role="status">{message}</p>}
    {other.notice}
    {!data&&!error&&<p role="status">Loading your club work…</p>}
    {data&&<>
      {appointmentId&&!data.appointments.some(a=>String(a.id)===appointmentId)&&<p role="status" className="connections-quiet-note">This appointment is no longer available to your account. You can review your current appointments below.</p>}
      {area==='family'&&params.has('permissionId')&&!data.permissions.some(p=>String(p.id)===params.get('permissionId'))&&<p role="status" className="connections-quiet-note">This permission request is no longer available to your account. You can review your current requests below.</p>}
      {area==='family'&&(data.permissions.length>0 || user?.navigationCapabilities?.workspaces.some(w=>w.id==='parent.hub'))&&<GuardianPermissions items={data.permissions} selected={params.get('permissionId')} busy={busy} onAction={(p,status)=>act(p.club_id,p.id,p.revision,status)}/>}
      {area==='family'&&<PlayerConnections/>}
      {area==='appointments'&&(data.appointments.length>0?<section className="connections-section"><header><span className="connections-section-icon"><ShieldCheck size={20}/></span><div><h2>Staff appointments</h2><p>Your agreed responsibilities, dates and access.</p></div><span className="connections-count">{data.appointments.length}</span></header><div className="connections-appointments">{data.appointments.map(a=><StaffAppointmentCard key={`${a.id}:${a.revision}`} appointment={a} busy={busy} canWork={data.clubs.some(c=>c.id===a.club_id)&&Boolean(a.permissions.length)} onAction={status=>act(a.club_id,a.id,a.revision,status,true)} onVisibility={()=>visibility(a)}/>)}</div></section>:<details className="connections-staff-empty"><summary><ShieldCheck size={18}/>Staff appointments <span>No appointments</span><ChevronDown size={16}/></summary><p>Club leadership can invite you to an agreed responsibility. Invitations appear here for you to review.</p><Link to="/requests">View requests <ArrowRight size={15}/></Link></details>)}
      {area==='family'?<FamilyClubWork staffClubs={data.clubs}/>:<Link to="/parent?tab=connections">Club & family permissions, records and support <ArrowRight size={16}/></Link>}
    </>}
  </div></section>;
}




function PlayerConnections(){
 const {user}=useAuth();
 const [connections,setConnections]=useState<{club_id:number;club_name:string;user_id:number;name:string}[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();void get<{connections:NonNullable<typeof connections>}>('/club-operations/family',abort.signal).then(data=>{if(!abort.signal.aborted)setConnections(data.connections);}).catch(e=>{if(!abort.signal.aborted)setError(extractApiErrorMessage(e,'Your team connections could not load.'));});return()=>abort.abort();},[]);
 if(error)return <p role="alert" className="ops-alert">{error}</p>;
 if(!connections)return <p role="status">Loading team connections…</p>;
 if(!connections.length)return null;
 return <section className="connections-section"><header><span className="connections-section-icon"><Building2 size={20}/></span><div><h2>Your teams & family</h2><p>Current memberships and verified family connections.</p></div><span className="connections-count">{connections.length}</span></header><div className="connections-clubs">{connections.map(c=><Link to={`/clubs/${c.club_id}`} key={`${c.club_id}:${c.user_id}`}><span className="connections-club-initials" aria-hidden="true">{c.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><span><strong>{c.user_id===Number(user?.id)?'Your player membership':c.name}</strong><small>{c.club_name}</small></span><ArrowRight size={16}/></Link>)}</div></section>;
}
function StaffAppointmentCard({appointment:a,busy,canWork,onAction,onVisibility}:{appointment:Appointment;busy:boolean;canWork:boolean;onAction:(status:string)=>Promise<void>;onVisibility:()=>Promise<void>}) {
  const [confirm,setConfirm]=useState<'ACTIVE'|'ENDED'|null>(null);
  const state=appointmentStatus(a);
  useEffect(()=>{if(new URLSearchParams(location.search).get('appointmentId')===String(a.id))document.getElementById(`staff-appointment-${a.id}`)?.scrollIntoView({block:'center'});},[a.id]);
  return <AppointmentSummary appointment={a}>
    {a.status==='INVITED'?<><button className="appointment-summary__primary" disabled={busy||state!=='Invited'} onClick={()=>setConfirm('ACTIVE')}>Accept appointment <ArrowRight size={16}/></button><button className="appointment-summary__quiet" disabled={busy} onClick={()=>void onAction('DECLINED')}>Decline</button></>:<Link className="appointment-summary__primary" to={canWork?`/clubs/${a.club_id}/workspace`:`/clubs/${a.club_id}`}>{canWork?'Open workspace':'Open club profile'}<ArrowRight size={16}/></Link>}
    {(a.published||['Active','Upcoming'].includes(state))&&<button className="appointment-summary__quiet" disabled={busy} onClick={()=>void onVisibility()}><Eye size={16}/>{a.published?'Hide my public appointment':'Show appointment on football profiles'}</button>}
    {a.status==='ACTIVE'&&<button className="appointment-summary__quiet appointment-summary__danger" disabled={busy} onClick={()=>setConfirm('ENDED')}>End this appointment</button>}
    {confirm&&<div className="appointment-summary__confirmation" role="group" aria-label="Confirm appointment decision"><h4>{confirm==='ACTIVE'?'Accept these responsibilities?':'End this appointment and its access?'}</h4><p>{a.title} · {appointmentScope(a)}</p><p>{confirm==='ACTIVE'?'Your acceptance covers the dates and explicit permissions above. Existing appointments remain separate.':'Your other appointments and club memberships remain in place.'}</p><div className="ops-footer"><button disabled={busy} onClick={()=>setConfirm(null)}>Go back</button><button className="appointment-summary__primary" disabled={busy} onClick={()=>{void onAction(confirm);}}>{confirm==='ACTIVE'?'Confirm acceptance':'Confirm end'}</button></div></div>}
  </AppointmentSummary>;
}
