import { useState } from 'react';
import type { Participation, CaseCommand, CommandBase } from '../types';
import { useAdmissionCopy } from '../applicant/copy';

type PermissionCommand=Extract<CaseCommand,{action:'RECORD_INTRODUCTION_PERMISSION'|'REVOKE_INTRODUCTION_PERMISSION'}>;
export type PermissionPayload=Omit<PermissionCommand,keyof CommandBase>;
type PermissionProps={session:Participation;playerName:string;busy?:boolean;onRecord?:(currentClub:string,evidence:string)=>Promise<boolean>;onRevoke?:(reason:string)=>Promise<boolean>};
export function IntroductionPermission(props:PermissionProps) {
 return <PermissionForm key={`${props.session.id}:${props.session.version}`} {...props}/>;
}
function PermissionForm({session,playerName,busy=false,onRecord,onRevoke}:PermissionProps) {
 const {copy}=useAdmissionCopy();const p=session.introductionPermission;
 const [club,setClub]=useState(''),[evidence,setEvidence]=useState(''),[reason,setReason]=useState('');
 if(!p?.required)return null;
 const labels={PENDING:copy('Evidence needed','საჭიროა მტკიცებულება'),COMPLETE:copy('Permission evidence recorded','ნებართვის მტკიცებულება დაფიქსირდა'),REVOKED:copy('Permission withdrawn — new evidence needed','ნებართვა გაუქმდა — საჭიროა ახალი მტკიცებულება'),STALE:copy('Current club changed — review evidence','მიმდინარე კლუბი შეიცვალა — გადაამოწმეთ მტკიცებულება'),EXPIRED:copy('Session permission has expired','სესიის ნებართვის ვადა გასულია'),HISTORICAL_UNVERIFIED:copy('Historical session — no permission evidence recorded','ისტორიული სესია — ნებართვის მტკიცებულება არ არის დაფიქსირებული'),NOT_REQUIRED:''};
 return <section className="admission-panel admission-notice" aria-label={copy('Current-club permission for this introduction','მიმდინარე კლუბის ნებართვა ამ გაცნობითი ვარჯიშისთვის')}>
  <h4>{copy('Current-club permission before this session','მიმდინარე კლუბის ნებართვა ამ სესიამდე')}</h4><p>{p.reason}</p><p role="status">{labels[p.status]}</p>
  {p.currentClub&&<p>{copy('Evidence source','მტკიცებულების წყარო')}: {p.currentClub}</p>}{p.evidence&&<p>{copy('Permission reference','ნებართვის მითითება')}: {p.evidence}</p>}
  {!p.allowsParticipation&&['INVITED','RECONFIRM_REQUIRED','CONFIRMED'].includes(session.status)&&<p>{copy('Next: obtain the permission and share its reference with the host. Authorized host staff must record it here before you confirm this session.','შემდეგი ნაბიჯი: მიიღეთ ნებართვა და გაუზიარეთ მისი მითითება მასპინძელს. უფლებამოსილმა თანამშრომელმა ის აქ უნდა დააფიქსიროს სესიის დადასტურებამდე.')}</p>}
  {p.canRecord&&onRecord&&<form className="admission-stack admission-form-grid" onSubmit={e=>{e.preventDefault();void onRecord(club.trim(),evidence.trim());}}>
   <p className="admission-field-wide">{copy(`Record actual permission received for ${playerName} and this session only. This records the host's evidence review.`,`${playerName} — დააფიქსირეთ მიღებული ნებართვა მხოლოდ ამ სესიისთვის. ეს მასპინძლის მტკიცებულების განხილვის ჩანაწერია.`)}</p>
   <label className="admission-field admission-field-wide">{copy('Current club / source contact','მიმდინარე კლუბი / წყაროს საკონტაქტო პირი')}<input required maxLength={500} disabled={busy} value={club} onChange={e=>setClub(e.target.value)}/></label>
   <label className="admission-field admission-field-wide">{copy('Actual permission reference','მიღებული ნებართვის მითითება')}<textarea required maxLength={2000} disabled={busy} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
   <button className="admission-secondary admission-button admission-field-wide" disabled={busy||!club.trim()||!evidence.trim()}>{copy('Record session permission','სესიის ნებართვის დაფიქსირება')}</button>
  </form>}
  {p.canRevoke&&onRevoke&&<details><summary>{copy('Withdraw recorded session permission','დაფიქსირებული სესიის ნებართვის გაუქმება')}</summary><form className="admission-stack admission-form-grid" onSubmit={e=>{e.preventDefault();void onRevoke(reason.trim());}}><label className="admission-field admission-field-wide">{copy('Reason for withdrawing permission','ნებართვის გაუქმების მიზეზი')}<textarea required maxLength={2000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="admission-secondary admission-button admission-field-wide" disabled={busy||!reason.trim()}>{copy('Withdraw session permission','სესიის ნებართვის გაუქმება')}</button></form></details>}
 </section>;
}
