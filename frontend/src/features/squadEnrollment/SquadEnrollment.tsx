import { EmptyState } from '../../components/ui/EmptyState';
import { MailOpen, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from './api';
import './enrollment.css';
const errorText=(e:unknown)=>extractApiErrorMessage(e,'We could not save this. Please try again.');

export function SquadJoinPage() {
    const {hash}=useLocation();const {sessionId}=useAuth();
    return <JoinForm key={`${sessionId}:${hash}`} token={hash.slice(1)}/>;
}
function JoinForm({token}:{token:string}) {
    const [invitation,setInvitation]=useState<api.ResolvedInvitation|null>(null),[error,setError]=useState('');
    const [name,setName]=useState(''),[dob,setDob]=useState(''),[card,setCard]=useState(''),[consent,setConsent]=useState(false);
    const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[revision,setRevision]=useState(0);
    const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
    useEffect(()=>{const abort=new AbortController();void api.resolveInvitation(token,abort.signal).then(setInvitation).catch(e=>{if(!abort.signal.aborted)setError(errorText(e));});return()=>abort.abort();},[token,revision]);
    return <main className="enrollment-page"><Link to="/parent">← Parent Hub</Link><h1>Join your child's squad</h1>
        {error&&<p role="alert">{error}</p>}
        {!invitation?<><p>{error?'The invitation could not be opened.':'Opening invitation…'}</p><button onClick={()=>{setError('');setRevision(v=>v+1);}}>Try again</button></>:sent?<section className="enrollment-panel" role="status"><h2>Sent to the coach</h2><p>Your child's place in {invitation.squadName} is awaiting approval. You can follow or withdraw the request in Parent Hub.</p><Link to="/parent/enrollment">View enrollment requests</Link></section>:<form className="enrollment-panel" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.requestEnrollment({requestId,token,existingCardId:card?Number(card):null,childName:name.trim(),dateOfBirth:dob,consent});setSent(true);}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>
            <h2>{invitation.squadName}</h2><p>{invitation.clubName}</p><p>Use your own verified adult account. The coach reviews your request before your child joins. Your child does not need a login.</p>
            {!!invitation.children.length&&<label>Child<select value={card} disabled={busy} onChange={e=>{setCard(e.target.value);const child=invitation.children.find(c=>c.id===Number(e.target.value));setName(child?.full_name??'');setDob(child?.date_of_birth??'');setConsent(false);setRequestId(crypto.randomUUID());}}><option value="">Add a child</option>{invitation.children.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>}
            <label>Child's full name<input required maxLength={120} value={name} disabled={busy||!!card} onChange={e=>{setName(e.target.value);setRequestId(crypto.randomUUID());}}/></label>
            <label>Date of birth<input required type="date" value={dob} disabled={busy||!!card} onChange={e=>{setDob(e.target.value);setRequestId(crypto.randomUUID());}}/></label>
            <label className="enrollment-consent"><input type="checkbox" checked={consent} required disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>I am this child's parent or legal guardian. I confirm these details and consent to their participation with {invitation.clubName} and the creation or linking of their private player card.</span></label>
            <button type="submit" disabled={busy||!consent}>{busy?'Sending…':'Send to coach'}</button><p className="enrollment-muted">Children aged 4–17. Existing cards are linked only after the academy verifies the match.</p>
        </form>}
    </main>;
}
export function FamilyEnrollmentPage(){const {sessionId}=useAuth();return <FamilyRequests key={sessionId}/>;}
function FamilyRequests(){
    const [items,setItems]=useState<api.EnrollmentRequest[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),[busy,setBusy]=useState<number|null>(null);
    useEffect(()=>{const abort=new AbortController();void api.enrollmentMine(abort.signal).then(setItems).catch(e=>{if(!abort.signal.aborted)setError(errorText(e));}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[revision]);
    return <main className="enrollment-page"><Link to="/parent">← Parent Hub</Link><h1>Enrollment requests</h1><p>Open the squad invitation your coach shared to add a child.</p><button onClick={()=>{setError('');setRevision(v=>v+1);}}>Refresh</button>{error&&<p role="alert">{error}</p>}{loading?<p role="status">Loading requests…</p>:!items.length?<EmptyState icon={UsersRound} title="No enrollment requests yet." description="Ask your coach for the squad invitation link. Open it to provide your child’s details and participation consent, then follow the coach’s decision here." action={{label:"Open Parent Hub",to:"/parent"}}/>:items.map(r=><section key={r.id} className="enrollment-panel"><h2>{r.child_name}</h2><p>{r.club_name} · {r.squad_name}</p><strong>{r.status.toLowerCase()}</strong>{r.decision_note&&<p>{r.decision_note}</p>}{r.status==='APPROVED'?<Link to={`/squads/${r.squad_id}`}>Open squad</Link>:r.status==='PENDING'&&<button disabled={busy!==null} onClick={async()=>{setBusy(r.id);setError('');try{await api.withdrawEnrollment(r.id);setRevision(v=>v+1);}catch(e){setError(errorText(e));}finally{setBusy(null);}}}>{busy===r.id?'Withdrawing…':'Withdraw request'}</button>}</section>)}</main>;
}
export function SquadEnrollmentManager({squad}:{squad:number}){
    const [data,setData]=useState<api.EnrollmentManage|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[url,setUrl]=useState(''),[days,setDays]=useState(7),[uses,setUses]=useState(50),[copy,setCopy]=useState(false);
    useEffect(()=>{const abort=new AbortController();void api.manageEnrollment(squad,abort.signal).then(setData).catch(e=>{if(!abort.signal.aborted)setError(errorText(e));});return()=>abort.abort();},[squad,revision]);
    const reload=()=>setRevision(v=>v+1);
    return <details className="enrollment-panel"><summary>Invite families & review enrollment{data?` (${data.requests.filter(r=>r.status==='PENDING').length} waiting)`:''}</summary>{error&&<p role="alert">{error}</p>}
        <p>Share an invitation in your existing parent group. Parents sign in, provide consent and request a place; your approval links the child to this squad.</p>
        <form className="enrollment-inline" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const invite=await api.createInvitation(squad,days,uses);setUrl(`${location.origin}/join-squad#${invite.token}`);setCopy(false);reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}}}><label>Valid for days<input type="number" min={1} max={30} value={days} onChange={e=>setDays(Number(e.target.value))}/></label><label>Maximum requests<input type="number" min={1} max={1000} value={uses} onChange={e=>setUses(Number(e.target.value))}/></label><button disabled={busy}>Create invitation</button></form>
        {url&&<div><label>Invitation link<input readOnly value={url} onFocus={e=>e.target.select()}/></label><button onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setCopy(true)).catch(()=>setError('Select and copy the invitation link above.'));}}>{copy?'Copied':'Copy invitation'}</button><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Join our academy squad: ${url}`)}`}>Share on WhatsApp</a><p className="enrollment-muted">Save this link now. For security it is shown only when created.</p></div>}
        {data?.invitations.filter(i=>!i.revoked_at&&new Date(i.expires_at)>new Date()).map(i=><div className="enrollment-row" key={i.id}><span>Invitation #{i.id} · {i.used_count}/{i.max_uses} requests · expires {new Date(i.expires_at).toLocaleDateString()}</span><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.revokeInvitation(squad,i.id);setUrl('');reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>Revoke</button></div>)}
        <h3>Family requests</h3>{data?.requests.length===0&&<EmptyState compact icon={MailOpen} title="No family requests yet" description="Create an invitation above and share it with families. Their requests will appear here for you to review before anyone joins the squad."/>}{data?.requests.map(r=><EnrollmentReview key={r.id} squad={squad} request={r} cards={data.unlinkedCards} onSaved={reload}/>)}
    </details>;
}
function EnrollmentReview({squad,request:r,cards,onSaved}:{squad:number;request:api.EnrollmentRequest;cards:api.EnrollmentManage['unlinkedCards'];onSaved:()=>void}){
    const [card,setCard]=useState(''),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
    const candidates=cards.filter(c=>c.full_name.toLowerCase()===r.child_name.toLowerCase()&&c.birth_year===Number(r.date_of_birth?.slice(0,4))&&c.parent_email?.toLowerCase()===r.guardian_email?.toLowerCase());
    const decide=async(approve:boolean)=>{setBusy(true);setError('');try{await api.decideEnrollment(squad,r.id,approve,card?Number(card):null,note);onSaved();}catch(e){setError(errorText(e));}finally{setBusy(false);}};
    return <section className="enrollment-review"><h4>{r.child_name} · {r.date_of_birth}</h4><p>{r.guardian_name} · {r.guardian_email}</p><p>{r.status.toLowerCase()}</p>{r.status==='PENDING'&&<>{!r.existing_card_id&&<label>Player card<select value={card} onChange={e=>setCard(e.target.value)} disabled={busy}><option value="">Create a private child card</option>{candidates.map(c=><option key={c.id} value={c.id}>Link existing: {c.full_name} (#{c.id})</option>)}</select></label>}<label>Note to family<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></label><p className="enrollment-muted">Confirm the family relationship and existing roster record before approval.</p><div className="enrollment-row"><button disabled={busy} onClick={()=>void decide(true)}>Approve & add to squad</button><button disabled={busy} onClick={()=>void decide(false)}>Decline</button></div></>}{r.decision_note&&<p>{r.decision_note}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
