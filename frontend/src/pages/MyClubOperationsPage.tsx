import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { get, post, put, root, label, appointmentStatus, moduleNames, transitionLabel, type Appointment, type OperationRecord, type Choice } from '../features/clubOperations/api';
import '../features/clubOperations/operations.css';
import { FamilyClubWork } from '../features/clubOperations/FamilyClubWork';

interface Inbox { appointments:Appointment[]; permissions:(OperationRecord&{club_name:string;child_name:string;event_title?:string})[]; clubs:Choice[] }
export default function MyClubOperationsPage(){const {user,sessionId}=useAuth();return <Inbox key={`${user?.id}-${sessionId}`}/>;}
function Inbox(){
  const {refreshNavigationCapabilities}=useAuth();
  const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false);
  useEffect(()=>{const c=new AbortController();void get<Inbox>('/club-operations/mine',c.signal).then(setData).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load your club work.'));});return()=>c.abort();},[refresh]);
  const act=async(club:number,id:number,revision:number,status:string,appointment=false)=>{setBusy(true);setError('');try{await post(`${root(club)}/${appointment?'appointments':'records'}/${id}/transition`,{revision,status,note:null});setRefresh(v=>v+1);if(appointment)await refreshNavigationCapabilities();}catch(e){setError(extractApiErrorMessage(e,'Could not record your decision.'));}finally{setBusy(false);}};
  const visibility=async(a:Appointment)=>{setBusy(true);setError("");try{await put(`${root(a.club_id)}/appointments/${a.id}/publication`,{published:!a.published,revision:a.revision});setRefresh(v=>v+1);}catch(e){setError(extractApiErrorMessage(e,"Could not update public visibility."));}finally{setBusy(false);}};
  return <main className="club-ops"><header className="ops-header"><div><p className="ops-kicker">Your club work</p><h1>Appointments & permissions</h1><p className="ops-muted">Review invitations and make decisions for children linked to your account.</p></div><Link to="/my-organizations">My organisations</Link></header><div className="ops-main" style={{maxWidth:1200,margin:'auto'}}>
    {error&&<p role="alert" className="ops-alert">{error}<button onClick={()=>setRefresh(v=>v+1)}>Retry</button></p>}
    {!data&&!error&&<p role="status">Loading your club work…</p>}
    {data&&<><section className="ops-editor"><h2>Your clubs</h2><div className="ops-grid ops-editor">{data.clubs.map(c=><Link key={c.id} className="ops-card" to={`/clubs/${c.id}/operations`}><h3>{c.name}</h3><p>Open club operations →</p></Link>)}</div>{!data.clubs.length&&<p className="ops-muted">Active club staff appointments will appear here after acceptance.</p>}</section>
      <section className="ops-editor"><h2>Staff appointments</h2><div className="ops-grid ops-editor">{data.appointments.map(a=><article className="ops-card" key={a.id}><span className="ops-badge">{appointmentStatus(a)}</span><h3>{a.title} · {a.club_name}</h3><p className="ops-muted">{a.starts_on} – {a.ends_on??'Ongoing'} · {label(a.engagement)}</p><details><summary>Responsibilities and access</summary><p>{a.specialisations.map(label).join(', ')}</p>{a.permissions.map(p=><p className="ops-muted" key={p}>{moduleNames[p.split(':')[0]]} · {p.endsWith(':WRITE')?'Read and manage':'Read'}</p>)}</details>{a.status==="ACTIVE"&&<button disabled={busy} onClick={()=>{void visibility(a);}}>{a.published?"Hide my public appointment":"Show appointment on football profiles"}</button>}<div className="ops-footer">{a.status==='INVITED'?<><button className="ops-primary" disabled={busy} onClick={()=>{void act(a.club_id,a.id,a.revision,'ACTIVE',true);}}>Accept appointment</button><button disabled={busy} onClick={()=>{void act(a.club_id,a.id,a.revision,'DECLINED',true);}}>Decline</button></>:<Link to={data.clubs.some(c=>c.id===a.club_id)&&a.permissions.length?`/clubs/${a.club_id}/operations`:`/clubs/${a.club_id}`}>{data.clubs.some(c=>c.id===a.club_id)&&a.permissions.length?"Open workspace →":"Open club profile →"}</Link>}</div></article>)}</div>{!data.appointments.length&&<p className="ops-muted">No active appointments or invitations.</p>}</section>
      <section className="ops-editor"><h2>Guardian permissions</h2><div className="ops-grid ops-editor">{data.permissions.map(p=><article className="ops-card" key={p.id}><span className="ops-badge">{label(p.status)}</span><h3>{p.title}</h3><p className="ops-muted">{p.child_name} · {p.club_name}{p.event_title?` · ${p.event_title}`:""}{p.data.expiresOn?` · Valid until ${p.data.expiresOn}`:''}</p><dl>{Object.entries(p.data).map(([key,value])=><div key={key}><dt>{label(key.replace(/([A-Z])/g,'_$1').toUpperCase())}</dt><dd>{value}</dd></div>)}</dl><div className="ops-footer">{p.transitions.map(s=><button key={s} disabled={busy} onClick={()=>{void act(p.club_id,p.id,p.revision,s);}}>{transitionLabel(p.kind,s)}</button>)}</div></article>)}</div>{!data.permissions.length&&<p className="ops-muted">There are no permission requests for your confirmed guardian relationships.</p>}</section>
      <FamilyClubWork staffClubs={data.clubs}/>
    </>}
  </div></main>;
}



