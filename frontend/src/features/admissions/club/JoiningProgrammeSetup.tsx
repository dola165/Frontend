import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { AdmissionInquiry, AdmissionWorkspace } from '../types';
import { assertCurrentAuthSession, getAuthSessionId, subscribeAuthSession, type AuthSessionId } from '../../../utils/authStorage';
import { configureJoiningForInquiry, fetchJoiningSetup } from '../../joining-contract/api';
import { useAdmissionData } from '../applicant/useAdmissionData';
import { useInquiryCopy } from '../inquiryPresentation';
import { GroupEditor } from './GroupEditor';
import { joiningSetupInitial } from './joiningSetupDraft';
import { AdmissionError, AdmissionPanel } from './ui';
import { readPending } from './useDurableMutation';
import { joiningSetupScope } from './joiningSetupStorage';


export function JoiningProgrammeSetup({inquiryId,workspace,sessionId,onChanged,onReturn}: {
 inquiryId:number;workspace:AdmissionWorkspace;sessionId:AuthSessionId;
 onChanged:(inquiry:AdmissionInquiry)=>void;onReturn:()=>void;
}) {
 const {copy}=useInquiryCopy();
 const currentSession=useSyncExternalStore(subscribeAuthSession,getAuthSessionId,getAuthSessionId);
 const view=useRef({active:true,inquiryId,sessionId,organizationId:workspace.organizationId});
 useEffect(()=>{const current={active:true,inquiryId,sessionId,organizationId:workspace.organizationId};view.current=current;return()=>{current.active=false;};},[inquiryId,sessionId,workspace.organizationId]);
 const data=useAdmissionData(useCallback(signal=>fetchJoiningSetup(inquiryId,sessionId,signal),[inquiryId,sessionId]),sessionId);
 const setup=data.data;
 if(currentSession!==sessionId)return <AdmissionError message={copy('Your session changed. Open this enquiry again with your current access.','თქვენი სესია შეიცვალა. ხელახლა გახსენით კითხვა თქვენი მიმდინარე წვდომით.')} retry={copy('Return to enquiry','კითხვაზე დაბრუნება')} onRetry={onReturn}/>;
 if(data.loading)return <p role="status">{copy('Loading programme joining setup…','პროგრამის გაწევრიანების პირობები იტვირთება…')}</p>;
 if(data.error)return <><AdmissionError message={data.error} retry={copy('Refresh setup','პირობების განახლება')} onRetry={data.refresh}/><button type="button" className="admission-secondary" onClick={onReturn}>{copy('Return to enquiry','კითხვაზე დაბრუნება')}</button></>;
 if(!setup)return null;
 if(setup.inquiryId!==inquiryId||setup.organizationId!==workspace.organizationId)return <AdmissionError message={copy('This setup does not match the selected enquiry. Refresh to check your current access.','ეს პირობები არჩეულ კითხვას არ შეესაბამება. მიმდინარე წვდომის შესამოწმებლად განაახლეთ.')} retry={copy('Refresh setup','პირობების განახლება')} onRetry={data.refresh}/>;
 const hasPending=Boolean(readPending(`gk-admission-staff:${joiningSetupScope(sessionId,workspace.organizationId,inquiryId)}`));
 const inquiry=workspace.inquiries?.find(row=>row.id===inquiryId);
 if(!setup.canConfigure&&!hasPending){
  const configured=Boolean(inquiry?.groupId);
  const leadership=setup.canRequest||setup.requested;
  return <AdmissionPanel title={configured?copy('Joining is already configured','გაწევრიანების პირობები უკვე მომზადებულია'):leadership?copy('Club leadership approval is needed','საჭიროა კლუბის ხელმძღვანელობის დამტკიცება'):copy('Joining setup is unavailable','გაწევრიანების პირობების მომზადება მიუწვდომელია')}><p>{configured?copy('Continue the same enquiry to agree the next step with the player or guardian.','მოთამაშესთან ან მეურვესთან შემდეგ ნაბიჯზე შესათანხმებლად გააგრძელეთ იგივე კითხვა.'):setup.requested?copy('Leadership has been asked to prepare joining for this programme. Continue the same enquiry to follow the response.','ხელმძღვანელობას ამ პროგრამის პირობების მომზადება ეთხოვა. პასუხისთვის გააგრძელეთ იგივე კითხვა.'):setup.canRequest?copy('Return to the enquiry and ask club leadership to prepare this programme’s joining terms.','დაუბრუნდით კითხვას და სთხოვეთ ხელმძღვანელობას ამ პროგრამის პირობების მომზადება.'):copy('Return to the enquiry to check its current outcome and the actions available to you.','კითხვის მიმდინარე შედეგისა და თქვენთვის ხელმისაწვდომი მოქმედებების სანახავად დაბრუნდით კითხვაზე.')}</p><button type="button" className="admission-secondary" onClick={onReturn}>{copy('Return to enquiry','კითხვაზე დაბრუნება')}</button></AdmissionPanel>;
 }
 const scopedWorkspace={...workspace,staff:setup.staff,squads:setup.squadId?[{id:setup.squadId,name:setup.squadName||setup.programmeName||setup.known.name||copy('Existing squad','არსებული გუნდი')}]:workspace.squads};
 const known=setup.known;
 const existing=setup.existingGroups.find(group=>group.id===inquiry?.groupId)??null;
 return <div className="admission-stack" data-joining-setup={inquiryId}>
  <AdmissionPanel title={copy('Existing programme','არსებული პროგრამა')} subtitle={setup.programmeName||setup.squadName||known.name||copy('Club programme','კლუბის პროგრამა')}>
   <p>{copy('These facts come from the club’s current programme. Review the joining choices below before saving.','ეს მონაცემები კლუბის მიმდინარე პროგრამიდანაა. შენახვამდე განიხილეთ ქვემოთ მოცემული გაწევრიანების პირობები.')}</p>
   <dl className="admission-summary">
    {setup.squadName&&<div><dt>{copy('Squad','გუნდი')}</dt><dd>{setup.squadName}</dd></div>}
    {(known.ageMin!==null||known.ageMax!==null)&&<div><dt>{copy('Programme ages','პროგრამის ასაკი')}</dt><dd>{known.ageMin??'—'} – {known.ageMax??'—'}</dd></div>}
    {known.sessionsPerWeek!==null&&<div><dt>{copy('Sessions per week','ვარჯიშები კვირაში')}</dt><dd>{known.sessionsPerWeek}</dd></div>}
    {known.amount!==null&&<div><dt>{copy('Listed programme price','პროგრამაში მითითებული ფასი')}</dt><dd>{known.amount} {known.currency??''}{known.billingPeriod?` · ${known.billingPeriod}`:''}</dd></div>}
    {known.details&&<div><dt>{copy('Programme details','პროგრამის ინფორმაცია')}</dt><dd>{known.details}</dd></div>}
   </dl>
   <p className="admission-notice">{copy('Confirm capacity, staff, dates, schedule and all charges. Unknown prices remain unknown until reviewed. Saving setup keeps this enquiry; a visit is agreed in its next step.','დაადასტურეთ ადგილები, თანამშრომლები, თარიღები, განრიგი და ყველა გადასახადი. უცნობი ფასი განხილვამდე უცნობი რჩება. პირობების შენახვისას ეს კითხვა ინახება; ვიზიტზე შემდეგ ნაბიჯში შეთანხმდებით.')}</p>
  </AdmissionPanel>
  <GroupEditor key={`${sessionId}:${workspace.organizationId}:${inquiryId}`} workspace={scopedWorkspace} group={existing} sessionId={sessionId} recoveryOnly={!setup.canConfigure}
   context={{inquiryId,inquiryVersion:setup.inquiryVersion,name:setup.programmeName||setup.squadName||known.name||'',initial:joiningSetupInitial(setup)}}
   saveOperation={async (group,expectedVersion,requestId)=>{
    const originatingView=view.current;
    assertCurrentAuthSession(sessionId);
    if(!requestId||requestId===group.requestId||expectedVersion===undefined)throw new Error(copy('The saved request cannot be confirmed. Return to the enquiry and refresh its current setup.','შენახული მოთხოვნის დადასტურება ვერ ხერხდება. დაბრუნდით კითხვაზე და განაახლეთ მისი მიმდინარე პირობები.'));
    const result=await configureJoiningForInquiry(inquiryId,{requestId,expectedVersion,group},sessionId);
    assertCurrentAuthSession(sessionId);
    if(!originatingView.active||originatingView.inquiryId!==inquiryId||originatingView.organizationId!==workspace.organizationId)throw new Error('Setup view changed while checking the saved request.');
    if(result.id!==inquiryId||result.organizationId!==workspace.organizationId)throw new Error('The setup reply does not match this enquiry.');
    onChanged(result);return result;
   }}
   onSaved={onReturn} onCancel={onReturn} onRefresh={data.refresh}/>
 </div>;
}
