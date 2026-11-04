import { FolderHeart } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { RecordFacts } from '../../components/ui/RecordFacts';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, root, label, type Choice } from './api';
import { FamilyMoneyConnections } from './money/FamilyMoneyConnections';
import { getAuthSessionId } from '../../utils/authStorage';

interface Connection { club_id:number; club_name:string; user_id:number; name:string }
interface Shared { id:number; club_id:number; club_name:string; person_name:string; kind:string; title:string; status:string; data:Record<string,string>; canFeedback:boolean; feedback:{note:string;author:string;created_at:string}[] }
interface Family { connections:Connection[]; concernConnections?:Connection[]; shared:Shared[]; schedule:{id:number;title:string;person_name:string;squad_name:string;starts_at:string;location_name:string;status:string}[]; reports:{id:number;club_name:string;status:string;created_at:string;received_by:ReceiverKind;receiver_name:string|null;grass_kick_z:boolean}[] }
type ReceiverKind='OFFICER'|'OWNER'|'GRASSKICKZ';
type Copy=(en:string,ka:string)=>string;
/** Who a concern reaches, in words the family can act on: told before they write and again after. */
const receiverWords=(kind:ReceiverKind,name:string|null,copy:Copy)=>
  kind==='OFFICER'?copy(`${name}, the club’s welfare officer`,`${name}, კლუბის ბავშვთა დაცვის ოფიცერი`)
  :kind==='OWNER'?copy(`${name}, the club’s owner, because no welfare officer is named`,`${name}, კლუბის მფლობელი, რადგან ბავშვთა დაცვის ოფიცერი დანიშნული არ არის`)
  :copy('GrassKickZ’s team','GrassKickZ-ის გუნდი');

export function FamilyClubWork({staffClubs}:{staffClubs:Choice[]}) {
  return <FamilyClubWorkSession key={getAuthSessionId()} staffClubs={staffClubs}/>;
}
function FamilyClubWorkSession({staffClubs}:{staffClubs:Choice[]}) {
  const copy=useJourneyCopy();const [params]=useSearchParams();
  const [family,setFamily]=useState<Family|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [action,setAction]=useState<'absence'|'concern'|null>(params.get('concern')==='1'?'concern':null),[connection,setConnection]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [receiver,setReceiver]=useState<{kind:ReceiverKind;name:string|null}|null>(null),[aboutReceiver,setAboutReceiver]=useState(false);
  // A concern opened from a child's page starts on that child.
  // A parent's no closes the rest of a club, not this: the no may have been because of the concern.
  const concernList=useMemo(()=>family?.concernConnections??family?.connections??[],[family]);
  useEffect(()=>{if(params.get('concern')!=='1'||!family||connection)return;const player=Number(params.get('player'));const mine=concernList.find(c=>c.user_id===player)??(concernList.length===1?concernList[0]:null);if(mine)setConnection(`${mine.club_id}:${mine.user_id}`);},[family,concernList,params,connection]);
  useEffect(()=>{setAboutReceiver(false);if(action!=='concern'||!connection){setReceiver(null);return;}const c=new AbortController();void get<{kind:ReceiverKind;name:string|null}>(`${root(Number(connection.split(':')[0]))}/concerns/receiver`,c.signal).then(r=>{if(!c.signal.aborted)setReceiver(r);}).catch(()=>{if(!c.signal.aborted)setReceiver(null);});return()=>c.abort();},[action,connection]);
  useEffect(()=>{const c=new AbortController();void get<Family>('/club-operations/family',c.signal).then(r=>{if(!c.signal.aborted)setFamily(r);}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load shared club records.'));});return()=>c.abort();},[refresh]);
  const save=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;const form=new FormData(e.currentTarget);const [club,person]=connection.split(':').map(Number);setBusy(true);setError('');setMessage('');
    try {
      if(action==='concern'){
        const receipt=await post<{receivedBy:ReceiverKind;receiverName:string|null;grassKickZ:boolean}>(`${root(club)}/concerns`,{subjectUserId:person||null,description:form.get('description'),immediateAction:form.get('immediateAction'),aboutReceiver});
        setMessage(copy(`Sent. It went to ${receiverWords(receipt.receivedBy,receipt.receiverName,copy)}.${receipt.grassKickZ&&receipt.receivedBy!=='GRASSKICKZ'?' GrassKickZ’s team has it too.':''}`,`გაიგზავნა. მიიღო: ${receiverWords(receipt.receivedBy,receipt.receiverName,copy)}.${receipt.grassKickZ&&receipt.receivedBy!=='GRASSKICKZ'?' ის GrassKickZ-ის გუნდსაც აქვს.':''}`));
      }else{
        await post(`${root(club)}/education-absences`,{subjectUserId:person,startsOn:form.get('startsOn'),endsOn:form.get('endsOn'),reason:form.get('reason'),notes:form.get('notes')});
        setMessage('The education absence has been recorded for the club.');
      }
      setAction(null);setRefresh(v=>v+1);
    }catch(e){setError(extractApiErrorMessage(e,copy('Could not save. Your entry is still here.','ვერ შეინახა. ტექსტი ისევ აქ არის.')));}finally{setBusy(false);}
  };
  const hasFamilyWork=Boolean(family&&(family.connections.length||family.shared.length||family.schedule.length));
  if(family&&!hasFamilyWork&&!concernList.length&&!family.reports.length&&!staffClubs.length&&!error)return null;
  return <section className="ops-editor connections-section">
    <div className="ops-toolbar"><div><h2>{hasFamilyWork?'Player & family records':'Club support'}</h2><p className="ops-muted">{hasFamilyWork?'Shared development work, upcoming squad activities and club administration.':copy('Raise a confidential concern with your club.','კონფიდენციალურად შეატყობინეთ კლუბს.')}</p></div><div className="ops-row">
      {!!family?.connections.length&&<button onClick={()=>{setAction('absence');setConnection('');}}>Report education absence</button>}
      {(!!concernList.length||!!staffClubs.length)&&<button onClick={()=>{setAction('concern');setConnection('');}}>{copy('Raise a concern','შეტყობინება')}</button>}
    </div></div>
    {error&&<p role="alert" className="ops-alert">{error}<button onClick={()=>{setError('');setRefresh(v=>v+1);}}>Retry</button></p>}
    {message&&<p role="status">{message}</p>}
    {action&&<form className="ops-card ops-editor" onSubmit={e=>{void save(e);}}><h3>{action==='concern'?copy('Confidential concern','კონფიდენციალური შეტყობინება'):'Education absence'}</h3><fieldset disabled={busy}><div className="ops-form-grid">
      <label className="ops-wide">{copy('Club and person','კლუბი და ადამიანი')}<select required value={connection} onChange={e=>setConnection(e.target.value)}><option value="">{copy('Choose…','აირჩიეთ…')}</option>{(action==='concern'?concernList:family?.connections??[]).map(c=><option key={`${c.club_id}:${c.user_id}`} value={`${c.club_id}:${c.user_id}`}>{c.name} · {c.club_name}</option>)}{action==='concern'&&staffClubs.map(c=><option key={`staff:${c.id}`} value={`${c.id}:0`}>As club staff · {c.name}</option>)}</select></label>
      {action==='concern'?<><label className="ops-wide">{copy('What happened?','რა მოხდა?')}<textarea name="description" required maxLength={4000} rows={5}/></label><label className="ops-wide">{copy('Already done','უკვე გაკეთდა')} <span className="ops-muted">{copy('Optional','არასავალდებულო')}</span><textarea name="immediateAction" maxLength={4000}/></label>
        {receiver&&<p className="ops-wide" role="status">{copy(`It goes to ${receiverWords(receiver.kind,receiver.name,copy)}.`,`მიიღებს: ${receiverWords(receiver.kind,receiver.name,copy)}.`)}</p>}
        {receiver&&receiver.name&&<label className="ops-wide"><input type="checkbox" checked={aboutReceiver} onChange={e=>setAboutReceiver(e.target.checked)}/> {copy(`It’s about ${receiver.name}. Don’t send it to them.`,`ეს ეხება: ${receiver.name}. მას არ გაეგზავნოს.`)}</label>}
        <p className="ops-muted ops-wide">{copy('This is not an emergency service. If someone is in danger now, call for help first.','ეს სასწრაფო სამსახური არ არის. თუ ვინმე ახლა საფრთხეშია, ჯერ დარეკეთ დახმარებისთვის.')}</p></>:<><label>First day<input name="startsOn" type="date" required/></label><label>Last day<input name="endsOn" type="date" required/></label><label>Reason<select name="reason" required>{['EXAMS','SCHOOL','STUDY','OTHER'].map(r=><option key={r} value={r}>{label(r)}</option>)}</select></label><label className="ops-wide">Scheduling information <span className="ops-muted">Optional</span><textarea name="notes" maxLength={4000}/></label></>}
    </div><div className="ops-footer"><button className="ops-primary" disabled={busy}>{busy?'Sending…':'Send'}</button><button type="button" onClick={()=>setAction(null)}>Cancel</button></div></fieldset></form>}
    {family&&<>
      <FamilyMoneyConnections connections={family.connections} revision={refresh}/>
      {family.schedule.length>0&&<details className="ops-card ops-editor"><summary>Combined squad schedule ({family.schedule.length})</summary>{family.schedule.map((e,i)=><div className="ops-history" key={`${e.id}-${i}`}><strong>{e.title}</strong><p>{e.person_name} · {e.squad_name}</p><p className="ops-muted">{new Date(e.starts_at).toLocaleString()} · {e.location_name} · {label(e.status)}</p></div>)}</details>}
      <div className="ops-grid ops-editor">{family.shared.filter(r=>r.kind!=='INSTALMENT').map(r=><article className="ops-card" key={r.id}><span className="ops-badge">{label(r.status)}</span><h3>{r.title}</h3><p className="ops-muted">{r.person_name} · {r.club_name}</p><RecordFacts items={Object.entries(r.data).map(([key,value])=>({label:label(key.replace(/([A-Z])/g,'_$1').toUpperCase()),value}))}/>{r.canFeedback&&<Feedback record={r} onSaved={()=>setRefresh(v=>v+1)}/>}<details><summary>Player and guardian feedback ({r.feedback.length})</summary>{r.feedback.map((f,i)=><div className="ops-history" key={i}><p>{f.note}</p><p className="ops-muted">{f.author} · {new Date(f.created_at).toLocaleString()}</p></div>)}</details></article>)}</div>
      {hasFamilyWork&&!family.shared.length&&<EmptyState compact icon={FolderHeart} title="Shared records will appear when your club adds them." description="Development plans and club records shared with you or your child stay together here. You can read updates and respond when feedback is requested."/>}
      {family.reports.length>0&&<details className="ops-card ops-editor"><summary>{copy('Concerns you raised','თქვენი შეტყობინებები')}</summary>{family.reports.map(r=><p key={r.id}>{r.club_name} · {new Date(r.created_at).toLocaleDateString()} · {label(r.status)} · {copy('Received by ','მიიღო: ')}{receiverWords(r.received_by,r.receiver_name,copy)}{r.grass_kick_z&&r.received_by!=='GRASSKICKZ'?copy(' · GrassKickZ too',' · GrassKickZ-მაც'):''}</p>)}</details>}
    </>}
  </section>;
}
function Feedback({record,onSaved}:{record:Shared;onSaved:()=>void}) {
  const [note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await post(`${root(record.club_id)}/records/${record.id}/feedback`,{note});setNote('');onSaved();}catch(e){setError(extractApiErrorMessage(e,'Could not add feedback.'));}finally{setBusy(false);}};
  return <form className="ops-editor" onSubmit={e=>{void submit(e);}}><label>Your feedback<textarea required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Share feedback with the club'}</button></form>;
}
