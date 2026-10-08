import { useState } from 'react';
import { AdmissionField } from './ui';
import { useClubAdmissionCopy } from './copy';

export type AssessmentDecision = 'offer' | 'session' | 'waitlist' | 'decline';
/** Layout independent of the service contract; callers map choices to the published command. */
export function AssessmentEditor({busy,onSave,onCancel}:{busy:boolean;onSave:(note:string,decision:AssessmentDecision|null,message:string)=>Promise<boolean>;onCancel:()=>void}) {
  const {c}=useClubAdmissionCopy();const [note,setNote]=useState(''),[decision,setDecision]=useState<AssessmentDecision|''>(''),[message,setMessage]=useState('');
  return <form onSubmit={e=>{e.preventDefault();void onSave(note,decision||null,message).then(ok=>{if(ok)onCancel();});}}>
    <p className="admission-group-meta">{c('coachBoundary')}</p>
    <div className="admission-form-grid"><AdmissionField label={c('internalNote')} hint={c('privateHint')} wide><textarea required maxLength={3600} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></AdmissionField>
    <AdmissionField label={c('recommendation')} wide><select value={decision} disabled={busy} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="">—</option><option value="offer">{c('offerRecommended')}</option><option value="session">{c('anotherSession')}</option><option value="waitlist">{c('waitlist')}</option><option value="decline">{c('declineCase')}</option></select></AdmissionField>
    <AdmissionField label={c('sharedExplanation')} hint={c('messageHint')} wide><textarea maxLength={2000} disabled={busy} value={message} onChange={e=>setMessage(e.target.value)}/></AdmissionField></div>
    <div className="admission-actions"><button className="admission-button" disabled={busy}>{c('assessment')}</button><button type="button" className="admission-secondary" disabled={busy} onClick={onCancel}>{c('cancel')}</button></div>
  </form>;
}
