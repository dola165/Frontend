import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginPath } from '../../../utils/authRedirect';
import { fetchAdmissionHome, fetchOpportunity, submitAdmission } from '../api';
import type { Opportunity, Participant, Submission } from '../types';
import { AddChild } from '../../parents/AddChild';
import { useAdmissionData } from './useAdmissionData';
import { useAdmissionMutation } from './useAdmissionMutation';
import { AdmissionError, AdmissionFrame, AdmissionLoading } from './AdmissionFrame';
import { OpportunityFacts, termsComplete } from './OpportunityFacts';
import { useAdmissionCopy } from './copy';
import { PlayerCardEditor } from './PlayerCardEditor';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';

export function OpportunityDetailPage() {
    const {opportunityId}=useParams();const {user,sessionId}=useAuth();
    return <OpportunityDetailContent key={`${opportunityId}:${user?.id}:${sessionId}`} id={Number(opportunityId)}/>;
}
function OpportunityDetailContent({id}:{id:number}) {
    const {isAuthenticated,sessionId,user}=useAuth();const {copy,availability}=useAdmissionCopy();
    const [params]=useSearchParams();
    const {requestedPlayerId,selectPlayer}=usePlayerSelection();
    const opportunity=useAdmissionData(useCallback(signal=>fetchOpportunity(id,signal),[id]));
    const home=useAdmissionData(useCallback(signal=>isAuthenticated?fetchAdmissionHome(sessionId,signal):Promise.resolve({participants:[],cases:[]}),[isAuthenticated,sessionId]),isAuthenticated?sessionId:undefined);
    const selected=requestedPlayerId;
    const player=home.error?undefined:home.data?.participants.find(p=>p.id===selected);
    const select=(id:number)=>selectPlayer(id||undefined);
    const o=opportunity.data;
    const existing=player&&o?home.data?.cases.find(c=>c.playerId===player.id&&c.organizationId===o.organizationId&&c.intake===o.intake&&c.stage!=="CLOSED"&&c.enrollment?.status!=="CANCELLED"):undefined;
    return <AdmissionFrame title={o?.name||copy('Joining arrangements','მონაწილეობის პირობები')} description={o?.organizationName} back="/admissions/opportunities">
        {opportunity.loading?<AdmissionLoading/>:opportunity.error?<AdmissionError message={opportunity.error} retry={opportunity.refresh}/>:o&&<div className="admission-columns">
            <section className="admission-panel"><span className="admission-badge">{availability(o.availability)}</span><OpportunityFacts opportunity={o}/><Link className="admission-button" to={playerPath(`/admissions/organizations/${o.organizationId}/inquire?group=${o.id}`,player?.id)}>{copy("Ask this organization to recommend a group","სთხოვეთ ორგანიზაციას ჯგუფის რეკომენდაცია")}</Link>{o.location.latitude!=null&&o.location.longitude!=null&&<Link className="admission-button" to={`/world?opportunity=${o.id}${player?`&player=${player.id}`:''}`}>{copy('View actual training venue on map','ვარჯიშის რეალური ადგილის ნახვა რუკაზე')}</Link>}
                <p>{copy('Exploring or requesting a session keeps an existing club relationship. A session confirmation gives permission for that arrangement; enrollment and official match eligibility are separate.','ძიება ან სესიის მოთხოვნა არსებულ კლუბის კავშირს ინარჩუნებს. სესიის დადასტურება მხოლოდ ამ შეთანხმებას ეხება; ჩარიცხვა და ოფიციალური თამაშის უფლება ცალკეა.')}</p>
            </section><aside className="admission-stack">
                {!isAuthenticated?<section className="admission-panel"><h2>{copy('Choose your next step','აირჩიეთ შემდეგი ნაბიჯი')}</h2><p>{copy('Sign in to select yourself or an authorized child. We will keep this group ready for you.','შედით საკუთარი თავის ან დაკავშირებული ბავშვის ასარჩევად. არჩეული ჯგუფი შენარჩუნდება.')}</p><Link className="admission-button admission-primary" to={buildLoginPath(`/admissions/opportunities/${id}${params.size?`?${params}`:''}`)}>{copy('Sign in to continue','შესვლა გასაგრძელებლად')}</Link></section>:<>
                    <section className="admission-panel"><h2>{copy('Who is joining?','ვინ მონაწილეობს?')}</h2>{home.loading?<AdmissionLoading/>:home.error?<AdmissionError message={home.error} retry={home.refresh}/>:<>
                        <div className="admission-field"><label htmlFor="admission-player-card">{copy('Player card','მოთამაშის ბარათი')}</label><select id="admission-player-card" value={player?.id??''} onChange={e=>select(Number(e.target.value))}><option value="">{copy('Choose a player','აირჩიეთ მოთამაშე')}</option>{home.data?.participants.map(p=><option key={p.id} value={p.id}>{p.name}{p.minor?` · ${copy('child','ბავშვი')}`:` · ${copy('adult','სრულწლოვანი')}`}</option>)}</select></div>
                        {player&&<p role="status">{player.name} · {copy('Born','დაბადების წელი')} {player.dateOfBirth?.slice(0,4)||copy('Basic details needed','საჭიროა ძირითადი მონაცემები')}{player.minor?` · ${player.guardian?copy('Current guardian connection','მოქმედი მეურვის კავშირი'):copy('Guardian confirmation required','საჭიროა მეურვის დადასტურება')}`:''}</p>}
                        <p>{copy('Child cards are private. An email verification confirms the adult’s contact address; it does not verify legal guardianship.','ბავშვის ბარათი პირადია. ელფოსტის დადასტურება საკონტაქტო მისამართს ადასტურებს; კანონიერი მეურვეობის შემოწმებას არ ნიშნავს.')}</p>
                    </>}</section>
                    {existing&&<section className="admission-panel"><h2>{copy('Continue your joining arrangement','გააგრძელეთ არსებული შეთანხმება')}</h2><p>{copy(`${player?.name} already has an arrangement for ${existing.groupName}. Open it to discuss this group or review the next step.`,`${player?.name} — არსებული შეთანხმება: ${existing.groupName}. განიხილეთ ჯგუფი ან შემდეგი ნაბიჯი.`)}</p><Link className="admission-button admission-primary" to={playerPath(`/admissions/cases/${existing.id}`,player?.id)}>{copy('Open current arrangement','მიმდინარე შეთანხმების გახსნა')}</Link></section>}
                    {!existing&&player?.dateOfBirth&&<SubmissionForm key={player.id} opportunity={o} participant={player} refresh={opportunity.refresh}/>}
                    {home.data?.selfCardNeedsDetails&&user?.id&&<PlayerCardEditor playerId={user.id} initialName={user.fullName||user.username||''} onChanged={()=>{home.refresh();select(user.id);}}/>}
                    {player&&!(player.id===user?.id&&home.data?.selfCardNeedsDetails)&&<PlayerCardEditor key={`card:${player.id}`} playerId={player.id} participant={player} onChanged={home.refresh}/>}
                    <AddChild onCreated={id=>{home.refresh();select(id);}}/>
                    <section className="admission-panel"><h3>{copy('Child already recorded?','ბავშვი უკვე რეგისტრირებულია?')}</h3><p>{copy('Ask the current guardian or club for a secure invitation. Review it in Family connections, then return to this group. A matching name or birth date never gives access.','სთხოვეთ მოქმედ მეურვეს ან კლუბს უსაფრთხო მოწვევა. იხილეთ ოჯახურ კავშირებში და დაბრუნდით ამ ჯგუფში. სახელის ან დაბადების თარიღის დამთხვევა წვდომას არ იძლევა.')}</p><Link className="admission-button" to={playerPath("/parent",player?.id)}>{copy('Family connections','ოჯახური კავშირები')}</Link></section>
                </>}
            </aside>
        </div>}
    </AdmissionFrame>;
}
type FormDraft={message:string;siblingConstraint:string;emergencyContact:string};
function SubmissionForm({opportunity:o,participant:p,refresh}:{opportunity:Opportunity;participant:Participant;refresh:()=>void}) {
    const {user,sessionId}=useAuth();const navigate=useNavigate();const {copy}=useAdmissionCopy();
    const key=`admission-form:${user?.id}:${sessionId}:${o.id}:${p.id}`;
    const [draft,setDraft]=useState<FormDraft>(()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')||{message:'',siblingConstraint:'',emergencyContact:''};}catch{return {message:'',siblingConstraint:'',emergencyContact:''};}});
    const [acceptedVersion,setAcceptedVersion]=useState<number|null>(null);
    const accept=acceptedVersion===o.version;
    useEffect(()=>{try{sessionStorage.setItem(key,JSON.stringify(draft));}catch{/* The mutation still requires a durable receipt before sending. */}},[draft,key]);
    const mutation=useAdmissionMutation<Omit<Submission,'requestId'>,Awaited<ReturnType<typeof submitAdmission>>>(p.id,`submit:${o.id}`,body=>submitAdmission(body,sessionId),result=>{sessionStorage.removeItem(key);navigate(`/admissions/cases/${result.id}`);},refresh);
    const birthYearEligible=Number(p.dateOfBirth?.slice(0,4))>=o.birthYearFrom&&Number(p.dateOfBirth?.slice(0,4))<=o.birthYearTo;
    const eligible=birthYearEligible&&(o.gender==='ANY'||o.gender===p.gender);
    const canCommit=(!p.minor||p.guardian)&&p.restriction!=='REVIEW';
    const familyReview=o.method==='DIRECT'&&Boolean(draft.siblingConstraint.trim());
    const direct=o.method==='DIRECT'&&o.availability==='PLACES_AVAILABLE'&&!familyReview;
    const waitlist=o.availability==='WAITLIST';
    const active=o.intakeOpen&&o.availability!=='CLOSED';
    const needEmergency=direct&&o.terms.requirements.includes('EMERGENCY_CONTACT');
    const label=waitlist?copy('Join waiting list','მოლოდინის სიაში ჩაწერა'):familyReview?copy('Request staff review','თანამშრომლის განხილვის მოთხოვნა'):direct?copy('Confirm enrollment','ჩარიცხვის დადასტურება'):o.method==='SELECTIVE'?copy('Send application','განაცხადის გაგზავნა'):copy('Request an introduction','გაცნობითი ვარჯიშის მოთხოვნა');
    const submit=()=>mutation.run({opportunityId:o.id,opportunityVersion:o.version,playerId:p.id,intent:waitlist?'WAITLIST':direct?'DIRECT_ENROLL':'REQUEST',message:[draft.message.trim(),draft.siblingConstraint.trim()?`${copy('Family timing / sibling condition','ოჯახის დროის / და-ძმის პირობა')}: ${draft.siblingConstraint.trim()}`:''].filter(Boolean).join('\n')||undefined,siblingConstraint:draft.siblingConstraint.trim()||undefined,emergencyContact:draft.emergencyContact.trim()||undefined,...(direct?{acceptTerms:accept}:{})});
    return <form className="admission-panel" onSubmit={e=>{e.preventDefault();void submit();}} aria-busy={mutation.busy}><h2>{label}</h2><p><strong>{p.name}</strong> · {o.name}</p>
        {o.gender!=='ANY'&&!p.gender&&<p className="admission-notice">{copy('This group uses a gender category. Add your declared gender in the reusable player card below, or ask the organization for group guidance.','ამ ჯგუფს სქესის კატეგორია აქვს. ქვემოთ, მოთამაშის მრავალჯერად ბარათში, მიუთითეთ თქვენი სქესი ან სთხოვეთ ორგანიზაციას ჯგუფის შერჩევაში რჩევა.')}</p>}
        {o.gender!=='ANY'&&p.gender&&o.gender!==p.gender&&<p className="admission-notice" role="status">{copy('The selected player does not match this group’s published gender category. Choose a suitable group or ask the organization to recommend one.','არჩეული მოთამაშე ამ ჯგუფის გამოქვეყნებულ სქესის კატეგორიას არ შეესაბამება. აირჩიეთ შესაფერისი ჯგუფი ან სთხოვეთ ორგანიზაციას რეკომენდაცია.')}</p>}
        {!birthYearEligible&&<p className="admission-notice">{copy('This birth year is outside the published range. Choose a suitable group or ask the club to recommend one.','დაბადების წელი გამოქვეყნებულ დიაპაზონს არ შეესაბამება. აირჩიეთ შესაფერისი ჯგუფი ან რჩევისთვის მიმართეთ კლუბს.')}</p>}
        {!canCommit&&<p className="admission-notice">{copy('A current guardian must confirm participation and enrollment. You can still express interest.','მონაწილეობა და ჩარიცხვა მოქმედმა მეურვემ უნდა დაადასტუროს. ინტერესის გამოხატვა კვლავ შეგიძლიათ.')}</p>}
        <label>{copy('What should the club know? (optional)','რა უნდა იცოდეს კლუბმა? (არასავალდებულო)')}<textarea maxLength={2000} disabled={Boolean(mutation.pending)} value={draft.message} onChange={e=>setDraft({...draft,message:e.target.value})}/></label>
        {p.minor&&<><label htmlFor={`admission-sibling-${p.id}`}>{copy('Sibling or timing request (optional)','და-ძმის ან დროის მოთხოვნა (არასავალდებულო)')}<textarea id={`admission-sibling-${p.id}`} aria-describedby={`admission-sibling-help-${p.id}`} maxLength={1000} disabled={Boolean(mutation.pending)} value={draft.siblingConstraint} onChange={e=>setDraft({...draft,siblingConstraint:e.target.value})}/></label><p id={`admission-sibling-help-${p.id}`} className="admission-muted">{copy('Staff will review it. This does not reserve or accept another child’s place.','თანამშრომელი განიხილავს. სხვა ბავშვის ადგილი არ ჯავშნდება და არ დასტურდება.')}</p></>}
        {familyReview&&<p className="admission-notice">{copy('Your family condition needs staff review. This sends a request and does not immediately enroll this child.','ოჯახის პირობას თანამშრომელი უნდა გაეცნოს. იგზავნება მოთხოვნა; ბავშვი დაუყოვნებლივ არ ირიცხება.')}</p>}
        {needEmergency&&<label>{copy('Emergency contact: name and phone','გადაუდებელი საკონტაქტო პირი: სახელი და ტელეფონი')}<input required maxLength={500} disabled={Boolean(mutation.pending)} value={draft.emergencyContact} onChange={e=>setDraft({...draft,emergencyContact:e.target.value})}/></label>}
        {direct&&<><p>{copy('Confirm the published group, schedule, start date, mandatory charges and cancellation terms above. This action applies only to the selected player.','დაადასტურეთ ზემოთ გამოქვეყნებული ჯგუფი, განრიგი, დაწყების თარიღი, გადასახადები და გაუქმების პირობები. ქმედება მხოლოდ არჩეულ მოთამაშეს ეხება.')}</p><label className="admission-check"><input type="checkbox" required checked={accept} disabled={Boolean(mutation.pending)} onChange={e=>setAcceptedVersion(e.target.checked?o.version:null)}/>{copy(`I confirm these terms for ${p.name}.`,`ვადასტურებ ამ პირობებს: ${p.name}.`)}</label>{!termsComplete(o.terms,o.schedule,o.location)&&<p className="admission-notice">{copy('The club must complete essential terms before a place can be confirmed.','ადგილის დასადასტურებლად კლუბმა არსებითი პირობები უნდა შეავსოს.')}</p>}</>}
        {mutation.error&&<AdmissionError message={mutation.error}/>}
        {mutation.pending?<div className="admission-stack"><p className="admission-muted">{copy('A saved request has an unconfirmed response. Retry it with the original details.','შენახული მოთხოვნის პასუხი დაუდასტურებელია. გაიმეორეთ საწყისი მონაცემებით.')}</p><button type="button" className="admission-button admission-primary" disabled={mutation.busy} onClick={()=>void mutation.retry()}>{copy('Retry saved request','შენახული მოთხოვნის გამეორება')}</button></div>:<button className="admission-button admission-primary" disabled={mutation.busy||!eligible||!active||(direct&&(!canCommit||!accept||!termsComplete(o.terms,o.schedule,o.location)))}>{mutation.busy?copy('Confirming…','დასტურდება…'):label}</button>}
        {!active&&<p>{copy('This intake is closed. Existing arrangements remain in My requests.','მიღება დახურულია. არსებული შეთანხმებები იხილეთ „ჩემი მოთხოვნები“-ში.')}</p>}
        {!direct&&<p>{waitlist?copy('A waiting-list request promises no immediate place.','მოლოდინის მოთხოვნა დაუყოვნებლივ ადგილს არ გპირდებათ.'):copy('This request does not confirm attendance or enrollment. The next step appears in your case.','მოთხოვნა დასწრებას ან ჩარიცხვას არ ადასტურებს. შემდეგი ნაბიჯი თქვენს საქმეში გამოჩნდება.')}</p>}
    </form>;
}
