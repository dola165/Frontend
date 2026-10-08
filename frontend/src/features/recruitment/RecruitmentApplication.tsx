import { AdditionalResponsibility } from './AdditionalResponsibility';
import { recruitmentOutcome } from './outcome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import './recruitment-offers.css';
import { StaffScopePicker, type StaffScopeSelection } from '../clubOperations/StaffScopePicker';
import { appointmentScope, scopePayload } from '../clubOperations/api';

export interface RecruitmentReceipt {
 id: number; clubId: number; clubName: string; applicantName: string; role: string; status: string;
 jobId: number | null; jobTitle: string | null; message: string | null; decisionMessage: string | null;
 canRespond: boolean; canWithdraw: boolean; canOffer: boolean; canCancelOffer: boolean; unavailableReason: string | null;
 activeElsewhere?: boolean;
 admissionCaseId?:number|null;admissionDestination?:string;
 offer: null | {title: string; specialism: string | null; squad_name: string | null; squad_id?:number|null; squad_ids?:number[]; squad_names?:string[]; engagement: string | null; starts_on: string | null; ends_on: string | null; expires_at: string; permissions: string[]; message: string | null; appointment_id: number | null};
 appointment?: {status: string}; playingRelationship?: {status: string; requires_parental_consent: boolean; parental_consent_status: string} | null;
}
const date = (s?: string | null) => s ? new Date(s).toLocaleDateString() : 'Not specified';

export function RecruitmentApplication({ applicationId, initial, onChanged }: {applicationId: number; initial?: RecruitmentReceipt; onChanged?: () => void}) {
 const { refreshNavigationCapabilities } = useAuth();
 const [receipt,setReceipt] = useState(initial ?? null),[error,setError] = useState(''),[loading,setLoading] = useState(!initial),[busy,setBusy] = useState(false);
 const [confirm,setConfirm] = useState<'accept'|'decline'|'withdraw'|'cancel'|null>(null),[offering,setOffering] = useState(false);
 const lock=useRef(false);
 const load=useCallback(async()=>{setLoading(true);try {setReceipt((await apiClient.get<RecruitmentReceipt>(`/recruitment/applications/${applicationId}`)).data);setError('');} catch(e){setError(extractApiErrorMessage(e,'Could not load this application.'));}finally{setLoading(false);}},[applicationId]);
 useEffect(()=>{if(!initial)void load();},[initial,load]);
 async function run(action:()=>Promise<unknown>) {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try {await action();setConfirm(null);setOffering(false);await load();await refreshNavigationCapabilities();onChanged?.();}
  catch(e){setError(extractApiErrorMessage(e,'The action could not be completed. Reload the receipt before retrying.'));}
  finally{lock.current=false;setBusy(false);}
 }
 if(!receipt)return <section className="recruitment-offer" aria-label="Recruitment application">{loading?<p role="status">Loading application…</p>:<p role="alert">{error}<button type="button" onClick={()=>void load()}>Retry</button></p>}</section>;
 const r=receipt,o=r.offer;
 return <article className="recruitment-offer" id={`recruitment-application-${r.id}`} aria-label={`${r.clubName} application`}>
  <header><div><small>{r.role==='PLAYER'?'Player recruitment':'Coaching recruitment'}</small><h3>{r.jobTitle || r.clubName}</h3><p>{r.clubName} · {r.applicantName}</p></div><strong className="recruitment-outcome" data-status={r.status}>{recruitmentOutcome(r.status)}</strong></header>
  {error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>void load()}>Reload receipt</button></p>}
  {r.unavailableReason&&<p className="recruitment-notice">{r.unavailableReason}</p>}
  {r.status==='PENDING'&&<p>The club will review this request. Any offer requires the applicant’s response before access begins.</p>}
  {o&&<section aria-label="Offer details"><h4>{o.title}</h4><dl>
    <div><dt>Responsibility</dt><dd>{o.specialism?.toLowerCase().replaceAll('_',' ') || 'Player trial'}</dd></div>
    {o.specialism&&<><div><dt>Scope</dt><dd>{appointmentScope({squad_id:o.squad_id??null,...o})}</dd></div><div><dt>Engagement</dt><dd>{o.engagement?.toLowerCase().replaceAll('_',' ')}</dd></div><div><dt>Dates</dt><dd>{date(o.starts_on)} – {o.ends_on ? date(o.ends_on) : 'Ongoing'}</dd></div><div><dt>Approved access</dt><dd>{o.permissions.map(p=>p.toLowerCase().replaceAll('_',' ').replace(':',': ')).join(' · ')}</dd></div></>}
    <div><dt>Respond by</dt><dd>{date(o.expires_at)}</dd></div>
   </dl>{o.message&&<p>{o.message}</p>}<p className="recruitment-muted">This records a club responsibility and app access. Employment terms and qualifications are handled separately.</p></section>}
  {!o&&r.decisionMessage&&<p>{r.decisionMessage}</p>}
  {r.role==='PLAYER'&&o&&<p>{r.admissionCaseId?'This answer is retained for the older request. Continue the named group arrangement; its terms and participation permission require separate confirmation.':'Acceptance records the old trial request. Club participation and any required guardian confirmation remain separate steps. Staff must arrange an actual named group.'}{r.activeElsewhere?' Your existing active playing club remains unchanged.':''}</p>}
  {r.status==='ACCEPTED'&&<p className="recruitment-notice">{r.appointment?`Recorded appointment: ${r.appointment.status.toLowerCase()}. Manage it in Club operations.`:r.playingRelationship?`Current playing relationship: ${r.playingRelationship.status.toLowerCase()}.${r.playingRelationship.requires_parental_consent&&r.playingRelationship.parental_consent_status!=='CONFIRMED'?' Guardian consent is still required.':''}`:'This acceptance is retained in your history. Current access depends on your present club responsibilities.'}</p>}
  <div className="recruitment-actions">
   {r.role==='PLAYER'&&<Link to={r.admissionDestination??'/admissions'}>{r.admissionCaseId?'Continue named group arrangement':'Continue existing request in Joining football'}</Link>}
   {r.canRespond&&<><button type="button" disabled={busy} className="recruitment-primary" onClick={()=>setConfirm('accept')}>Review acceptance</button><button type="button" disabled={busy} onClick={()=>setConfirm('decline')}>Decline offer</button></>}
   {r.canOffer&&!offering&&<button type="button" disabled={busy} className="recruitment-primary" onClick={()=>setOffering(true)}>Prepare offer</button>}
   {r.canCancelOffer&&<button type="button" disabled={busy} onClick={()=>setConfirm('cancel')}>Cancel offer</button>}
   {r.canWithdraw&&<button type="button" disabled={busy} onClick={()=>setConfirm('withdraw')}>Withdraw application</button>}
   {r.appointment&&<Link to="/club-operations">Manage appointment</Link>}
   <Link to={`/clubs/${r.clubId}`}>View club</Link>
  </div>
  {confirm&&<section className="recruitment-confirm" aria-label="Confirm recruitment response"><h4>{confirm==='accept'?'Accept this responsibility and its listed access?':confirm==='decline'?'Decline this offer?':confirm==='cancel'?'Cancel this unanswered offer?':'Withdraw this application?'}</h4><p>{confirm==='accept'?'Your response will be recorded. Existing responsibilities remain in place.':'This ends this request without ending any existing club relationship.'}</p><div className="recruitment-actions"><button type="button" disabled={busy} className="recruitment-primary" onClick={()=>void run(()=>confirm==='withdraw'?apiClient.post(`/clubs/${r.clubId}/applications/${r.id}/cancel`):confirm==='cancel'?apiClient.post(`/recruitment/applications/${r.id}/cancel-offer`):apiClient.post(`/recruitment/applications/${r.id}/respond`,{accept:confirm==='accept'}))}>{busy?'Saving…':confirm==='accept'?'Accept offer':'Confirm'}</button><button type="button" disabled={busy} onClick={()=>setConfirm(null)}>Keep reviewing</button></div></section>}
  {offering&&<OfferForm receipt={r} busy={busy} onCancel={()=>setOffering(false)} onSubmit={body=>void run(()=>apiClient.post(`/recruitment/applications/${r.id}/offer`,body))}/>}
 </article>;
}

interface Options {specialisms:{key:string;title:string;description:string;permissions:string[]}[];squads:{id:number;name:string}[]}
function OfferForm({receipt:r,busy,onCancel,onSubmit}:{receipt:RecruitmentReceipt;busy:boolean;onCancel:()=>void;onSubmit:(body:Record<string,unknown>)=>void}) {
 const [options,setOptions]=useState<Options|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [title,setTitle]=useState(r.jobTitle||''),[specialism,setSpecialism]=useState(''),[scope,setScope]=useState<StaffScopeSelection>({clubWide:false,squadIds:[]}),[engagement,setEngagement]=useState('');
 const [scopeError,setScopeError]=useState('');
 const [start,setStart]=useState(new Date().toLocaleDateString('en-CA')),[end,setEnd]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const c=new AbortController();void apiClient.get<Options>(`/recruitment/applications/${r.id}/options`,{signal:c.signal}).then(x=>{setOptions(x.data);setError('');}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load offer choices.'));});return()=>c.abort();},[r.id,retry]);
 if(error)return <p role="alert">{error}<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry choices</button></p>;
 if(!options)return <p role="status">Loading offer choices…</p>;
 return <form className="recruitment-form" onSubmit={e=>{e.preventDefault();if(r.role==='COACH'&&!scope.clubWide&&!scope.squadIds.length){setScopeError('Select at least one team or explicitly choose whole club.');return;}onSubmit({message,title,specialism,...scopePayload(scope),engagement,startsOn:start||null,endsOn:end||null});}}>
  <h4>Review the offer</h4><p>The applicant has 14 days to respond. Access starts only after acceptance.</p>
  {r.role==='COACH'&&<><label>Responsibility title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="U14 goalkeeper coach"/></label>
   <label>Coaching specialism<select required value={specialism} onChange={e=>setSpecialism(e.target.value)}><option value="">Choose specialism</option>{options.specialisms.map(s=><option key={s.key} value={s.key}>{s.title}</option>)}</select></label>
   {specialism&&<p>{options.specialisms.find(s=>s.key===specialism)?.description}<br/>Access: {options.specialisms.find(s=>s.key===specialism)?.permissions.map(p=>p.toLowerCase().replace(':',': ')).join(', ')}</p>}
   <StaffScopePicker squads={options.squads} value={scope} onChange={value=>{setScope(value);setScopeError('');}} disabled={busy}/>{scopeError&&<p role="alert">{scopeError}</p>}
   <label>Engagement<select required value={engagement} onChange={e=>setEngagement(e.target.value)}><option value="">Choose engagement</option><option value="VOLUNTEER">Volunteer</option><option value="EMPLOYEE">Employee</option><option value="CONTRACTOR">Contractor</option><option value="SHARED_STAFF">Shared staff</option></select></label>
   <label>Start date<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End date (optional)<input type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label></>}
  <label>Next steps for the applicant<textarea maxLength={2000} rows={3} value={message} onChange={e=>setMessage(e.target.value)}/></label>
  <div className="recruitment-actions"><button type="submit" disabled={busy} className="recruitment-primary">{busy?'Sending…':'Send offer'}</button><button type="button" disabled={busy} onClick={onCancel}>Keep application pending</button></div>
 </form>;
}

export function RecruitmentInbox({onChanged}:{onChanged?:()=>void}) {
 const [rows,setRows]=useState<RecruitmentReceipt[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();void apiClient.get<RecruitmentReceipt[]>('/recruitment/applications',{signal:c.signal}).then(x=>{setRows(x.data);setError('');}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load applications.'));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision]);
 useEffect(()=>{const id=new URLSearchParams(location.search).get('applicationId');if(id&&!loading)document.getElementById(`recruitment-application-${id}`)?.scrollIntoView({block:'center'});},[loading,rows]);
 return <section className="recruitment-inbox" aria-label="Applications and offers"><h2>Applications and offers</h2><p>Review each offer before a new club responsibility begins.</p>{loading&&<p role="status">Loading applications…</p>}{error&&<p role="alert">{error}<button type="button" onClick={()=>setRevision(n=>n+1)}>Retry</button></p>}{!loading&&!error&&!rows.length&&<p>No applications yet. Discover a club or an open role to get started.</p>}{rows.map(r=><RecruitmentApplication key={`${revision}:${r.id}`} applicationId={r.id} initial={r} onChanged={()=>{setRevision(n=>n+1);onChanged?.();}}/>)}<InvitationHistory/><AdditionalResponsibility onChanged={()=>{setRevision(n=>n+1);onChanged?.();}}/></section>;
}
function InvitationHistory() {
 const [rows,setRows]=useState<{id:number;clubName:string;role:string;status:string}[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();void apiClient.get<typeof rows>('/club-memberships/invites/me',{signal:c.signal}).then(r=>{setRows(r.data.filter(i=>i.status!=='PENDING'));setError('');}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load invitation history.'));});return()=>c.abort();},[retry]);
 if(error)return <p role="alert">{error}<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry invitations</button></p>;
 if(!rows.length)return null;
 return <details className="recruitment-additional"><summary>Past club invitations</summary>{rows.map(i=><article key={i.id}><h3>{i.clubName} · {i.role.toLowerCase().replaceAll('_',' ')}</h3><p>{i.status==='UNAVAILABLE'?'Unavailable: the sender’s authority or the club’s operating status changed. Ask current leadership for a new invitation.':i.status.toLowerCase().replaceAll('_',' ')}</p></article>)}</details>;
}
