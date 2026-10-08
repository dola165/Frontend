import { MessageText } from '../../../components/chat/MessageText';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { commandAdmissionInquiry } from '../api';
import type { AdmissionInquiry, InquiryAction, InquiryCommand, Opportunity } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import { useClubAdmissionCopy } from './copy';
import { useInquiryCopy } from '../inquiryPresentation';
import { AdmissionDate, AdmissionError, AdmissionField, AdmissionLinkButton, AdmissionPanel, AdmissionPill } from './ui';
import { useDurableMutation } from './useDurableMutation';

type QueueProps = {
 records: AdmissionInquiry[]; groups: Opportunity[]; sessionId: AuthSessionId;
 onChanged: (value: AdmissionInquiry) => void; onOpenCase: (id: number) => void;
 onRefresh: () => void; selectedInquiryId?: number; onSetup?: (id: number) => void;
};
const editableActions: InquiryAction[] = ['MESSAGE','ROUTE','RESOLVE','REOPEN','DECLINE','REQUEST_SETUP'];
function InquiryRow({record,groups,sessionId,onChanged,onOpenCase,onRefresh,selected,onSetup}: Omit<QueueProps,'records'|'selectedInquiryId'> & {record:AdmissionInquiry;selected:boolean}) {
 const {c,locale}=useClubAdmissionCopy();
 const {copy,status,next,action:actionLabel}=useInquiryCopy();
 const available=record.actions.filter(value=>editableActions.includes(value));
 const [chosen,setAction]=useState<InquiryAction>(available[0]??'MESSAGE');
 const action=available.includes(chosen)?chosen:available[0]??'MESSAGE';
 const [message,setMessage]=useState(''),[groupId,setGroupId]=useState(String(record.groupId??''));
 const mutation=useDurableMutation(`inquiry:${sessionId}:${record.organizationId}:${record.id}`);
 const managedGroups=groups.filter(row=>row.canManage);
 const group=managedGroups.find(row=>String(row.id)===groupId);
 const operation=(body:InquiryCommand)=>commandAdmissionInquiry(record.id,body,sessionId);
 const updated=(result:AdmissionInquiry)=>{onChanged(result);setMessage('');if(action==='ROUTE'&&result.caseId)onOpenCase(result.caseId);};
 const textRequired=['MESSAGE','ROUTE','DECLINE','REQUEST_SETUP'].includes(action);
 return <article className="admission-task admission-inquiry" data-selected={selected||undefined}>
  <header><strong>{record.playerName||copy('General club question','ზოგადი კითხვა კლუბისთვის')}</strong> · <AdmissionPill>{status(record)}</AdmissionPill>{record.groupId&&<small> · {groups.find(row=>row.id===record.groupId)?.name??copy('Training group','სავარჯიშო ჯგუფი')}</small>}<span className="admission-inquiry-next">{next(record)}</span>{record.setup?.requested&&!record.groupId&&<small>{copy('Leadership setup pending','ხელმძღვანელობის პირობების მოლოდინში')}</small>}</header>
  {record.conversationDestination&&<p><Link className="admission-button" to={record.conversationDestination}>Open conversation · reply, invite or offer a place</Link></p>}

  <p><MessageText text={record.message}/></p><details><summary>History & advanced handling</summary><AdmissionDate value={record.createdAt} locale={locale}/>
  {record.conversationDestination&&<div className="admission-actions"><Link className="admission-secondary" to={record.conversationDestination}>{copy('Open connected conversation','დაკავშირებული საუბრის გახსნა')}</Link></div>}
  {!record.playerId&&record.status==='OPEN'&&<p className="admission-notice">{copy('You can answer this general question without a player. For a visit, ask the sender to select whose details to share.','ზოგად კითხვას მოთამაშის გარეშე შეგიძლიათ უპასუხოთ. ვიზიტისთვის სთხოვეთ გამგზავნს აირჩიოს, ვისი მონაცემები გააზიაროს.')}</p>}
  {record.setup?.canConfigure&&onSetup&&<div className="admission-actions"><button type="button" className="admission-secondary" onClick={()=>onSetup(record.id)}>{copy('Configure joining for this programme','ამ პროგრამისთვის გაწევრიანების პირობების მომზადება')}</button></div>}
  {record.setup?.canRequest&&record.actions.includes('REQUEST_SETUP')&&action!=='REQUEST_SETUP'&&<div className="admission-actions"><button type="button" className="admission-secondary" onClick={()=>setAction('REQUEST_SETUP')}>{actionLabel('REQUEST_SETUP')}</button></div>}
  {record.setup?.requested&&<p className="admission-notice" role="status">{copy('Joining setup has been requested from club leadership. This enquiry stays connected.','გაწევრიანების პირობების მომზადების თხოვნა ხელმძღვანელობას გაეგზავნა. კითხვა დაკავშირებული რჩება.')}</p>}
  {record.caseId&&<AdmissionLinkButton onClick={()=>onOpenCase(record.caseId!)}>{c('openCase')}</AdmissionLinkButton>}
  {mutation.error&&<AdmissionError message={mutation.error} retry={c('refresh')} onRetry={onRefresh}/>}
  {mutation.pending&&<p className="admission-notice">{c('uncertain')} <button type="button" disabled={mutation.busy} className="admission-text-button" onClick={()=>void mutation.recover<AdmissionInquiry,InquiryCommand>(operation).then(result=>{if(result)updated(result);})}>{c('retry')}</button></p>}
  {available.length>0&&<form onSubmit={event=>{event.preventDefault();if(!record.actions.includes(action)||action==='ROUTE'&&!group||textRequired&&!message.trim())return;void mutation.send<AdmissionInquiry,InquiryCommand>({action,message:message.trim(),expectedVersion:record.version,...(action==='ROUTE'&&group?{groupId:group.id,groupVersion:group.version}:{})},operation).then(result=>{if(result)updated(result);});}}>
   <fieldset disabled={mutation.busy||Boolean(mutation.pending)} className="admission-form-grid">
    <AdmissionField label={c('inquiryNext')}><select value={action} onChange={event=>setAction(event.target.value as InquiryAction)}>{available.map(value=><option key={value} value={value}>{actionLabel(value)}</option>)}</select></AdmissionField>
    {action==='ROUTE'&&<><AdmissionField label={c('group')} hint={c('routeInquiryHint')}><select required value={groupId} onChange={event=>setGroupId(event.target.value)}><option value="">{copy('Choose an agreed group','აირჩიეთ შეთანხმებული ჯგუფი')}</option>{managedGroups.map(row=><option key={row.id} value={row.id}>{row.name} · {row.intake}</option>)}</select></AdmissionField>{!managedGroups.length&&<p className="admission-notice">{copy('Joining terms need to be prepared for the existing programme before arranging a place.','ადგილზე შეთანხმებამდე არსებულ პროგრამას გაწევრიანების პირობები უნდა მოუმზადდეს.')}</p>}</>}
    {action==='REQUEST_SETUP'&&<p className="admission-notice">{copy('Ask leadership to review this programme’s terms and responsible staff. You will return to this enquiry when joining is ready.','სთხოვეთ ხელმძღვანელობას განიხილოს პროგრამის პირობები და პასუხისმგებელი თანამშრომლები. პირობების მომზადების შემდეგ ამავე კითხვას დაუბრუნდებით.')}</p>}
    <AdmissionField label={textRequired?c('sharedExplanation'):copy('Optional message','არასავალდებულო შეტყობინება')} hint={action==='ROUTE'?c('routeInquiryHint'):c('messageHint')} wide><textarea required={textRequired} maxLength={2000} value={message} onChange={event=>setMessage(event.target.value)}/></AdmissionField>
   </fieldset><div className="admission-actions"><button className="admission-secondary" disabled={mutation.busy||Boolean(mutation.pending)||!record.actions.includes(action)||action==='ROUTE'&&!group}>{actionLabel(action)}</button></div>
  </form>}
  <details className="admission-disclosure"><summary>{copy('Enquiry history','კითხვის ისტორია')}</summary>{record.history.map(event=><article className="admission-history" key={event.id}><strong>{event.actorName}</strong><AdmissionDate value={event.createdAt} locale={locale}/><p>{event.message??copy('Next step recorded','შემდეგი ნაბიჯი ჩაიწერა')}</p></article>)}</details>
 </details></article>;
}
export function InquiryQueue({records,selectedInquiryId,...props}:QueueProps) {
 const {copy}=useInquiryCopy();
 if(!records.length)return null;
 return <AdmissionPanel title={copy('Incoming enquiries','შემოსული კითხვები')} subtitle={copy('Reply to a question or continue the named player’s joining arrangement.','უპასუხეთ კითხვას ან გააგრძელეთ დასახელებული მოთამაშის გაწევრიანების შეთანხმება.')}>{records.map(record=><InquiryRow selected={record.id===selectedInquiryId} key={record.id} record={record} {...props}/>)}</AdmissionPanel>;
}
