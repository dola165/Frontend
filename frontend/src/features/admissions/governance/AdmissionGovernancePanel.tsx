import { useCallback, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useAdmissionData } from '../applicant/useAdmissionData';
import { countries, governanceGet, useGovernanceWrite, type Capability, type Category, type Reviewer, type GuardianItem, type GuardianDetail, type PrivacyItem, type RetentionItem, type RetentionPreview } from './api';
import '../applicant/applicant.css';
import './governance.css';

const root='/admin/admissions';
const categories:Record<Category,string>={CASE_NOTES:'Case notes and identity snapshots',SESSION_CONTACTS:'Session emergency contacts',EVIDENCE:'Permission and agreement evidence',DURABLE_RECORD:'Durable agreements, attendance and audit'};
const errorView=(message:string)=>message?<p role="alert">{message}</p>:null;

export function AdmissionGovernancePanel() {
    const {sessionId,user}=useAuth();const [tab,setTab]=useState<'appointments'|'guardians'|'privacy'|'retention'>('appointments');
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<Reviewer[]>(`${root}/reviewers`,sessionId,signal),[sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    const can=(capability:Capability)=>state.data?.some(r=>r.userId===user?.id&&r.capability===capability&&r.active);
    return <section className="admission-governance admission-stack"><h2>Admission safeguarding and privacy</h2>
        <p>Separate appointments control access to these work queues. Club authority and family links do not grant review rights. Conflicts of interest are excluded.</p>
        <nav aria-label="Admission governance"><button className="admission-button" aria-pressed={tab==='appointments'} onClick={()=>setTab('appointments')}>Reviewer appointments</button>{can('GUARDIAN_REVIEWER')&&<button className="admission-button" aria-pressed={tab==='guardians'} onClick={()=>setTab('guardians')}>Guardian reviews</button>}{can('PRIVACY_REVIEWER')&&<><button className="admission-button" aria-pressed={tab==='privacy'} onClick={()=>setTab('privacy')}>Privacy requests</button><button className="admission-button" aria-pressed={tab==='retention'} onClick={()=>setTab('retention')}>Retention reviews</button></>}</nav>
        {state.error?errorView(state.error):state.data&&<>{tab==='appointments'?<Appointments rows={state.data} onSaved={state.setData}/>:tab==='guardians'&&can('GUARDIAN_REVIEWER')?<GuardianQueue/>:tab==='privacy'&&can('PRIVACY_REVIEWER')?<PrivacyQueue/>:tab==='retention'&&can('PRIVACY_REVIEWER')?<RetentionQueue/>:<p>Your current appointment does not permit this queue.</p>}</>}
        <button className="admission-button" disabled={state.loading} onClick={state.refresh}>Refresh appointments</button>
    </section>;
}

function Appointments({rows,onSaved}:{rows:Reviewer[];onSaved:(rows:Reviewer[])=>void}) {
    const [person,setPerson]=useState(''),[capability,setCapability]=useState<Capability>('GUARDIAN_REVIEWER'),[active,setActive]=useState(true),[reference,setReference]=useState('');
    const write=useGovernanceWrite<Reviewer[]>(onSaved);
    const existing=rows.find(r=>r.userId===Number(person)&&r.capability===capability);
    return <div className="admission-panel admission-stack"><h3>Appoint or revoke a reviewer</h3><p>Appoint only an active, verified adult system administrator with the assigned operational responsibility. Use a policy or appointment reference, without personal allegations or document numbers.</p>
        <form onSubmit={e=>{e.preventDefault();write.submit(`${root}/reviewers/${person}/${capability}`,{expectedVersion:existing?.version??0,active,policyReference:reference.trim()});}}><fieldset disabled={write.pending||write.busy}>
            <label>Administrator account ID<input type="number" required min={1} step={1} value={person} onChange={e=>setPerson(e.target.value)}/></label>
            <label>Responsibility<select value={capability} onChange={e=>setCapability(e.target.value as Capability)}><option value="GUARDIAN_REVIEWER">Guardian reviewer</option><option value="PRIVACY_REVIEWER">Privacy reviewer</option></select></label>
            <label>Appointment or policy reference<input required maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
            <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Appointment active</label>
            <button className="admission-button" type="submit">Save appointment</button></fieldset>
            {write.pending&&<button className="admission-button" type="button" disabled={write.busy} onClick={()=>void write.retry()}>Retry same appointment</button>}{errorView(write.error)}
        </form>
        <ul>{rows.map(r=><li key={`${r.userId}:${r.capability}`}><strong>{r.name} · #{r.userId}</strong> — {r.capability==='GUARDIAN_REVIEWER'?'Guardian review':'Privacy review'} · {r.active?'Active':'Revoked'} <button className="admission-button" onClick={()=>{setPerson(String(r.userId));setCapability(r.capability);setActive(r.active);setReference(r.policyReference);}}>Edit appointment</button></li>)}</ul>{!rows.length&&<p>No reviewers have been appointed. New reports remain restricted until an eligible independent reviewer is appointed.</p>}
    </div>;
}

function Pager({after,last,full,onPage}:{after:number;last?:number;full:boolean;onPage:(n:number)=>void}) {
    return <div className="admission-inline">{after>0&&<button className="admission-button" onClick={()=>onPage(0)}>First page</button>}{full&&last!==undefined&&<button className="admission-button" onClick={()=>onPage(last)}>Next page</button>}</div>;
}

function GuardianQueue() {
    const {sessionId}=useAuth();const [after,setAfter]=useState(0),[selected,setSelected]=useState<number|null>(null);
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<GuardianItem[]>(`${root}/guardian-reviews?after=${after}`,sessionId,signal),[after,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    if(state.error)return <>{errorView(state.error)}<button className="admission-button" onClick={state.refresh}>Reload current authority</button></>;
    return <div className="admission-stack"><h3>Guardian reviews</h3><p>For imminent attendance or collection, coordinate directly with the club's responsible safeguarding contact. This queue does not authorize collection or determine custody.</p>
        <ul>{state.data?.map(r=><li key={r.playerId}>Player #{r.playerId} · Reported {new Date(r.reportedAt).toLocaleString()} <button className="admission-button" onClick={()=>setSelected(r.playerId)}>Review report</button></li>)}</ul>{state.data?.length===0&&<p>No eligible open reports on this page.</p>}
        <Pager after={after} last={state.data?.at(-1)?.playerId} full={state.data?.length===50} onPage={n=>{setAfter(n);setSelected(null);}}/>
        <button className="admission-button" onClick={state.refresh}>Refresh reports</button>
        {selected!==null&&<GuardianReview key={selected} player={selected} onChanged={state.refresh}/>}
    </div>;
}

function GuardianReview({player,onChanged}:{player:number;onChanged:()=>void}) {
    const {sessionId}=useAuth();const [outcome,setOutcome]=useState('KEEP_RESTRICTION'),[basis,setBasis]=useState('UNRESOLVED'),[reference,setReference]=useState(''),[checked,setChecked]=useState(false);
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<GuardianDetail>(`${root}/guardian-reviews/${player}`,sessionId,signal),[player,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    const write=useGovernanceWrite<GuardianDetail>(result=>{state.setData(result);setChecked(false);onChanged();});
    if(state.error)return errorView(state.error);
    if(!state.data)return <p role="status">Loading private review…</p>;
    const r=state.data;
    return <section className="admission-panel admission-stack"><h3>Private report · Player #{player}</h3><p>{r.reason}</p><p>Current guardian account IDs: {r.currentGuardianIds.join(', ')||'None'}</p><p>Current status: {r.status.status}. A decision does not add a family link or revive revoked consent.</p>
        {r.status.status==='REVIEW'&&<form onSubmit={e=>{e.preventDefault();write.submit(`${root}/guardian-reviews/${player}/decisions`,{expectedVersion:r.status.version,outcome,basis,evidenceReference:reference.trim()});}}><fieldset disabled={write.pending||write.busy}>
            <label>Outcome<select value={outcome} onChange={e=>{setOutcome(e.target.value);setBasis(e.target.value==='KEEP_RESTRICTION'?'UNRESOLVED':'EXISTING_AUTHORITY_CONFIRMED');setChecked(false);}}><option value="KEEP_RESTRICTION">Keep restriction</option><option value="LIFT_RESTRICTION">Lift restriction after verification</option></select></label>
            {outcome==='LIFT_RESTRICTION'&&<label>Corroborated basis<select value={basis} onChange={e=>setBasis(e.target.value)}><option value="EXISTING_AUTHORITY_CONFIRMED">Existing authority confirmed</option><option value="CORRECTED_REPORT">Report corrected and corroborated</option><option value="AUTHORITATIVE_INSTRUCTION">Applicable authoritative instruction checked</option></select></label>}
            <label>Controlled support record reference<input required maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
            <p>No document uploads, custody allegations or identity-document numbers here. Keep conflicting legal claims restricted and obtain appropriate authoritative instructions.</p>
            <label><input type="checkbox" required checked={checked} onChange={e=>setChecked(e.target.checked)}/> I reviewed current authority and the controlled evidence, checked for conflicts, and documented the basis and any urgent arrangements.</label>
            <button className="admission-button" type="submit" disabled={!checked}>Record decision</button></fieldset>{write.pending&&<button className="admission-button" type="button" disabled={write.busy} onClick={()=>void write.retry()}>Retry same decision</button>}{errorView(write.error)}</form>}
        <button className="admission-button" onClick={state.refresh}>Reload latest report</button>
        <ol>{r.decisions.map(d=><li key={d.id}>Report version {d.reportVersion} · {d.outcome==='LIFT_RESTRICTION'?'Pause lifted':'Restriction kept'} · Reviewer #{d.reviewerId} · {d.evidenceReference}</li>)}</ol>
    </section>;
}

function PrivacyQueue() {
    const {sessionId}=useAuth();const [after,setAfter]=useState(0);
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<PrivacyItem[]>(`${root}/privacy-requests?after=${after}`,sessionId,signal),[after,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    return <div className="admission-stack"><h3>Privacy requests</h3><p>Check the applicable legal deadline and current recipient authority. The displayed two-day target is an internal initial-response target. Arrange evidence or disclosures through the controlled support channel.</p>
        {state.error?errorView(state.error):state.data?.map(item=><PrivacyResponse key={item.id} item={item} onSaved={state.refresh}/>)}{state.data?.length===0&&<p>No eligible open requests on this page.</p>}
        <Pager after={after} last={state.data?.at(-1)?.id} full={state.data?.length===50} onPage={setAfter}/><button className="admission-button" onClick={state.refresh}>Refresh privacy requests</button>
    </div>;
}

function PrivacyResponse({item,onSaved}:{item:PrivacyItem;onSaved:()=>void}) {
    const [response,setResponse]=useState('');const write=useGovernanceWrite<PrivacyItem>(onSaved);
    return <section className="admission-panel admission-stack"><h4>Request #{item.id} · Case #{item.caseId} · {item.kind} · {item.country}</h4><p>{item.message}</p><p>Initial-response target: {new Date(item.targetAt).toLocaleString()}</p>
        <form onSubmit={e=>{e.preventDefault();write.submit(`${root}/privacy-requests/${item.id}/response`,{expectedVersion:item.version,response:response.trim()});}}><fieldset disabled={write.pending||write.busy}>
            <label>Response to the requesting person<textarea required maxLength={4000} value={response} onChange={e=>setResponse(e.target.value)}/></label><p>Record what was actually provided, corrected, restricted or removed; identify anything retained and its basis, outstanding work, and the route to contest the decision. Do not include other people's private information. This records a response; it does not perform external disclosure or erase an account.</p><button className="admission-button" type="submit" disabled={!response.trim()}>Record response</button></fieldset>{write.pending&&<button className="admission-button" type="button" disabled={write.busy} onClick={()=>void write.retry()}>Retry same response</button>}{errorView(write.error)}</form>
    </section>;
}

function RetentionQueue() {
    const {sessionId}=useAuth();const [after,setAfter]=useState(0),[selected,setSelected]=useState<number|null>(null),[caseId,setCaseId]=useState('');
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<RetentionItem[]>(`${root}/retention?after=${after}`,sessionId,signal),[after,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    return <div className="admission-stack"><h3>Retention reviews</h3><p>Closed cases with unreviewed categories or due reviews. No automatic deletion period is assumed. Holds and ongoing arrangements block minimisation.</p>
        {state.error?errorView(state.error):<ul>{state.data?.map(r=><li key={r.caseId}>Case #{r.caseId} · Player #{r.playerId} · {r.nextReview||'Unreviewed'} <button className="admission-button" onClick={()=>setSelected(r.caseId)}>Review retention</button></li>)}</ul>}
        <Pager after={after} last={state.data?.at(-1)?.caseId} full={state.data?.length===50} onPage={n=>{setAfter(n);setSelected(null);}}/><button className="admission-button" onClick={state.refresh}>Refresh retention queue</button>
        <form className="admission-inline" onSubmit={e=>{e.preventDefault();setSelected(Number(caseId));}}><label>Open a specific case to review or record a hold<input type="number" required min={1} step={1} value={caseId} onChange={e=>setCaseId(e.target.value)}/></label><button className="admission-button">Open retention record</button></form>
        {selected!==null&&<RetentionCase key={selected} id={selected} onChanged={state.refresh}/>}
    </div>;
}

function RetentionCase({id,onChanged}:{id:number;onChanged:()=>void}) {
    const [category,setCategory]=useState<Category>('CASE_NOTES');
    return <section className="admission-panel admission-stack"><h3>Case #{id} retention</h3><label>Category<select value={category} onChange={e=>setCategory(e.target.value as Category)}>{Object.entries(categories).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><RetentionCategory key={category} id={id} category={category} onChanged={onChanged}/></section>;
}

function RetentionCategory({id,category,onChanged}:{id:number;category:Category;onChanged:()=>void}) {
    const {sessionId}=useAuth();const [country,setCountry]=useState(''),[purpose,setPurpose]=useState(''),[reference,setReference]=useState(''),[hold,setHold]=useState(false),[date,setDate]=useState(''),[confirmed,setConfirmed]=useState(false);
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<RetentionPreview>(`${root}/retention/${id}/${category}`,sessionId,signal),[id,category,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    const write=useGovernanceWrite<RetentionPreview>(result=>{state.setData(result);setConfirmed(false);onChanged();});
    if(state.error)return errorView(state.error);
    if(!state.data)return <p role="status">Loading retention preview…</p>;
    const p=state.data,r=p.review;
    return <div className="admission-stack"><p>{r.version?`Recorded purpose: ${r.purpose}. Policy: ${r.policyReference}. Country: ${r.country}. Next review: ${r.nextReview}. ${r.hold?'HOLD ACTIVE.':''}`:'No purpose or retention review recorded.'}</p>
        {!r.minimizedAt&&<form onSubmit={e=>{e.preventDefault();write.submit(`${root}/retention/${id}/${category}/review`,{expectedVersion:r.version,country,purpose:purpose.trim(),policyReference:reference.trim(),hold,nextReview:date});}}><fieldset disabled={write.pending||write.busy}>
            <label>Applicable country<select required value={country} onChange={e=>setCountry(e.target.value)}><option value="">Select country</option>{countries.map(c=><option value={c} key={c}>{new Intl.DisplayNames(['en'],{type:'region'}).of(c)}</option>)}</select></label>
            <label>Purpose, legal basis and reason for continuing retention or minimisation<textarea required maxLength={1000} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label>
            <label>Approved policy or case decision reference<input required maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
            <label>Next review date (within one year)<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
            <label><input type="checkbox" checked={hold} onChange={e=>setHold(e.target.checked)}/> Retention hold — document the reason above. A durable-record hold covers the entire case.</label>
            <button className="admission-button" type="submit">Record retention review</button></fieldset></form>}
        <h4>Minimisation preview</h4><dl className="admission-details">{Object.entries(p.copies).map(([label,count])=><div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
        <p>Only the listed supplemental copies are removed. Account identity, family links, agreement snapshots, attendance, command receipts, other club records and backups are not erased or anonymised by this operation.</p>
        {p.blockers.length>0?<ul>{p.blockers.map(b=><li key={b}>{b}</li>)}</ul>:<><label><input type="checkbox" checked={confirmed} disabled={write.pending} onChange={e=>setConfirmed(e.target.checked)}/> I checked this preview and the actual policy. Permanently minimise the listed copies.</label><button className="admission-button" disabled={!confirmed||write.pending||write.busy} onClick={()=>write.submit(`${root}/retention/${id}/${category}/minimize`,{expectedVersion:r.version,expectedCaseVersion:p.caseVersion,previewHash:p.previewHash})}>Minimise listed copies</button></>}
        {write.pending&&<button className="admission-button" disabled={write.busy} onClick={()=>void write.retry()}>Retry same operation</button>}{errorView(write.error)}<button className="admission-button" onClick={()=>{setConfirmed(false);state.refresh();}}>Refresh preview and holds</button>
    </div>;
}
