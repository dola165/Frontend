import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CalendarDays, UserRoundCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { commandJoiningJourney, contactLabel, fetchJoiningJourney, saveJoiningPreferences, type JoiningJourney, type JourneyCommand } from '../../features/joining-contract/conversation';
import type { ConnectedInquiry } from '../../features/joining-contract/types';
import type { AdmissionCase, CaseCommand, Terms } from '../../features/admissions/types';
import { commandAdmission } from '../../features/admissions/api';
import { useAdmissionMutation } from '../../features/admissions/applicant/useAdmissionMutation';
import { TermsSummary } from '../../features/admissions/club/TermsSummary';
import { useInquiryCopy } from '../../features/admissions/inquiryPresentation';
import './joining-conversation.css';

type Payload=Omit<JourneyCommand,'requestId'|'expectedVersion'>;
type CasePayload=CaseCommand extends infer T ? T extends CaseCommand ? Omit<T,'requestId'|'expectedVersion'> : never : never;
const date=(value:string)=>new Date(value).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const readableSchedule=(value:string)=>value.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g,stamp=>{const time=new Date(stamp);return Number.isNaN(time.getTime())?stamp:time.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});});
function Field({label,children}:{label:string;children:ReactNode}) {return <label className="joining-field"><span>{label}</span>{children}</label>;}

export function JoiningConversationPanel({record,onChanged}:{record:ConnectedInquiry;onChanged:()=>void}) {
  const {sessionId,user}=useAuth(),{next}=useInquiryCopy();
  const [revision,setRevision]=useState(0),[open,setOpen]=useState<''|'INVITE'|'OFFER'|'HANDOFF'|'DETAILS'>('');
  const scope=`${record.id}:${record.version}:${sessionId}:${revision}`;
  const [result,setResult]=useState<{scope:string;journey:JoiningJourney|null;failed:boolean}|null>(null);
  const journey=result?.scope===scope?result.journey:null,failed=result?.scope===scope&&result.failed;
  useEffect(()=>{const abort=new AbortController();void fetchJoiningJourney(record.id,sessionId,abort.signal).then(journey=>{if(!abort.signal.aborted&&isCurrentAuthSession(sessionId))setResult({scope,journey,failed:false});}).catch(()=>{if(!abort.signal.aborted&&isCurrentAuthSession(sessionId))setResult({scope,journey:null,failed:true});});return()=>abort.abort();},[record.id,sessionId,scope]);
  const refresh=()=>{setRevision(v=>v+1);onChanged();};
  const mutation=useAdmissionMutation<Payload&{expectedVersion:number},JoiningJourney>(record.id,'conversation-action',body=>commandJoiningJourney(record.id,body,sessionId),journey=>{setResult({scope,journey,failed:false});setOpen('DETAILS');onChanged();},refresh);
  const act=(payload:Payload)=>journey&&mutation.run({...payload,expectedVersion:journey.inquiry.version});
  const pending=journey?.pendingHandler;
  return <section className="joining-conversation">
    <div className="joining-conversation-summary"><div><strong>{record.playerName||'Club question'}{journey?.squadName?` · ${journey.squadName}`:''}</strong><small>{record.organizationName}{journey?.handler?` · ${journey.handler.name}`:''}</small><p>{journey?.arrangement?.enrollment?'Place confirmed — you’re ready for training.':next(journey?.inquiry??record)}</p></div><button onClick={()=>setOpen('DETAILS')}>Details & next step</button></div>
    {journey?.canAct&&<div className="joining-actions"><button className="joining-primary" onClick={()=>setOpen('INVITE')} disabled={!record.playerId}><CalendarDays size={15}/>Invite to training</button><button onClick={()=>setOpen('OFFER')} disabled={!record.playerId}>Offer a place</button><button onClick={()=>setOpen('HANDOFF')}>Pass to a colleague</button></div>}
    {pending&&<p className="joining-notice">{pending.name} has been asked to help. {journey?.handler?.name||'Your current contact'} remains responsible.{pending.id===user?.id&&<button disabled={mutation.busy||Boolean(mutation.pending)} onClick={()=>void act({action:'ACCEPT_HANDOFF'})}>Accept handoff</button>}</p>}
    {failed&&<p role="status">Joining details could not load. <button onClick={refresh}>Try again</button></p>}
    {mutation.error&&<p role="alert">{mutation.error}</p>}{mutation.pending&&<button disabled={mutation.busy} onClick={()=>void mutation.retry()}>Recover saved action</button>}
    {open&&journey&&<JoiningDialog title={open==='INVITE'?'Invite to training':open==='OFFER'?'Offer a place':open==='HANDOFF'?'Pass to a colleague':`${record.playerName||'Club question'} · ${journey.squadName||record.organizationName}`} onClose={()=>{if(!mutation.busy)setOpen('');}}>
      {mutation.error&&<p role="alert">{mutation.error}</p>}
      {open==='INVITE'?<VisitForm journey={journey} busy={mutation.busy||Boolean(mutation.pending)} send={act}/>:open==='OFFER'?<OfferForm journey={journey} busy={mutation.busy||Boolean(mutation.pending)} send={act}/>:open==='HANDOFF'?<HandoffForm journey={journey} busy={mutation.busy||Boolean(mutation.pending)} send={act}/>:<JourneyDetails journey={journey} refresh={refresh}/>}
    </JoiningDialog>}
  </section>;
}
function JoiningDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLElement>(null),id=useId();useDialogFocus(true,ref,onClose);
  return createPortal(<div className="joining-dialog-backdrop" onClick={onClose}><section ref={ref} className="joining-dialog" role="dialog" aria-modal="true" aria-labelledby={id} onClick={e=>e.stopPropagation()}><header><h2 id={id}>{title}</h2><button aria-label="Close joining details" onClick={onClose}><X size={22}/></button></header>{children}</section></div>,document.body);
}
function VenueChoice({journey,value,onChange}:{journey:JoiningJourney;value:string;onChange:(value:string)=>void}) {
  return <Field label="Training venue"><select value={value} onChange={e=>onChange(e.target.value)}><option value="">Use the session’s location</option>{journey.context.venues.map(v=><option key={v.id} value={v.id}>{v.name} · {v.address}</option>)}</select></Field>;
}
function VisitForm({journey,busy,send}:{journey:JoiningJourney;busy:boolean;send:(p:Payload)=>unknown}) {
  const [session,setSession]=useState(String(journey.sessions[0]?.id??'')),[venue,setVenue]=useState(String(journey.preferredFacilityId??journey.context.venues[0]?.id??'')),[cost,setCost]=useState(journey.trialCost),[location,setLocation]=useState(''),[preparation,setPreparation]=useState(''),[reason,setReason]=useState('');
  const selected=journey.sessions.find(s=>s.id===Number(session)),place=journey.context.venues.find(v=>v.id===Number(venue));
  const needsReason=journey.preferredFacilityId!=null&&Number(venue)!==journey.preferredFacilityId;
  return <form onSubmit={e=>{e.preventDefault();send({action:'INVITE',squadSessionId:Number(session),facilityId:venue?Number(venue):undefined,cost,location,preparation,reason});}}><p>Invite <strong>{journey.inquiry.playerName}</strong> to an existing {journey.squadName} session. Their player card is already attached.</p><fieldset disabled={busy}>
    {journey.sessions.length?<Field label="Choose a training session"><select required value={session} onChange={e=>setSession(e.target.value)}>{journey.sessions.map(s=><option key={s.id} value={s.id}>{date(s.startsAt)} · {s.title}</option>)}</select></Field>:<p>No upcoming training sessions. <Link to={`/clubs/${journey.clubId}/workspace?tab=attendance&squad=${journey.inquiry.squadId}`}>Add a session in the squad schedule</Link>, then reopen this invitation.</p>}
    <VenueChoice journey={journey} value={venue} onChange={setVenue}/>{place?<p className="joining-notice">{place.address||'Add the venue address in club facilities before inviting.'}</p>:selected?.location?<p className="joining-notice">{selected.location}</p>:<Field label="Where should they arrive?"><input required value={location} onChange={e=>setLocation(e.target.value)}/></Field>}
    {needsReason&&<Field label="Why is their preferred venue unavailable?"><input required value={reason} onChange={e=>setReason(e.target.value)}/></Field>}
    <Field label="First visit cost"><input required value={cost} placeholder="For example: No charge" onChange={e=>setCost(e.target.value)}/></Field>
    <Field label="What to bring or who to meet (optional)"><textarea rows={2} value={preparation} onChange={e=>setPreparation(e.target.value)}/></Field>
    <p className="joining-muted">This reserves one visitor place. The player or guardian will confirm this session in this chat.</p><button className="joining-primary" disabled={!selected||Boolean(place&&!place.address)}>{busy?'Sending…':'Send training invitation'}</button>
  </fieldset></form>;
}
function OfferForm({journey,busy,send}:{journey:JoiningJourney;busy:boolean;send:(p:Payload)=>unknown}) {
  const group=journey.group;
  const [terms,setTerms]=useState<Terms>(()=>group?.terms??{feesKnown:journey.programmeFeesKnown,charges:journey.programmeCharges,cancellation:'',participation:'',startDate:new Date().toLocaleDateString('en-CA'),endDate:null,affiliationEffect:'NONE',requirements:['EMERGENCY_CONTACT']}),[schedule,setSchedule]=useState((group?.schedule?readableSchedule(group.schedule):'')||journey.sessions.slice(0,8).map(s=>`${date(s.startsAt)} – ${new Date(s.endsAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}`).join('\n')),[venue,setVenue]=useState(String(journey.preferredFacilityId??journey.context.venues[0]?.id??'')),[reason,setReason]=useState('');
  const set=(patch:Partial<Terms>)=>setTerms(t=>({...t,...patch}));
  if(!journey.managed&&group)return <form onSubmit={e=>{e.preventDefault();send({action:'OFFER',reason});}}><p>The club’s saved programme terms apply to this place.</p><TermsSummary terms={group.terms} location={group.location} schedule={readableSchedule(group.schedule)}/><Field label="Note for this offer (optional)"><input value={reason} onChange={e=>setReason(e.target.value)}/></Field><button className="joining-primary" disabled={busy}>Send offer for agreement</button></form>;
  return <form onSubmit={e=>{e.preventDefault();send({action:'OFFER',terms,schedule,facilityId:venue?Number(venue):undefined,reason});}}><p>Review the place for <strong>{journey.inquiry.playerName}</strong>. Published programme fees are filled in; only missing details need completing.</p><fieldset disabled={busy}>
    <VenueChoice journey={journey} value={venue} onChange={setVenue}/><Field label="Training schedule"><textarea required rows={3} value={schedule} onChange={e=>setSchedule(e.target.value)}/></Field>
    <div className="joining-field-grid"><Field label="Start date"><input type="date" required value={terms.startDate} onChange={e=>set({startDate:e.target.value})}/></Field><Field label="End date (optional)"><input type="date" value={terms.endDate??''} onChange={e=>set({endDate:e.target.value||null})}/></Field></div>
    <h3>Fees for this place</h3>{terms.charges.map((charge,index)=><div className="joining-charge" key={index}><Field label="Charge"><input required value={charge.label} onChange={e=>set({charges:terms.charges.map((c,i)=>i===index?{...c,label:e.target.value}:c)})}/></Field><Field label="Amount"><input type="number" min="0" step="0.01" required value={charge.amount} onChange={e=>set({charges:terms.charges.map((c,i)=>i===index?{...c,amount:Number(e.target.value)}:c)})}/></Field><Field label="Currency"><input required value={charge.currency} onChange={e=>set({charges:terms.charges.map((c,i)=>i===index?{...c,currency:e.target.value}:c)})}/></Field><Field label="Frequency"><input required value={charge.frequency} onChange={e=>set({charges:terms.charges.map((c,i)=>i===index?{...c,frequency:e.target.value}:c)})}/></Field><button type="button" aria-label={`Remove ${charge.label}`} onClick={()=>set({charges:terms.charges.filter((_,i)=>i!==index)})}>Remove</button></div>)}
    <button type="button" onClick={()=>set({charges:[...terms.charges,{label:'Training',amount:0,currency:terms.charges[0]?.currency||'GEL',frequency:'MONTH'}]})}>Add a charge</button>
    <label className="joining-check"><input type="checkbox" required checked={terms.feesKnown} onChange={e=>set({feesKnown:e.target.checked})}/>{terms.charges.length?'These are all the charges for this place.':'This place has no charges.'}</label>
    <Field label="Cancellation or leaving the group"><textarea required rows={2} placeholder="Use the club’s actual cancellation terms" value={terms.cancellation} onChange={e=>set({cancellation:e.target.value})}/></Field><Field label="Participation terms"><textarea required rows={2} placeholder="The club’s actual attendance and participation agreement" value={terms.participation} onChange={e=>set({participation:e.target.value})}/></Field>
    {journey.arrangement?.offer&&<Field label="Reason for the replacement offer"><input required value={reason} onChange={e=>setReason(e.target.value)}/></Field>}
    <label className="joining-check"><input type="checkbox" required/>I confirm a place is available for this player.</label><button className="joining-primary">{busy?'Sending…':'Send offer for agreement'}</button>
  </fieldset></form>;
}
function HandoffForm({journey,busy,send}:{journey:JoiningJourney;busy:boolean;send:(p:Payload)=>unknown}) {
  const {user}=useAuth();const [contact,setContact]=useState(''),[note,setNote]=useState('');
  if(journey.pendingHandler)return <div><p>Waiting for {journey.pendingHandler.name} to accept. The parent stays in this conversation.</p><button disabled={busy} onClick={()=>send({action:'CANCEL_HANDOFF'})}>Cancel handoff</button></div>;
  return <form onSubmit={e=>{e.preventDefault();send({action:'HANDOFF',contactId:Number(contact),internalNote:note});}}><p>The conversation and player details stay together. You remain responsible until your colleague accepts.</p><fieldset disabled={busy}><Field label="Choose a colleague"><select required value={contact} onChange={e=>setContact(e.target.value)}><option value="">Choose a colleague</option>{journey.context.contacts.filter(c=>c.id!==user?.id).map(c=><option key={c.id} value={c.id}>{contactLabel(c)}</option>)}</select></Field><Field label="Private handoff note (staff only)"><textarea maxLength={2000} rows={3} value={note} onChange={e=>setNote(e.target.value)}/></Field><button className="joining-primary">Request handoff</button></fieldset></form>;
}
function JourneyDetails({journey,refresh}:{journey:JoiningJourney;refresh:()=>void}) {
  const {sessionId}=useAuth();const [preferenceError,setPreferenceError]=useState(''),[preferences,setPreferences]=useState(journey.preferences);const preferred=journey.context.venues.find(v=>v.id===journey.preferredFacilityId);
  return <div><p>{journey.programmeName||journey.squadName||journey.inquiry.organizationName}</p>{preferred&&<p><strong>Preferred venue:</strong> {preferred.name} · {preferred.address}</p>}{journey.privateHandoffNote&&<p className="joining-notice"><strong>Private staff note:</strong> {journey.privateHandoffNote}</p>}
    {journey.arrangement?<Arrangement record={journey.arrangement} staff={journey.staff} refresh={refresh}/>:<p>{journey.staff?'Reply in the chat, or choose Invite to training to arrange the first visit.':'Your message is with the club. Their reply and any training invitation will appear here.'}</p>}
    {!journey.inquiry.playerId&&<Link to={journey.inquiry.applicantDestination}>Attach your player card</Link>}
    {journey.staff&&preferences&&<details><summary>Your contact availability</summary>{(['sharePresence','busy'] as const).map(key=><label className="joining-check" key={key}><input type="checkbox" checked={preferences[key]} onChange={e=>{const value={...preferences,[key]:e.target.checked};void saveJoiningPreferences(value,sessionId).then(setPreferences).catch(()=>setPreferenceError('Availability could not be saved. Try again.'));}}/>{key==='sharePresence'?'Show when I am online to people contacting the club':'I am busy right now'}</label>)}{preferenceError&&<p role="alert">{preferenceError}</p>}</details>}
    <details><summary>History & advanced actions</summary><p><Link to={`${journey.staff?journey.inquiry.staffDestination:journey.inquiry.applicantDestination}${(journey.staff?journey.inquiry.staffDestination:journey.inquiry.applicantDestination).includes('?')?'&':'?'}details=1`}>Open the full joining record</Link></p>{journey.inquiry.history.map(event=><p key={event.id}><small>{date(event.createdAt)} · {event.actorName}</small><br/>{event.message||event.action.toLowerCase().replaceAll('_',' ')}</p>)}</details>
  </div>;
}
function Arrangement({record,staff,refresh}:{record:AdmissionCase;staff:boolean;refresh:()=>void}) {
  const {sessionId}=useAuth(),[emergency,setEmergency]=useState('');
  const mutation=useAdmissionMutation<CasePayload&{expectedVersion:number},AdmissionCase>(record.id,'conversation-case',body=>commandAdmission(record.id,body as CaseCommand,sessionId),()=>refresh(),refresh);
  const execute=(payload:CasePayload)=>mutation.run({...payload,expectedVersion:record.version});const busy=mutation.busy||Boolean(mutation.pending);
  return <div className="joining-arrangement">{mutation.error&&<p role="alert">{mutation.error}</p>}{mutation.pending&&<button disabled={mutation.busy} onClick={()=>void mutation.retry()}>Recover saved response</button>}
    {record.enrollment&&<div className="joining-success"><UserRoundCheck/><h3>You’re in {record.enrollment.groupName}</h3><Link to={record.enrollment.scheduleDestination}>Open training schedule</Link></div>}
    {record.sessions.map(session=><article key={session.id}><h3>{session.title} · {session.status.toLowerCase().replaceAll('_',' ')}</h3><p>{date(session.startsAt)}<br/>{session.location.name} · {session.location.address}<br/>{session.contact} · {session.cost}</p>{session.preparation&&<p>{session.preparation}</p>}{['INVITED','RECONFIRM_REQUIRED'].includes(session.status)&&!staff&&<form onSubmit={e=>{e.preventDefault();void execute({action:'CONFIRM_SESSION',participationId:session.id,participationVersion:session.version,acceptTerms:true,emergencyContact:emergency});}}><fieldset disabled={busy}><Field label="Emergency contact"><input required value={emergency} onChange={e=>setEmergency(e.target.value)}/></Field><label className="joining-check"><input required type="checkbox"/>I agree to this session and its cost for {record.playerName}.</label><button className="joining-primary">Confirm training visit</button></fieldset></form>}{staff&&session.status==='CONFIRMED'&&record.actions.includes('RECORD_ATTENDANCE')&&<button disabled={busy} onClick={()=>void execute({action:'RECORD_ATTENDANCE',participationId:session.id,participationVersion:session.version,attendance:'ATTENDED'})}>Mark attended</button>}</article>)}
    {record.offer&&<article><h3>{record.offer.status==='PENDING'?'Your place is ready to review':'Place offer'} · {record.offer.groupName}</h3><TermsSummary terms={record.offer.terms} location={record.offer.location} schedule={readableSchedule(record.offer.schedule)}/>{!staff&&record.offer.status==='PENDING'&&<form onSubmit={e=>{e.preventDefault();void execute({action:'ACCEPT_OFFER',offerId:record.offer!.id,offerVersion:record.offer!.version,acceptTerms:true,emergencyContact:emergency});}}><fieldset disabled={busy}><Field label="Emergency contact"><input required value={emergency} onChange={e=>setEmergency(e.target.value)}/></Field><label className="joining-check"><input type="checkbox" required/>I agree to these fees and participation terms for {record.playerName}.</label><button className="joining-primary">Accept this place</button></fieldset></form>}</article>}
    {record.requirements.filter(r=>r.status==='PENDING').map(r=><p className="joining-notice" key={r.id}>{r.kind.toLowerCase().replaceAll('_',' ')} · {r.owner.toLowerCase().replaceAll('_',' ')} to complete</p>)}
  </div>;
}
