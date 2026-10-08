import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { RecruitmentApplication } from '../../recruitment/RecruitmentApplication';
import { useAdmissionCopy } from '../applicant/copy';
import { useDurableMutation } from '../club/useDurableMutation';
import { fetchLegacyTasks, reconcileLegacy, respondLegacyInvitation, type LegacyTask, type LegacyReconcile } from './api';
import './legacy.css';

export function LegacyAdmissions({sessionId,organizationId,playerId,onChanged,view}:{sessionId:AuthSessionId;organizationId?:number;playerId?:number;onChanged?:()=>void;view?:'review'|'history'}) {
 const {copy}=useAdmissionCopy();const [tasks,setTasks]=useState<LegacyTask[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [showAll,setShowAll]=useState(false);const filterId=useId();const review=tasks.filter(t=>t.state==='REVIEW');const visible=view==='history'?tasks:view==='review'?review:organizationId&&!showAll?review:tasks;
 const sequence=useRef(0);const scope=`${sessionId}:${organizationId}:${playerId}`;const [dataScope,setDataScope]=useState(scope);
 const load=useCallback(async()=>{const seq=++sequence.current;setLoading(true);try{const rows=await fetchLegacyTasks(sessionId,organizationId,playerId);if(!Array.isArray(rows))throw new Error('Existing request response is incomplete. Reload to continue.');if(seq===sequence.current){setTasks(rows);setDataScope(scope);setError('');}}catch(e){if(seq===sequence.current){setTasks([]);setError(extractApiErrorMessage(e,'Could not load existing requests.'));}}finally{if(seq===sequence.current)setLoading(false);}},[sessionId,organizationId,playerId,scope]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
 if(error)return <section className="admission-panel"><p role="alert">{error}</p><button type="button" className="admission-button" onClick={()=>void load()}>{copy('Reload existing requests','არსებული მოთხოვნების განახლება')}</button></section>;
 if(loading||dataScope!==scope)return <p role="status">{copy('Loading existing requests…','არსებული მოთხოვნების ჩატვირთვა…')}</p>;
 if(!tasks.length||view==='review'&&!review.length)return null;
 return <details className="admission-panel legacy-admissions" open={!organizationId}><summary>{view==='review'?copy('Requests needing a group decision','მოთხოვნები ჯგუფის გადაწყვეტილებისთვის'):copy('Player participation and earlier requests','მოთამაშეთა მონაწილეობა და წინა მოთხოვნები')}{view==='review'?` · ${review.length}`:''}</summary>
 <p>{copy('Continue the player’s current arrangement. Current players can open their schedule; earlier requests keep their conversation and outcome.','გააგრძელეთ მოთამაშის მიმდინარე შეთანხმება. მოქმედ მოთამაშეებს შეუძლიათ განრიგის ნახვა; წინა მოთხოვნები ინარჩუნებს საუბარს და შედეგს.')}</p>
  {organizationId&&!view&&<div className="legacy-filter"><label htmlFor={filterId}>{copy('Show','ჩვენება')}</label><select id={filterId} value={showAll?'all':'review'} onChange={e=>setShowAll(e.target.value==='all')}><option value="review">{copy('Needs a decision','საჭიროებს გადაწყვეტილებას')} ({review.length})</option><option value="all">{copy('Players and earlier requests','მოთამაშეები და წინა მოთხოვნები')}</option></select></div>}
  {!visible.length&&<p>{copy('No existing records need review. Continue linked cases in the ordinary case queue; all preserved records remain available above.','არსებულ ჩანაწერებს განხილვა არ სჭირდება. დაკავშირებული საქმეები ჩვეულებრივ რიგშია; ყველა შენარჩუნებული ჩანაწერი ხელმისაწვდომია ზემოთ.')}</p>}
  {visible.map(task=><LegacyRow key={`${scope}:${task.kind}:${task.sourceId}`} task={task} sessionId={sessionId} staff={Boolean(organizationId)} onChanged={()=>{void load();onChanged?.();}}/>)}
 </details>;
}
function LegacyRow({task,sessionId,staff,onChanged}:{task:LegacyTask;sessionId:AuthSessionId;staff:boolean;onChanged:()=>void}) {
 const {copy}=useAdmissionCopy();const [group,setGroup]=useState(''),[reason,setReason]=useState(''),[confirm,setConfirm]=useState<boolean|null>(null),[inviting,setInviting]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const formId=useId();
 const mutation=useDurableMutation(`${sessionId}:${task.organizationId}:legacy:${task.kind}:${task.sourceId}`);
 async function reconcile(){const selected=task.groups.find(g=>g.id===Number(group));if(!selected)return;const result=await mutation.send<LegacyTask,LegacyReconcile>({expectedVersion:task.version,sourceStatus:task.sourceStatus,groupId:selected.id,groupVersion:selected.version,reason},body=>reconcileLegacy(task,body,sessionId));if(result)onChanged();}
 async function respond(){if(confirm===null||lock.current)return;lock.current=true;setInviting(true);setError('');try{await respondLegacyInvitation(task.sourceId,confirm,sessionId);setConfirm(null);onChanged();}catch(e){setError(extractApiErrorMessage(e,'Your current authority or invitation may have changed. Reload the request.'));}finally{setInviting(false);lock.current=false;}}
 return <details className="admission-card" aria-label={`${task.playerName} participation`}>
  <summary><strong>{task.playerName}</strong> · {task.state==='EXISTING_PARTICIPATION'?copy('Current participation','მიმდინარე მონაწილეობა'):task.state==='REVIEW'?copy('Choose the next step','აირჩიეთ შემდეგი ნაბიჯი'):task.sourceStatus.toLowerCase().replaceAll('_',' ')}</summary><p>{task.organizationName}</p><p>{task.nextAction}</p>
  {task.destination&&<Link className="admission-button" to={staff&&task.caseId?`/clubs/${task.clubId}/workspace?tab=admissions&case=${task.caseId}`:task.destination}>{task.caseId?copy('Continue group arrangement','ჯგუფის შეთანხმების გაგრძელება'):copy('Open current schedule','მიმდინარე განრიგის გახსნა')}</Link>}
  {!staff&&task.kind==='APPLICATION'&&task.state!=='EXISTING_PARTICIPATION'&&<RecruitmentApplication applicationId={task.sourceId} onChanged={onChanged}/>}
  {!staff&&task.kind==='INVITATION'&&task.canRespond&&<><div className="admission-actions"><button type="button" className="admission-button" disabled={inviting} onClick={()=>setConfirm(true)}>{copy('Review old invitation','ძველი მოწვევის განხილვა')}</button><button type="button" className="admission-button" disabled={inviting} onClick={()=>setConfirm(false)}>{copy('Decline old invitation','ძველი მოწვევის უარყოფა')}</button></div>{confirm!==null&&<section aria-label="Confirm old child invitation"><p>{copy(`Record this old invitation response for ${task.playerName}? Named group terms and session permission will need separate confirmation.`,`ჩაიწეროს ${task.playerName}-ის ძველ მოწვევაზე პასუხი? ჯგუფის პირობებს და სესიის ნებართვას ცალკე დადასტურება სჭირდება.`)}</p><button type="button" className="admission-button" disabled={inviting} onClick={()=>void respond()}>{copy('Confirm response','პასუხის დადასტურება')}</button><button type="button" className="admission-button" disabled={inviting} onClick={()=>setConfirm(null)}>{copy('Keep reviewing','განხილვის გაგრძელება')}</button></section>}</>}
  {staff&&task.canReconcile&&<form onSubmit={e=>{e.preventDefault();void reconcile();}}><p>{copy('Review the exact player and current record, then choose the group to arrange. This records routing only; current offers and consent remain separate.','განიხილეთ ზუსტი მოთამაშე და მიმდინარე ჩანაწერი, შემდეგ აირჩიეთ ჯგუფი. ეს მხოლოდ მიმართულებას აფიქსირებს; შეთავაზება და თანხმობა ცალკეა.')}</p>
   <div><label htmlFor={`${formId}-group`}>{copy('Named group','დასახელებული ჯგუფი')}</label><select id={`${formId}-group`} required value={group} onChange={e=>setGroup(e.target.value)}><option value="">{copy('Choose a group','აირჩიეთ ჯგუფი')}</option>{task.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
   <div><label htmlFor={`${formId}-reason`}>{copy('Actual review and routing reason','რეალური განხილვისა და მიმართულების მიზეზი')}</label><textarea id={`${formId}-reason`} required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></div>
   <button type="submit" className="admission-button" disabled={mutation.busy||!group||!reason.trim()}>{copy('Continue with this group','ამ ჯგუფთან გაგრძელება')}</button>
   {mutation.pending&&<button type="button" className="admission-button" disabled={mutation.busy} onClick={()=>void mutation.recover<LegacyTask,LegacyReconcile>(body=>reconcileLegacy(task,body,sessionId)).then(result=>{if(result)onChanged();})}>{copy('Retry this decision','გადაწყვეტილების ხელახლა ცდა')}</button>}
   {!task.groups.length&&<p>{copy('Club leadership must configure an actual group and its responsible staff before routing this record.','ხელმძღვანელობამ უნდა განსაზღვროს რეალური ჯგუფი და პასუხისმგებელი თანამშრომელი.')}</p>}
  </form>}
  {(error||mutation.error)&&<p role="alert">{error||mutation.error}</p>}
 </details>;
}
