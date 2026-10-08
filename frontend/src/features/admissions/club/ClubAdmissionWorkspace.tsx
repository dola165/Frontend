import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, RefreshCw, Users } from 'lucide-react';
import type { AdmissionCase, AdmissionInquiry, Choice, Opportunity } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { OpenWorkspace } from '../../clubOperations/WorkspaceHome';
import { useClubAdmissionCopy } from './copy';
import { availabilityCopy, methodCopy, nextCopy, ownerCopy, participationCopy, stageCopy } from './domain';
import { AdmissionDate, AdmissionEmpty, AdmissionError, AdmissionField, AdmissionLinkButton, AdmissionPanel, AdmissionPill } from './ui';
import { CaseDetail } from './CaseDetail';
import { GroupEditor } from './GroupEditor';
import { JoiningProgrammeSetup } from './JoiningProgrammeSetup';
import { inquiryOwner, useInquiryCopy } from '../inquiryPresentation';
import { OfflineInquiry } from './OfflineInquiry';
import { InquiryQueue } from './InquiryQueue';
import { LegacyAdmissions } from '../legacy/LegacyAdmissions';
import { FamilyClubEnrollment } from '../../parents/FamilyClubEnrollment';
import type { useClubAdmissions } from './useClubAdmissions';
import './club-admission.css';

export function ClubAdmissionWorkspace({state,sessionId,onOpen,onRosterChanged,existingPeople=[]}:{state:ReturnType<typeof useClubAdmissions>;sessionId:AuthSessionId;onOpen:OpenWorkspace;onRosterChanged:()=>void;existingPeople?:Choice[]}) {
  const {c,locale}=useClubAdmissionCopy();const {copy}=useInquiryCopy();const [params,setParams]=useSearchParams();
  const [search,setSearch]=useState(''),[groupFilter,setGroupFilter]=useState(''),[stageFilter,setStageFilter]=useState(''),[queueFilter,setQueueFilter]=useState('action'),[editing,setEditing]=useState<Opportunity|null|undefined>(undefined),[saved,setSaved]=useState(false),[offline,setOffline]=useState(false);
  const view=['cases','sessions','groups','history'].includes(params.get('admissionView')??'')?params.get('admissionView')!:'cases';
  const caseId=Number(params.get('case')??params.get('caseId'));
  const inquiryId=Number(params.get('inquiryId')??params.get('inquiry'));
  const workspace=state.data;
  const setupOpen=params.get('joiningSetup')==='1'&&inquiryId>0;
  const openSetup=(id:number)=>{const q=new URLSearchParams(params);q.set('inquiryId',String(id));q.set('joiningSetup','1');q.set('admissionView','cases');q.delete('case');q.delete('caseId');setParams(q);};
  const returnToInquiry=()=>{const q=new URLSearchParams(params);q.delete('joiningSetup');q.set('admissionView','cases');setParams(q);};
  const inquiryChanged=(value:AdmissionInquiry)=>{state.setData(current=>current?{...current,inquiries:current.inquiries?.map(row=>row.id===value.id?value:row)}:current);void state.reload();};
  const intakeOpen=offline||params.get('intake')==='1';
  const closeIntake=()=>{setOffline(false);const q=new URLSearchParams(params);q.delete('intake');setParams(q);};
  const changeView=(next:string)=>{const q=new URLSearchParams(params);q.set('admissionView',next);q.delete('case');q.delete('inquiry');q.delete('inquiryId');q.delete('caseId');q.delete('admissionGroup');q.delete('joiningSetup');setParams(q);setEditing(undefined);setOffline(false);};
  const openCase=(id:number)=>{const q=new URLSearchParams(params);q.delete('joiningSetup');q.set('case',String(id));q.delete('inquiry');q.delete('inquiryId');q.delete('caseId');q.set('admissionView','cases');setParams(q);};
  const back=()=>{const q=new URLSearchParams(params);q.delete('case');q.delete('caseId');q.delete('inquiry');q.delete('inquiryId');q.delete('joiningSetup');setParams(q);};
  const changed=(value:AdmissionCase)=>{
    const previous=workspace?.cases.find(row=>row.id===value.id);
    state.setData(current=>current?{...current,cases:current.cases.map(row=>row.id===value.id?value:row)}:current);
    const placementChanged=previous?.enrollment?.id!==value.enrollment?.id||previous?.enrollment?.status!==value.enrollment?.status;
    const offerChanged=previous?.offer?.id!==value.offer?.id||previous?.offer?.version!==value.offer?.version||previous?.offer?.status!==value.offer?.status;
    if(placementChanged)onRosterChanged();
    if(placementChanged||offerChanged)void state.reload();
  };
  if(!workspace)return <section className="club-admission"><h1>{c('title')}</h1>{state.loading?<p role="status">{c('loading')}</p>:<AdmissionError message={state.error||c('revoked')} onRetry={()=>void state.reload()} retry={c('retry')}/>}</section>;
  const record=workspace.cases.find(row=>row.id===caseId);
  const cases=workspace.cases.filter(row=>(!groupFilter||String(row.groupId)===groupFilter)&&(!stageFilter||row.stage===stageFilter)&&`${row.playerName} ${row.groupName} ${row.responsible?.name??''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const actionable=cases.filter(row=>!['ENROLLED','CLOSED'].includes(row.stage)&&(queueFilter==='all'||row.nextAction.owner===(queueFilter==='family'?'APPLICANT':'CLUB'))).sort((a,b)=>(a.nextAction.dueAt??'9999').localeCompare(b.nextAction.dueAt??'9999')||a.submittedAt.localeCompare(b.submittedAt));
  const shownCases=view==='history'?cases.filter(row=>['ENROLLED','CLOSED'].includes(row.stage)):actionable;
  const visitors=cases.flatMap(row=>row.sessions.filter(session=>['INVITED','CONFIRMED','RECONFIRM_REQUIRED'].includes(session.status)).map(session=>({record:row,session}))).sort((a,b)=>a.session.startsAt.localeCompare(b.session.startsAt));
  const inquiryRecords=workspace.inquiries??[];
  const inquiryClosed=(row:typeof inquiryRecords[number])=>['RESOLVED','DECLINED','WITHDRAWN'].includes(row.status);
  const inquiryQueued=(row:typeof inquiryRecords[number])=>!inquiryClosed(row)&&!(row.status==='ROUTED'&&row.caseId);
  const setupTask=(row:AdmissionInquiry)=>Boolean(row.setup?.requested&&!row.groupId&&row.setup.canConfigure);
  const needsClub=(row:AdmissionInquiry)=>inquiryOwner(row)==='CLUB'||setupTask(row);
  const shownInquiries=inquiryRecords.filter(row=>row.id===inquiryId||((view==='history'?inquiryClosed(row):inquiryQueued(row)&&(queueFilter==='all'||(queueFilter==='family'?inquiryOwner(row)==='APPLICANT':needsClub(row))))&&(!groupFilter||String(row.groupId)===groupFilter)&&`${row.playerName??''} ${row.message}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const metrics=[{key:'needsClub' as const,count:workspace.cases.filter(row=>row.nextAction.owner==='CLUB').length+inquiryRecords.filter(row=>needsClub(row)&&inquiryQueued(row)).length},{key:'upcoming' as const,count:workspace.cases.flatMap(row=>row.sessions).filter(session=>session.status==='CONFIRMED').length},{key:'awaitingFamily' as const,count:workspace.cases.filter(row=>row.nextAction.owner==='APPLICANT').length+inquiryRecords.filter(row=>inquiryOwner(row)==='APPLICANT'&&inquiryQueued(row)).length}];
  return <section className="club-admission">
    {setupOpen?<JoiningProgrammeSetup inquiryId={inquiryId} workspace={workspace} sessionId={sessionId} onChanged={inquiryChanged} onReturn={returnToInquiry}/>:record?<CaseDetail key={record.id} record={record} workspace={workspace} sessionId={sessionId} onChanged={changed} onBack={back} onOpen={onOpen} onRefresh={()=>void state.reload()}/>:<>
    {caseId>0&&(state.loading?<p role="status">{c('loading')}</p>:<AdmissionError message={c('revoked')} retry={c('back')} onRetry={back}/>)}
    {inquiryId>0&&!workspace.inquiries?.some(row=>row.id===inquiryId)&&(state.loading?<p role="status">{c('loading')}</p>:<AdmissionError message="This enquiry is unavailable with your current club access. Return to the queue or refresh your access." retry="Return to joining queue" onRetry={back}/>)}
    <header className="admission-heading"><div><span className="admission-eyebrow">{workspace.organizationName}</span><h1>{c('title')}</h1><p>{c('intro')}</p></div><div className="admission-actions"><button className="admission-button" aria-expanded={intakeOpen} onClick={()=>{setOffline(!intakeOpen);const q=new URLSearchParams(params);q.delete('intake');setParams(q);}}>{copy('Add / invite player','მოთამაშის დამატება / მოწვევა')}</button><button className="admission-secondary" disabled={state.loading} onClick={()=>void state.reload()}><RefreshCw size={15} aria-hidden="true"/>{c('refresh')}</button></div></header>
    {intakeOpen&&<div className="admission-intake-options">{workspace.clubId&&<FamilyClubEnrollment key={`${sessionId}:${workspace.clubId}`} clubId={workspace.clubId} canContinueWithoutGroup onLinked={result=>{void state.reload();const destination=new URL(result.staffDestination,window.location.origin);setParams(destination.searchParams);setOffline(false);}}/>}{workspace.groups.some(group=>group.canManage)&&<OfflineInquiry workspace={workspace} people={existingPeople.filter((person,index,rows)=>rows.findIndex(p=>p.id===person.id)===index)} sessionId={sessionId} onClose={closeIntake}/>}</div>}
    {state.error&&<AdmissionError message={state.error} onRetry={()=>void state.reload()} retry={c('retry')}/>}
    {saved&&<p className="admission-success" role="status">{c('saved')}</p>}
    <div className="admission-metrics" role="group" aria-label={c('loadedOnly')}>{metrics.map(item=><div className="admission-metric" key={item.key}><b>{item.count}</b><span>{c(item.key)}</span></div>)}</div>
    <nav className="admission-view-nav" aria-label={c('title')}>{(['cases','sessions','groups','history'] as const).map(item=><button type="button" key={item} aria-current={view===item?'page':undefined} onClick={()=>changeView(item)}>{item==='cases'?copy('Joining queue','გაწევრიანების რიგი'):item==='history'?copy('Players & history','მოთამაშეები და ისტორია'):c(item)}{item==='cases'&&<span>{workspace.cases.filter(row=>row.nextAction.owner==='CLUB'&&!['ENROLLED','CLOSED'].includes(row.stage)).length+inquiryRecords.filter(row=>needsClub(row)&&inquiryQueued(row)).length}</span>}{item==='sessions'&&<span>{visitors.length}</span>}</button>)}</nav>
    {view==='cases'&&<div className="admission-queue-filters" role="group" aria-label={copy('Who needs to act','ვინ უნდა იმოქმედოს')}>{[['action',copy('Needs our action','ჩვენი მოქმედებაა საჭირო')],['family',copy('Waiting for family','ოჯახის პასუხის მოლოდინში')],['all',copy('All ongoing requests','ყველა მიმდინარე მოთხოვნა')]].map(([id,label])=><button key={id} type="button" className="admission-secondary" aria-pressed={queueFilter===id} onClick={()=>setQueueFilter(id)}>{label}</button>)}</div>}
    {view!=='groups'&&<div className="admission-toolbar"><AdmissionField label={c('search')}><input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></AdmissionField><AdmissionField label={c('group')}><select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="">{c('allGroups')}</option>{workspace.groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></AdmissionField>{view==='cases'&&<AdmissionField label={c('stage')}><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="">{c('allStages')}</option>{Object.entries(stageCopy).map(([value,key])=><option value={value} key={value}>{c(key)}</option>)}</select></AdmissionField>}</div>}
    {(view==='cases'||view==='history')&&<InquiryQueue selectedInquiryId={inquiryId} records={shownInquiries} groups={workspace.groups} sessionId={sessionId} onRefresh={()=>void state.reload()} onOpenCase={openCase} onChanged={inquiryChanged} onSetup={openSetup}/> }
    {(view==='cases'||view==='history')&&<AdmissionPanel title={view==='history'?'Players & completed requests':queueFilter==='family'?'Waiting for the player or guardian':'Next steps'} subtitle={view==='history'?'Current placements and past outcomes remain available here.':'Open a request to arrange a visit, record its outcome or agree a place.'}>{shownCases.length?<div className="admission-case-list">{shownCases.map(row=><button className="admission-case-row" type="button" key={row.id} onClick={()=>openCase(row.id)} aria-label={`${c('openCase')} · ${row.playerName} · ${row.groupName}`}><span><strong>{row.playerName}</strong><small>{row.groupName} · {row.intake}</small></span><span><AdmissionPill tone={row.stage==='ENROLLED'?'good':row.stage==='COMPLETING_ENROLLMENT'?'attention':'neutral'}>{c(stageCopy[row.stage])}</AdmissionPill><small>{row.responsible?.name??c('queue')}</small></span><span><strong>{c(ownerCopy[row.nextAction.owner])}</strong><small>{nextCopy[row.nextAction.code]?c(nextCopy[row.nextAction.code]):row.nextAction.label}</small><AdmissionDate value={row.nextAction.dueAt} locale={locale}/></span><ArrowRight size={16} aria-hidden="true"/></button>)}</div>:<AdmissionEmpty title={view==='cases'?copy('No player arrangements need action here','მოთამაშის შეთანხმებებზე მოქმედება საჭირო არ არის'):c('emptyCases')} hint={view==='cases'?'Check the other queue filters, or invite a player to start their joining arrangement.':c('emptyCasesHint')}/>}</AdmissionPanel>}
    {(view==='cases'||view==='history')&&<LegacyAdmissions view={view==='history'?'history':'review'} sessionId={sessionId} organizationId={workspace.organizationId} playerId={Number(params.get('person'))||undefined} onChanged={()=>void state.reload()}/>}
    {view==='sessions'&&<AdmissionPanel title={c('sessions')} subtitle={c('attendanceHint')}>{visitors.length?visitors.map(({record:row,session})=><article className="admission-session-row" key={`${row.id}:${session.id}`}><div className="admission-session-heading"><Users size={20} aria-hidden="true"/><div><strong>{row.playerName} · {session.title}</strong><AdmissionDate value={session.startsAt} locale={locale} timezone={session.timezone}/><p>{session.location.name} · {session.contact}</p></div></div><div className="admission-pills"><AdmissionPill>{c(participationCopy[session.status])}</AdmissionPill><AdmissionPill>{row.groupName}</AdmissionPill></div>{session.status==='CONFIRMED'&&<p className="admission-group-meta">{c('emergency')}: {session.emergencyContact??c('notProvided')}</p>}<AdmissionLinkButton onClick={()=>openCase(row.id)}>{c('openCase')}</AdmissionLinkButton></article>):<AdmissionEmpty title={c('noVisitors')} hint={c('noVisitorsHint')}/>}</AdmissionPanel>}
    {view==='groups'&&(editing!==undefined?<GroupEditor key={editing?.id??'new'} workspace={workspace} group={editing?workspace.groups.find(group=>group.id===editing.id)??editing:null} sessionId={sessionId} onRefresh={()=>void state.reload()} onSaved={()=>{setSaved(true);setEditing(undefined);void state.reload();}} onCancel={()=>setEditing(undefined)}/>:<><div className="admission-actions">{workspace.canConfigure?<button className="admission-button" onClick={()=>{setSaved(false);setEditing(null);}}>{c('newGroup')}</button>:<p className="admission-group-meta">{c('leadershipOnly')}</p>}</div><div className="admission-groups">{workspace.groups.filter(group=>!(params.get('admissionGroup')??params.get('group'))||String(group.id)===(params.get('admissionGroup')??params.get('group'))).map(group=><AdmissionPanel key={group.id} title={group.name} subtitle={`${c(methodCopy[group.method])} · ${group.intake}`} action={<AdmissionPill>{c(availabilityCopy[group.availability])}</AdmissionPill>}><p className="admission-group-meta">{group.location.name}<br/>{group.schedule}<br/>{c('remaining')}: {group.remainingPlaces} / {group.capacity}<br/>{c('groupVersion')}: {group.version}</p><h3 className="admission-section-label">{c('regularParticipants')}</h3>{workspace.cases.filter(row=>row.enrollment?.groupId===group.id&&row.enrollment.status==='ACTIVE').map(row=><div className="admission-task" key={row.id}><strong>{row.playerName}</strong><AdmissionDate value={row.enrollment!.startDate} locale={locale} label={c('startDate')}/><AdmissionLinkButton onClick={()=>openCase(row.id)}>{c('openCase')}</AdmissionLinkButton></div>)}<div className="admission-actions"><Link to={group.destination} className="admission-text-button">{c('openOpportunity')}<ArrowRight size={15} aria-hidden="true"/></Link>{workspace.canConfigure&&<button className="admission-secondary" onClick={()=>{setSaved(false);setEditing(group);}}>{c('editGroup')}</button>}</div></AdmissionPanel>)}</div>{!workspace.groups.length&&<AdmissionEmpty title={c('noGroups')} hint={c('noGroupsHint')}/>}</>)}
    </>}
  </section>;
}






