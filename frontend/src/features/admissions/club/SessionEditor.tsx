import { useEffect, useState, type FormEvent } from 'react';
import type { AdmissionWorkspace, Opportunity, SessionDetails, Participation } from '../types';
import { sessions as fetchSessions } from '../../squadCommunication/api';
import { useClubAdmissionCopy } from './copy';
import { AdmissionError, AdmissionField } from './ui';
import { utcInput, zonedInput } from './domain';

type SessionChoice=NonNullable<AdmissionWorkspace['sessions']>[number];
export function SessionEditor({group,participation,choices,busy,onSubmit,onCancel}:{group:Opportunity;participation?:Participation;choices?:SessionChoice[];busy:boolean;onSubmit:(session:SessionDetails,reason:string)=>Promise<boolean>;onCancel:()=>void}) {
  const {c,locale}=useClubAdmissionCopy();
  const [slots,setSlots]=useState<SessionChoice[]>([]),[slotsError,setSlotsError]=useState('');
  const [title,setTitle]=useState(participation?.title??''),[timezone,setTimezone]=useState(participation?.timezone??group.timezone);
  const [starts,setStarts]=useState(participation?zonedInput(participation.startsAt,participation.timezone):''),[ends,setEnds]=useState(participation?zonedInput(participation.endsAt,participation.timezone):''),[deadline,setDeadline]=useState(participation?zonedInput(participation.responseDeadline,participation.timezone):'');
  const [location,setLocation]=useState(participation?.location??group.location),[contact,setContact]=useState(participation?.contact??''),[preparation,setPreparation]=useState(participation?.preparation??''),[cost,setCost]=useState(participation?.cost??''),[capacity,setCapacity]=useState(participation?.capacity??1),[noPlace,setNoPlace]=useState(participation?.noRegularPlaceGuaranteed??group.remainingPlaces===0),[slot,setSlot]=useState<number|null>(participation?.squadSessionId??null),[reason,setReason]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    if(!group.squadId)return;
    if(choices){setSlots(choices.filter(row=>row.squadId===group.squadId));return;}
    const controller=new AbortController();void fetchSessions(group.squadId,controller.signal).then(rows=>{if(!controller.signal.aborted)setSlots(rows.filter(row=>row.status==='SCHEDULED'&&new Date(utcInput(row.starts_at,group.timezone)).getTime()>Date.now()).map(row=>({id:row.id,squadId:group.squadId!,title:row.title,startsAt:utcInput(row.starts_at,group.timezone),endsAt:utcInput(row.ends_at,group.timezone),location:row.location,revision:row.revision})));}).catch(()=>{if(!controller.signal.aborted)setSlotsError(c('sessionChoiceMissing'));});return()=>controller.abort();
  },[group.squadId,group.timezone,c,choices]);
  const choose=(id:string)=>{
    const row=slots.find(s=>String(s.id)===id);setSlot(row?.id??null);if(!row)return;
    const start=row.startsAt,end=row.endsAt;setTitle(row.title);setTimezone(group.timezone);setStarts(zonedInput(start,group.timezone));setEnds(zonedInput(end,group.timezone));
    setDeadline(zonedInput(new Date(Math.min(Date.now()+48*3600000,new Date(start).getTime()-30*60000)).toISOString(),group.timezone));
    if(row.location)setLocation({...group.location,name:row.location});
  };
  const submit=async(e:FormEvent)=>{e.preventDefault();setError('');try {
    const linked=slot===null?undefined:slots.find(row=>row.id===slot);
    const unchangedLinked=slot!==null&&slot===participation?.squadSessionId;
    const startsAt=linked?.startsAt??(unchangedLinked?participation!.startsAt:utcInput(starts,timezone));
    const endsAt=linked?.endsAt??(unchangedLinked?participation!.endsAt:utcInput(ends,timezone));
    const responseDeadline=utcInput(deadline,timezone);
    if(new Date(endsAt)<=new Date(startsAt)||new Date(responseDeadline)>=new Date(startsAt)||new Date(responseDeadline)<=new Date()){setError(c('invalidDates'));return;}
    if(await onSubmit({title,startsAt,endsAt,timezone,location,contact,preparation,cost,capacity,responseDeadline,squadSessionId:slot,noRegularPlaceGuaranteed:noPlace},reason))onCancel();
  }catch{setError(c('invalidDates'));}};
  return <form onSubmit={e=>void submit(e)}>
    <p className="admission-group-meta">{c(participation?'changeHint':'inviteHint')} · {timezone}</p>
    {error && <AdmissionError message={error} retry={c('retry')}/>}
    {slotsError && <p role="status" className="admission-group-meta">{slotsError}</p>}
    <fieldset disabled={busy} className="admission-form-grid">
      {group.squadId&&<AdmissionField label={c('existingSession')} wide><select value={slot??''} onChange={e=>choose(e.target.value)}><option value="">{c('dedicatedSession')}</option>{slots.map(s=><option key={s.id} value={s.id}>{s.title} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:group.timezone}).format(new Date(s.startsAt))}</option>)}</select></AdmissionField>}
      <AdmissionField label={c('sessionTitle')} wide><input required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('starts')} hint={timezone}><input type="datetime-local" required readOnly={slot!==null} value={starts} onChange={e=>setStarts(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('ends')} hint={timezone}><input type="datetime-local" required readOnly={slot!==null} value={ends} onChange={e=>setEnds(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('timezone')}><input required value={timezone} onChange={e=>setTimezone(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('responseDeadline')} hint={`${c('invitationDeadlineHint')} · ${timezone}`}><input type="datetime-local" required value={deadline} onChange={e=>setDeadline(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('venue')}><input required value={location.name} onChange={e=>setLocation({...location,name:e.target.value})}/></AdmissionField>
      <AdmissionField label={c('address')}><input required value={location.address} onChange={e=>setLocation({...location,address:e.target.value})}/></AdmissionField>
      <AdmissionField label={c('contact')} wide><input required value={contact} maxLength={1000} onChange={e=>setContact(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('preparation')} wide><textarea value={preparation} maxLength={2000} onChange={e=>setPreparation(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('sessionCost')}><input required value={cost} maxLength={1000} onChange={e=>setCost(e.target.value)}/></AdmissionField>
      <AdmissionField label={c('introCapacity')}><input type="number" required min={1} max={1000} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></AdmissionField>
      <label className="admission-check admission-field-wide"><input type="checkbox" checked={noPlace} onChange={e=>setNoPlace(e.target.checked)}/>{c('noPlace')}</label>
      {participation&&<AdmissionField label={c('reason')} wide><textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></AdmissionField>}
    </fieldset>
    <div className="admission-actions"><button className="admission-button" disabled={busy}>{c(busy?'saving':participation?'save':'sendInvitation')}</button><button type="button" disabled={busy} className="admission-secondary" onClick={onCancel}>{c('cancel')}</button></div>
  </form>;
}
