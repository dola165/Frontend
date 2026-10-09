import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { playerPath, positivePlayerId, usePlayerSelection } from '../../parents/playerSelection';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../api/axiosConfig';
import { fetchAdmissionHome, fetchAdmissionInquiry, commandAdmissionInquiry, submitAdmissionInquiry } from '../api';
import type { AdmissionInquiry, InquiryInput, InquiryCommand, InquiryAction } from '../types';
import { AddChild } from '../../parents/AddChild';
import { useAdmissionTab } from './useAdmissionTab';
import { AdmissionError, AdmissionFrame, AdmissionLoading, AdmissionSection } from './AdmissionFrame';
import { PlayerCardEditor } from './PlayerCardEditor';
import { useAdmissionCopy } from './copy';
import { useAdmissionData } from './useAdmissionData';
import { useAdmissionMutation } from './useAdmissionMutation';
import { useInquiryCopy } from '../inquiryPresentation';

export function GeneralAdmissionInquiryPage() {
    const {organizationId}=useParams();const {user,sessionId}=useAuth();
    return <GeneralInquiryContent key={`${organizationId}:${user?.id}:${sessionId}`} organizationId={Number(organizationId)}/>;
}
function GeneralInquiryContent({organizationId}:{organizationId:number}) {
    const {sessionId,user}=useAuth();const {copy}=useAdmissionCopy();
    const {requestedPlayerId:selected,selectPlayer:setSelected}=usePlayerSelection();
    const [params]=useSearchParams();const groupId=positivePlayerId(params.get("group"));const squadId=positivePlayerId(params.get("squad"));const programmeId=positivePlayerId(params.get("programme"));
    const valid=Number.isSafeInteger(organizationId)&&organizationId>0;
    const organization=useAdmissionData(useCallback(signal=>valid?apiClient.get<{profile:{displayName:string}}>(`/organizations/${organizationId}/presentation`,{signal}).then(r=>r.data):Promise.reject(new Error('Invalid organization')),[organizationId,valid]));
    const home=useAdmissionData(useCallback(signal=>fetchAdmissionHome(sessionId,signal),[sessionId]),sessionId);
    const people:{id:number;name:string}[]=home.error?[]:[...(home.data?.participants??[])];
    if(!home.error&&user?.id&&!people.some(p=>p.id===user.id))people.unshift({id:user.id,name:user.fullName||user.username||copy('Myself','მე')});
    const person=people.find(p=>p.id===selected);
    return <AdmissionFrame title={copy('Ask for a suitable football arrangement','შესაფერისი საფეხბურთო მონაწილეობის შესახებ კითხვა')} description={organization.data?.profile.displayName} back="/map">
        {organization.loading?<AdmissionLoading/>:organization.error?<AdmissionError message={organization.error} retry={organization.refresh}/>:<section className="admission-panel">
            <p>{copy('You can ask the organization to recommend a group before choosing one. This inquiry agrees to no schedule, fees, attendance or enrollment.','შეგიძლიათ ჯგუფის არჩევამდე ორგანიზაციას რჩევა სთხოვოთ. კითხვა განრიგზე, გადასახადზე, დასწრებაზე ან ჩარიცხვაზე თანხმობა არ არის.')}</p>
            {home.loading?<AdmissionLoading/>:home.error?<AdmissionError message={home.error} retry={home.refresh}/>:<>
                <div className="admission-field"><label htmlFor="admission-inquiry-player">{copy('Player card','მოთამაშის ბარათი')}</label><select id="admission-inquiry-player" value={person?.id??''} onChange={e=>setSelected(Number(e.target.value)||undefined)}><option value="">{copy('General question · no player','ზოგადი კითხვა · მოთამაშის გარეშე')}</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <GeneralInquiryForm key={person?.id??"general"} playerId={person?.id??null} playerName={person?.name??copy("General question","ზოგადი კითხვა")} organizationId={organizationId} groupId={groupId} squadId={squadId} programmeId={programmeId}/>
                {home.data?.selfCardNeedsDetails&&user?.id&&<PlayerCardEditor playerId={user.id} initialName={user.fullName||user.username||''} onChanged={home.refresh}/>}
            </>}
            <AddChild onCreated={id=>{home.refresh();setSelected(id);}}/>
            <Link className="admission-button" to={playerPath("/parent",selected)}>{copy('Manage existing child connections','არსებული ბავშვის კავშირების მართვა')}</Link>
        </section>}
    </AdmissionFrame>;
}
export function GeneralInquiryForm({organizationId,playerId,playerName,groupId,squadId,programmeId}:{organizationId:number;playerId:number|null;playerName:string;groupId?:number;squadId?:number;programmeId?:number}) {
    const {sessionId,user}=useAuth();const {copy}=useAdmissionCopy();const navigate=useNavigate();
    const draftKey=`admission-form:${user?.id}:${sessionId}:inquiry:${organizationId}:${playerId}:${groupId??'general'}:${squadId??'any'}:${programmeId??'any'}`;
    const [message,setMessage]=useState(()=>{try{return sessionStorage.getItem(draftKey)||'';}catch{return '';}});
    useEffect(()=>{try{sessionStorage.setItem(draftKey,message);}catch{/* Receipt persistence still precedes every mutation. */}},[message,draftKey]);
    const mutation=useAdmissionMutation<Omit<InquiryInput,'requestId'>,AdmissionInquiry>(playerId??0,`inquiry:${organizationId}:${groupId??'general'}:${squadId??'any'}`,body=>submitAdmissionInquiry(organizationId,body,sessionId),result=>{sessionStorage.removeItem(draftKey);navigate(result.conversationDestination??`/admissions/inquiries/${result.id}`);});
    return <form className="admission-stack" onSubmit={e=>{e.preventDefault();void mutation.run({playerId,message:message.trim(),...(groupId?{groupId}:{}),...(squadId?{squadId}:{}),...(programmeId?{programmeId}:{})});}}><h2>{playerId?copy(`Ask about ${playerName}`,`${playerName} — კითხვა`):copy('General question','ზოგადი კითხვა')}</h2>
        <label>{copy('What would you like help finding?','რის მოძებნაში გჭირდებათ დახმარება?')}<textarea required maxLength={2000} value={message} disabled={Boolean(mutation.pending)} onChange={e=>setMessage(e.target.value)}/></label>
        <p>{copy('Mention relevant experience, preferred times or sibling conditions. No photo or playing career is required.','მიუთითეთ საჭირო გამოცდილება, სასურველი დრო ან და-ძმის პირობა. ფოტო ან სათამაშო კარიერა საჭირო არ არის.')}</p>
        {mutation.error&&<AdmissionError message={mutation.error}/>}
        {mutation.pending?<button type="button" className="admission-button" disabled={mutation.busy} onClick={()=>void mutation.retry()}>{copy('Retry saved inquiry','შენახული კითხვის გამეორება')}</button>:<button className="admission-button admission-primary" disabled={mutation.busy||!message.trim()}>{copy('Send general inquiry','ზოგადი კითხვის გაგზავნა')}</button>}
    </form>;
}
export function AdmissionInquiryPage() {
    const {inquiryId}=useParams();const {user,sessionId}=useAuth();return <InquiryContent key={`${inquiryId}:${user?.id}:${sessionId}`} id={Number(inquiryId)}/>;
}
function InquiryContent({id}:{id:number}) {
    const {sessionId}=useAuth();const {copy,status,next}=useInquiryCopy();
    const data=useAdmissionData(useCallback(signal=>fetchAdmissionInquiry(id,sessionId,signal),[id,sessionId]),sessionId);
    const tab=useAdmissionTab(['overview','conversation','history']);
    const inquiry=data.data;const [detailsParams]=useSearchParams();
    if(inquiry?.conversationDestination&&inquiry.playerId&&detailsParams.get("details")!=="1")return <Navigate to={inquiry.conversationDestination} replace/>;
    return <AdmissionFrame title={copy('Your club enquiry','თქვენი კითხვა კლუბისთვის')} description={data.error?undefined:inquiry?.organizationName} back="/admissions" tabs={[{id:'overview',label:copy('Overview','მიმოხილვა')},{id:'conversation',label:copy('Conversation','საუბარი')},{id:'history',label:copy('History','ისტორია')}]} activeTab={tab}>
        {data.loading?<AdmissionLoading/>:data.error?<AdmissionError message={data.error} retry={data.refresh}/>:inquiry&&<div className="admission-stack"><AdmissionSection active={tab==='overview'}><section className="admission-panel"><h2>{inquiry.playerName||copy("General question","ზოგადი კითხვა")}</h2><span className="admission-badge">{status(inquiry)}</span><p>{inquiry.message}</p>
            <p role="status">{next(inquiry)}</p>
            {inquiry.conversationDestination&&<Link className="admission-button" to={inquiry.conversationDestination}>{copy("Open club conversation","კლუბთან საუბრის გახსნა")}</Link>}
            {inquiry.caseId&&<><p>{copy('Review the proposed group and its next steps. Routing this inquiry gives no consent to attendance or enrollment.','იხილეთ შემოთავაზებული ჯგუფი და შემდეგი ნაბიჯები. ამ კითხვის საქმეში გადატანა დასწრებაზე ან ჩარიცხვაზე თანხმობა არ არის.')}</p><Link className="admission-button admission-primary" to={`/admissions/cases/${inquiry.caseId}`}>{copy('Review the proposed group','შემოთავაზებული ჯგუფის განხილვა')}</Link></>}
        </section><Link className="admission-button" to={playerPath('/admissions/inquiries/'+id+'?details=1&tab=conversation',inquiry.playerId)}>{copy('Send more information','დამატებითი ინფორმაციის გაგზავნა')}</Link></AdmissionSection><AdmissionSection active={tab==='conversation'}>{inquiry.actions.includes('ASSOCIATE_PLAYER')&&<AssociateInquiryPlayer inquiry={inquiry} onChanged={data.setData} refresh={data.refresh}/>}
        {(['MESSAGE','RESOLVE','REOPEN','WITHDRAW'] as const).filter(action=>inquiry.actions.includes(action)).map(action=><InquiryResponse key={`${action}:${id}`} inquiry={inquiry} action={action} onChanged={data.setData} refresh={data.refresh}/>)}
        </AdmissionSection><AdmissionSection active={tab==='history'}><section className="admission-panel"><h2>{copy('Inquiry history','კითხვის ისტორია')}</h2><ol className="admission-timeline">{inquiry.history.map(e=><li key={e.id}><time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time><strong>{e.actorName}</strong>{e.message&&<p>{e.message}</p>}</li>)}</ol></section></AdmissionSection></div>}
    </AdmissionFrame>;
}
function InquiryResponse({inquiry:i,action,onChanged,refresh}:{inquiry:AdmissionInquiry;action:Extract<InquiryAction,'MESSAGE'|'WITHDRAW'|'RESOLVE'|'REOPEN'>;onChanged:(i:AdmissionInquiry)=>void;refresh:()=>void}) {
    const {sessionId}=useAuth();const {copy,action:actionLabel}=useInquiryCopy();const [message,setMessage]=useState('');
    const mutation=useAdmissionMutation<Omit<InquiryCommand,'requestId'>,AdmissionInquiry>(i.playerId??0,`inquiry:${i.id}:${action}`,body=>commandAdmissionInquiry(i.id,body,sessionId),result=>{setMessage('');onChanged(result);},refresh);
    const label=action==='MESSAGE'?copy('Send more information','დამატებითი ინფორმაციის გაგზავნა'):actionLabel(action);
    const textRequired=action==='MESSAGE'||action==='WITHDRAW';
    return <details className="admission-panel"><summary className="admission-button">{label}</summary><form className="admission-stack" onSubmit={e=>{e.preventDefault();void mutation.run({expectedVersion:i.version,action,message:message.trim()});}}><label>{textRequired?copy('Message or reason','შეტყობინება ან მიზეზი'):copy('Optional message','არასავალდებულო შეტყობინება')}<textarea required={textRequired} maxLength={2000} value={message} disabled={Boolean(mutation.pending)} onChange={e=>setMessage(e.target.value)}/></label>{mutation.error&&<AdmissionError message={mutation.error}/>}{mutation.pending?<button type="button" className="admission-button" disabled={mutation.busy} onClick={()=>void mutation.retry()}>{copy('Retry saved response','შენახული პასუხის გამეორება')}</button>:<button className="admission-button" disabled={mutation.busy||(textRequired&&!message.trim())}>{label}</button>}</form></details>;
}

function AssociateInquiryPlayer({inquiry, onChanged, refresh}: {inquiry: AdmissionInquiry; onChanged: (i: AdmissionInquiry) => void; refresh: () => void}) {
    const {sessionId} = useAuth(); const {copy} = useAdmissionCopy();
    const [playerId, setPlayerId] = useState<number>();
    const home = useAdmissionData(useCallback(signal => fetchAdmissionHome(sessionId, signal), [sessionId]), sessionId);
    const mutation = useAdmissionMutation<Omit<InquiryCommand, 'requestId'>, AdmissionInquiry>(inquiry.playerId ?? 0, `inquiry:${inquiry.id}:associate`, body => commandAdmissionInquiry(inquiry.id, body, sessionId), onChanged, refresh);
    return <details className="admission-panel"><summary>{copy('Discuss a player or arrange a first visit', 'მოთამაშეზე საუბარი ან პირველ ვიზიტზე შეთანხმება')}</summary>
        {home.loading ? <AdmissionLoading/> : home.error ? <AdmissionError message={home.error} retry={home.refresh}/> : <form className="admission-stack" onSubmit={event => { event.preventDefault(); if(playerId) void mutation.run({action:'ASSOCIATE_PLAYER',expectedVersion:inquiry.version,playerId,message:''}); }}>
            <p>{copy('Choose whose details to share with this club. Your existing conversation stays connected.', 'აირჩიეთ, ვისი მონაცემები გაუზიაროთ კლუბს. არსებული საუბარი შენარჩუნდება.')}</p>
            <label>{copy('Player', 'მოთამაშე')}<select required value={playerId ?? ''} disabled={Boolean(mutation.pending)} onChange={e => setPlayerId(Number(e.target.value)||undefined)}><option value="">{copy('Choose a player', 'აირჩიეთ მოთამაშე')}</option>{home.data?.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            {mutation.error && <AdmissionError message={mutation.error}/>}
            <button type={mutation.pending ? 'button' : 'submit'} className="admission-button" disabled={mutation.busy || (!mutation.pending && !playerId)} onClick={mutation.pending ? () => void mutation.retry() : undefined}>{mutation.pending ? copy('Retry saved update', 'შენახული განახლების გამეორება') : copy('Share selected player', 'არჩეული მოთამაშის გაზიარება')}</button>
        </form>}
    </details>;
}
