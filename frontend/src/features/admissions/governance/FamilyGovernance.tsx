import { useCallback, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useAdmissionData } from '../applicant/useAdmissionData';
import { useAdmissionCopy } from '../applicant/copy';
import { countries, governanceGet, useGovernanceWrite, type GuardianStatus, type PrivacyItem } from './api';

export function GuardianReviewStatus({playerId}:{playerId:number}) {
    const {sessionId}=useAuth();const {copy}=useAdmissionCopy();
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<GuardianStatus>(`/admissions/players/${playerId}/guardian-review`,sessionId,signal),[playerId,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    return <section aria-label={copy('Guardian review status','მეურვის განხილვის სტატუსი')} className="admission-stack">
        {state.error?<p role="alert">{state.error}</p>:state.data?.status!=='NONE'&&state.data&&<>
            <p role="status">{state.data.status==='REVIEW'?copy('New commitments are paused for platform guardian review.','ახალი ვალდებულებები შეჩერებულია პლატფორმის მიერ მეურვის უფლებამოსილების განხილვამდე.'):copy('Platform review lifted the pause. Each agreement still needs current authority and consent.','პლატფორმამ შეზღუდვა მოხსნა. თითოეულ შეთანხმებას კვლავ სჭირდება მიმდინარე უფლებამოსილება და თანხმობა.')}</p>
            {state.data.outcome==='KEEP_RESTRICTION'&&<p>{copy('The reviewer kept the restriction. You can request a renewed review below; a different reviewer must handle it.','განმხილველმა შეზღუდვა დატოვა. ქვემოთ შეგიძლიათ ხელახალი განხილვა მოითხოვოთ; მას სხვა განმხილველი შეასრულებს.')}</p>}
            <p className="admission-muted">{copy('Contact responsible club staff directly about imminent attendance or collection. This review does not authorize collection.','მოახლოებული დასწრებისა თუ ბავშვის წამოყვანის შესახებ უშუალოდ კლუბის პასუხისმგებელ პირს დაუკავშირდით. ეს განხილვა ბავშვის წამოყვანის უფლებას არ ანიჭებს.')}</p>
        </>}
        <button type="button" className="admission-button" disabled={state.loading} onClick={state.refresh}>{copy('Refresh guardian review','მეურვის განხილვის განახლება')}</button>
    </section>;
}

export function AdmissionPrivacyRequests({caseId}:{caseId:number}) {
    const {copy}=useAdmissionCopy();const [open,setOpen]=useState(false);
    return <details className="admission-panel" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{copy('My admission data and privacy requests','ჩემი მიღების მონაცემები და კონფიდენციალურობის მოთხოვნები')}</summary>{open&&<PrivacyRequestContent caseId={caseId}/>}</details>;
}

function PrivacyRequestContent({caseId}:{caseId:number}) {
    const {sessionId}=useAuth();const {copy}=useAdmissionCopy();
    const [kind,setKind]=useState('ACCESS'),[country,setCountry]=useState(''),[message,setMessage]=useState('');
    const fetcher=useCallback((signal:AbortSignal)=>governanceGet<PrivacyItem[]>(`/admissions/cases/${caseId}/privacy`,sessionId,signal),[caseId,sessionId]);
    const state=useAdmissionData(fetcher,sessionId);
    const write=useGovernanceWrite<PrivacyItem[]>(items=>{state.setData(items);setMessage('');});
    return <div className="admission-stack">
        <p>{copy('Ask about this admission record, correct it, or request restriction or erasure. An appointed privacy reviewer will respond. This does not automatically erase your account, agreements or club records.','იკითხეთ ამ მიღების ჩანაწერზე, შეასწორეთ იგი ან მოითხოვეთ შეზღუდვა ან წაშლა. დანიშნული კონფიდენციალურობის განმხილველი გიპასუხებთ. ეს ავტომატურად არ შლის ანგარიშს, შეთანხმებებს ან კლუბის ჩანაწერებს.')}</p>
        <form className="admission-stack" onSubmit={e=>{e.preventDefault();write.submit(`/admissions/cases/${caseId}/privacy`,{kind,country,message:message.trim()});}}>
            <fieldset disabled={write.pending||write.busy}><legend>{copy('Request details','მოთხოვნის დეტალები')}</legend>
                <label>{copy('Request','მოთხოვნა')}<select value={kind} onChange={e=>setKind(e.target.value)}>
                    <option value="ACCESS">{copy('Access or copy','წვდომა ან ასლი')}</option><option value="CORRECTION">{copy('Correction','შესწორება')}</option><option value="RESTRICTION">{copy('Restrict processing','დამუშავების შეზღუდვა')}</option><option value="ERASURE">{copy('Erasure','წაშლა')}</option>
                </select></label>
                <label>{copy('Applicable country','შესაბამისი ქვეყანა')}<select required value={country} onChange={e=>setCountry(e.target.value)}><option value="">{copy('Select country','აირჩიეთ ქვეყანა')}</option>{countries.map(c=><option key={c} value={c}>{new Intl.DisplayNames(['en'],{type:'region'}).of(c)}</option>)}</select></label>
                <label>{copy('What would you like us to review?','რისი განხილვა გსურთ?')}<textarea required maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
                <p className="admission-muted">{copy('Describe the request without identity-document numbers or medical information. Any necessary evidence will be arranged through a controlled support channel.','აღწერეთ მოთხოვნა პირადობის დოკუმენტის ნომრებისა და სამედიცინო ინფორმაციის გარეშე. საჭირო მტკიცებულება დაცული მხარდაჭერის არხით შეთანხმდება.')}</p>
                <button type="submit" className="admission-button" disabled={!message.trim()||!country}>{copy('Submit privacy request','კონფიდენციალურობის მოთხოვნის გაგზავნა')}</button>
            </fieldset>
            {write.pending&&<button type="button" className="admission-button" disabled={write.busy} onClick={()=>void write.retry()}>{copy('Retry same request','იმავე მოთხოვნის გამეორება')}</button>}
            {write.error&&<p role="alert">{write.error}</p>}
        </form>
        {state.error?<p role="alert">{state.error}</p>:<ul className="admission-timeline">{state.data?.map(item=><li key={item.id}><strong>#{item.id} · {item.kind}</strong><p>{item.message}</p><p>{item.status==='OPEN'?copy('Awaiting privacy review','კონფიდენციალურობის განხილვის მოლოდინში'):copy('Response recorded','პასუხი დაფიქსირებულია')}</p>{item.response&&<p>{item.response}</p>}<p className="admission-muted">{copy('Initial-response service target','პირველი პასუხის შიდა ვადა')}: {new Date(item.targetAt).toLocaleString()}</p></li>)}</ul>}
        <p className="admission-muted">{copy('The service target is not a legal deadline. If the response leaves something unresolved, submit a follow-up describing what still needs attention.','შიდა ვადა სამართლებრივი ვადა არ არის. თუ პასუხით საკითხი არ გადაწყდა, გამოგზავნეთ შემდგომი მოთხოვნა და აღწერეთ დარჩენილი საკითხი.')}</p>
        <button type="button" className="admission-button" disabled={state.loading} onClick={state.refresh}>{copy('Refresh requests','მოთხოვნების განახლება')}</button>
    </div>;
}
