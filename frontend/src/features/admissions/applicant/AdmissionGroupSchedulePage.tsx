import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchAdmissionGroupSchedule } from '../api';
import { useAdmissionTab } from './useAdmissionTab';
import { AdmissionError, AdmissionFrame, AdmissionLoading, AdmissionSection } from './AdmissionFrame';
import { TermsFacts } from './OpportunityFacts';
import { useAdmissionCopy } from './copy';
import { useAdmissionData } from './useAdmissionData';
export function AdmissionGroupSchedulePage() {
    const {groupId}=useParams();const [params]=useSearchParams();const playerId=Number(params.get('playerId'));const {user,sessionId}=useAuth();
    return <ScheduleContent key={`${groupId}:${playerId}:${user?.id}:${sessionId}`} id={Number(groupId)} playerId={playerId}/>;
}
function ScheduleContent({id,playerId}:{id:number;playerId:number}) {
    const {sessionId}=useAuth();const {copy}=useAdmissionCopy();const valid=Number.isSafeInteger(id)&&id>0&&Number.isSafeInteger(playerId)&&playerId>0;
    const data=useAdmissionData(useCallback(signal=>valid?fetchAdmissionGroupSchedule(id,playerId,sessionId,signal):Promise.reject(new Error('Choose the enrolled player from My requests.')),[id,playerId,sessionId,valid]),sessionId);
    const schedule=data.data;
    const tab=useAdmissionTab(['overview','sessions','terms']);
    return <AdmissionFrame title={data.error?copy('Group schedule','ჯგუფის განრიგი'):schedule?.groupName||copy('Group schedule','ჯგუფის განრიგი')} back="/admissions" tabs={[{id:'overview',label:copy('Overview','მიმოხილვა')},{id:'sessions',label:copy('Sessions','სესიები'),count:schedule?.sessions.length},{id:'terms',label:copy('Agreement','შეთანხმება')}]} activeTab={tab}>
        {data.loading?<AdmissionLoading/>:data.error?<AdmissionError message={data.error} retry={data.refresh}/>:schedule&&<div className="admission-stack"><AdmissionSection active={tab==='overview'}><section className="admission-panel"><h2>{copy('Agreed regular arrangement','შეთანხმებული მუდმივი მონაწილეობა')}</h2><p>{schedule.schedule} · {schedule.timezone}</p><p>{schedule.location.name} · {schedule.location.address}</p><p>{copy('This is the enrollment agreement. Individual occurrences may be added or revised by responsible staff. Check each event before travelling.','ეს ჩარიცხვის შეთანხმებაა. ცალკეული შეხვედრები პასუხისმგებელმა თანამშრომელმა შეიძლება დაამატოს ან შეცვალოს. გამგზავრებამდე შეამოწმეთ შეხვედრა.')}</p></section></AdmissionSection>
        <AdmissionSection active={tab==='sessions'}><section className="admission-panel"><h2>{copy('Recorded upcoming sessions','დაფიქსირებული მომავალი სესიები')}</h2>{schedule.sessions.length?schedule.sessions.map(s=><article key={s.id} className="admission-card"><h3>{s.title}</h3><p>{new Date(s.startsAt).toLocaleString(undefined,{timeZone:schedule.timezone})} — {new Date(s.endsAt).toLocaleTimeString(undefined,{timeZone:schedule.timezone})} · {schedule.timezone}</p>{s.location&&<p>{s.location}</p>}<Link className="admission-button" to={`/squads/${s.squadId}?tab=sessions&sessionId=${s.id}&at=${encodeURIComponent(new Date(s.startsAt).toISOString())}`}>{copy('Review this session','ამ სესიის განხილვა')}</Link></article>):<p>{copy('No individual occurrences have been recorded. The recurring arrangement above still applies; ask responsible staff about the next meeting.','ცალკეული შეხვედრები ჯერ არ დაფიქსირებულა. ზემოთ მოცემული განმეორებითი შეთანხმება მოქმედებს; შემდეგი შეხვედრა პასუხისმგებელ თანამშრომელთან დააზუსტეთ.')}</p>}</section></AdmissionSection><AdmissionSection active={tab==='terms'}><section className="admission-panel"><h2>{copy('Enrollment agreement','ჩარიცხვის შეთანხმება')}</h2><TermsFacts terms={schedule.terms}/></section></AdmissionSection></div>}
    </AdmissionFrame>;
}
