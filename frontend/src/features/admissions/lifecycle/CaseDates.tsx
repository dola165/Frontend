import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { commandLifecycleDates, fetchLifecycleDates, fetchAdmissionCase } from '../api';
import type { AdmissionCase, LifecycleDates, LifecycleDateCommand, Opportunity } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import { useAdmissionCopy } from '../applicant/copy';
import { useDurableMutation } from '../club/useDurableMutation';
import { extractApiErrorMessage } from '../../../utils/apiError';
import './case-dates.css';

type CaseDateProps={record:AdmissionCase;sessionId:AuthSessionId;groups?:Opportunity[];onChanged:(value:AdmissionCase)=>void};
export function CaseDates(props:CaseDateProps) {
  return <ScopedCaseDates key={props.sessionId+":"+props.record.id+":"+props.record.version} {...props}/>;
}
function ScopedCaseDates({record,sessionId,groups=[],onChanged}:CaseDateProps) {
  const {copy}=useAdmissionCopy();const [dates,setDates]=useState<LifecycleDates|null>(null),[loadError,setLoadError]=useState(''),[date,setDate]=useState(''),[reason,setReason]=useState(''),[groupId,setGroupId]=useState('');
  const mutation=useDurableMutation(`lifecycle:${sessionId}:${record.organizationId}:${record.id}`);
  useEffect(()=>{const abort=new AbortController();fetchLifecycleDates(record.id,sessionId,abort.signal).then(value=>{if(!abort.signal.aborted)setDates(value);}).catch(error=>{if(!abort.signal.aborted)setLoadError(extractApiErrorMessage(error,copy('Could not load current dates. Refresh this case.','მიმდინარე თარიღები ვერ ჩაიტვირთა. განაახლეთ საქმე.')));});return()=>abort.abort();},[record.id,record.version,sessionId,copy]);
  const operation=(body:LifecycleDateCommand)=>commandLifecycleDates(record.id,body,sessionId);
  const apply=async(value:LifecycleDates|null)=>{if(value){setDates(value);setReason('');try{onChanged(await fetchAdmissionCase(record.id,sessionId));}catch{setLoadError(copy('The arrangement was saved. Refresh this case to load its current receipt.','შეთანხმება შენახულია. მიმდინარე ქვითრის ჩასატვირთად განაახლეთ საქმე.'));}}};
  const send=(action:LifecycleDateCommand['action'])=>{if(!dates)return;const group=groups.find(g=>g.id===Number(groupId));void mutation.send<LifecycleDates,LifecycleDateCommand>({expectedVersion:dates.caseVersion,action,reason,...(date?{date}:{}),...(action==='PROPOSE_SEASON'&&group?{groupId:group.id,groupVersion:group.version}:{})},operation).then(apply);};
  const allowed=(action:LifecycleDateCommand['action'])=>dates?.actions.includes(action);
  const disabled=mutation.busy||Boolean(mutation.pending);
  const formatted=(value:string,tz:string)=>`${new Date(value).toLocaleString(undefined,{timeZone:tz})} (${tz})`;
  if(loadError)return <p role="alert" className="admission-error">{loadError}</p>;
  if(!dates)return null;
  return <section className="admission-dates" aria-label={copy('Review, departure and next intake','განხილვა, გასვლა და შემდეგი მიღება')}>
    <h2>{copy('Dates and next intake','თარიღები და შემდეგი მიღება')}</h2>
    {mutation.error&&<p role="alert">{mutation.error}</p>}
    {mutation.pending&&<p role="status">{copy('The response is uncertain. Retry the same recorded arrangement.','პასუხი გაურკვეველია. გაიმეორეთ იგივე დაფიქსირებული შეთანხმება.')} <button type="button" disabled={mutation.busy} onClick={()=>void mutation.recover<LifecycleDates,LifecycleDateCommand>(operation).then(apply)}>{copy('Retry','ხელახლა ცდა')}</button></p>}
    {dates.reviewDueAt&&<p role="status"><strong>{copy('Introductory review','გაცნობითი განხილვა')}</strong>: {dates.reviewSource==='EXPLICIT'?new Date(Date.parse(dates.reviewDueAt)-1).toLocaleDateString(undefined,{timeZone:dates.reviewTimezone})+' ('+dates.reviewTimezone+')':formatted(dates.reviewDueAt,dates.reviewTimezone)} · {dates.reviewOwner} · {dates.reviewOverdue?copy('Overdue — staff must record the next decision','ვადაგადაცილებული — თანამშრომელმა შემდეგი გადაწყვეტილება უნდა დააფიქსიროს'):dates.reviewSource==='DEFAULT'?copy('Suggested fourteen-day review','შემოთავაზებული თოთხმეტდღიანი განხილვა'):copy('Club review date, through the end of this day','კლუბის განხილვის თარიღი, ამ დღის დასრულებამდე')}</p>}
    {dates.departure&&<div role="status"><h3>{copy('Departure arrangement','გასვლის შეთანხმება')}</h3><p>{dates.departure.localDate} · {dates.departure.timezone} · {dates.departure.status==='PROPOSED'?copy('Proposed — awaiting the other side','შემოთავაზებული — მეორე მხარის პასუხის მოლოდინი'):dates.departure.status==='AGREED'?copy('Agreed — rights continue until this date begins','შეთანხმებული — უფლებები ამ თარიღის დაწყებამდე მოქმედებს'):dates.departure.status==='EFFECTIVE'?copy('Effective — this enrollment has ended','ძალაში შესული — ეს ჩარიცხვა დასრულდა'):copy('Declined — current arrangement continues','უარყოფილი — მიმდინარე შეთანხმება გრძელდება')}</p><p>{dates.departure.reason}</p><p>{copy('Financial, administrative and competitive obligations need their own recorded resolution.','ფინანსურ, ადმინისტრაციულ და სათამაშო ვალდებულებებს ცალკე დაფიქსირებული გადაწყვეტა სჭირდება.')}</p></div>}
    {dates.seasonCaseId&&<p><Link to={dates.seasonDestination!}>{copy('Review proposed next intake','შემოთავაზებული შემდეგი მიღების განხილვა')}: {dates.seasonGroupName}</Link></p>}
    {(allowed('SET_REVIEW_DATE')||allowed('PROPOSE_DEPARTURE')||allowed('AGREE_DEPARTURE')||allowed('DECLINE_DEPARTURE')||allowed('PROPOSE_SEASON'))&&<form onSubmit={e=>e.preventDefault()} className="admission-stack">
      {(allowed('SET_REVIEW_DATE')||allowed('PROPOSE_DEPARTURE'))&&<label>{copy('Club-local date','კლუბის ადგილობრივი თარიღი')}<input aria-label={copy('Club-local date','კლუბის ადგილობრივი თარიღი')} type="date" value={date} disabled={disabled} onChange={e=>setDate(e.target.value)}/></label>}
      <label>{copy('Arrangement and outstanding work','შეთანხმება და დარჩენილი საკითხები')}<textarea aria-label={copy('Arrangement and outstanding work','შეთანხმება და დარჩენილი საკითხები')} value={reason} maxLength={2000} disabled={disabled} onChange={e=>setReason(e.target.value)}/></label>
      <div className="admission-actions admission-actions">
        {allowed('SET_REVIEW_DATE')&&<button type="button" disabled={disabled||!date||!reason.trim()} onClick={()=>send('SET_REVIEW_DATE')}>{copy('Set review date','განხილვის თარიღის დაყენება')}</button>}
        {allowed('PROPOSE_DEPARTURE')&&<button type="button" disabled={disabled||!date||!reason.trim()} onClick={()=>send('PROPOSE_DEPARTURE')}>{copy('Propose departure date','გასვლის თარიღის შეთავაზება')}</button>}
        {allowed('AGREE_DEPARTURE')&&<button type="button" disabled={disabled||!reason.trim()} onClick={()=>send('AGREE_DEPARTURE')}>{copy('Agree this departure','ამ გასვლის შეთანხმება')}</button>}
        {allowed('DECLINE_DEPARTURE')&&<button type="button" disabled={disabled||!reason.trim()} onClick={()=>send('DECLINE_DEPARTURE')}>{copy('Decline proposed departure','შემოთავაზებული გასვლის უარყოფა')}</button>}
      </div>
      {allowed('PROPOSE_SEASON')&&<><label>{copy('Proposed next intake group','შემოთავაზებული შემდეგი მიღების ჯგუფი')}<select aria-label={copy('Proposed next intake group','შემოთავაზებული შემდეგი მიღების ჯგუფი')} value={groupId} disabled={disabled} onChange={e=>setGroupId(e.target.value)}><option value="">—</option>{groups.filter(g=>g.intake!==record.intake&&g.canManage!==false&&g.intakeOpen).map(g=><option key={g.id} value={g.id}>{g.name} · {g.intake}</option>)}</select></label><p>{copy('Propose an actual place on the next intake terms. The family or player must review and accept it; the current enrollment continues.','შესთავაზეთ რეალური ადგილი შემდეგი მიღების პირობებით. ოჯახმა ან მოთამაშემ უნდა განიხილოს და მიიღოს იგი; მიმდინარე ჩარიცხვა გრძელდება.')}</p><button type="button" disabled={disabled||!groupId||!reason.trim()} onClick={()=>send('PROPOSE_SEASON')}>{copy('Propose next intake offer','შემდეგი მიღების შეთავაზება')}</button></>}
    </form>}
  </section>;
}
