import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchAdmissionHome } from '../api';
import { AddChild } from '../../parents/AddChild';
import { useAdmissionData } from './useAdmissionData';
import { AdmissionError, AdmissionFrame, AdmissionLoading } from './AdmissionFrame';
import { useAdmissionCopy } from './copy';
import { PlayerCardEditor } from './PlayerCardEditor';
import { AdmissionInvitationCard } from './AdmissionInvitationCard';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';
import { useInquiryCopy } from '../inquiryPresentation';
import { LegacyAdmissions } from '../legacy/LegacyAdmissions';
export function AdmissionHomePage() {
    const {user,sessionId}=useAuth();
    return <AdmissionHomeContent key={`${user?.id}:${sessionId}`}/>;
}
function AdmissionHomeContent() {
    const {sessionId,user}=useAuth();const {copy,stage,owner,next}=useAdmissionCopy();const inquiryCopy=useInquiryCopy();
    const {requestedPlayerId:selected,selectPlayer:setSelected}=usePlayerSelection();
    const [historyOpen,setHistoryOpen]=useState(false);
    const home=useAdmissionData(useCallback(signal=>fetchAdmissionHome(sessionId,signal),[sessionId]),sessionId);
    const validSelected=home.data?.participants.some(p=>p.id===selected)?selected:undefined;
    const cases=home.data?.cases.filter(c=>!validSelected||c.playerId===validSelected)??[];
    return <AdmissionFrame title={copy('Joining football','ფეხბურთში მონაწილეობა')} description={copy('One player card, clear arrangements and a visible next step. Manage your own requests and each child’s journey here.','ერთი მოთამაშის ბარათი, ნათელი შეთანხმებები და ხილული შემდეგი ნაბიჯი. მართეთ საკუთარი და თითოეული ბავშვის მოთხოვნები აქ.')}>
        {home.loading?<AdmissionLoading/>:home.error?<AdmissionError message={home.error} retry={home.refresh}/>:<div className="admission-stack">
            <section className="admission-panel"><h2>{copy('Your player cards','თქვენი მოთამაშის ბარათები')}</h2><div className="admission-person-list" role="group" aria-label={copy('Filter cases by player','საქმეების გაფილტვრა მოთამაშით')}><button className="admission-button" aria-pressed={!validSelected} onClick={()=>setSelected(undefined)}>{copy('Everyone','ყველა')}</button>{home.data?.participants.map(p=><button className="admission-button" key={p.id} aria-pressed={validSelected===p.id} onClick={()=>setSelected(p.id)}>{p.name} · {p.dateOfBirth?.slice(0,4)||copy('Basic details needed','საჭიროა ძირითადი მონაცემები')}</button>)}</div>
                <p>{copy('Each request, session and agreement belongs to the named player. Changing this view never accepts or cancels another person’s arrangement.','თითოეული მოთხოვნა, სესია და შეთანხმება დასახელებულ მოთამაშეს ეკუთვნის. ხედის ცვლილება სხვის შეთანხმებას არ ადასტურებს ან აუქმებს.')}</p>
                <div className="admission-actions">{user?.id&&<button className="admission-button" onClick={()=>setSelected(user.id)}>My player card</button>}<Link className="admission-button" to={playerPath("/parent",validSelected)}>{copy('Manage family connections','ოჯახური კავშირების მართვა')}</Link><Link className="admission-button" to="/account">{copy('My account details','ჩემი ანგარიშის მონაცემები')}</Link></div>
            </section>
            {home.data?.selfCardNeedsDetails&&user?.id&&<PlayerCardEditor playerId={user.id} initialName={user.fullName||user.username||''} onChanged={home.refresh}/>}
            {validSelected&&!(validSelected===user?.id&&home.data?.selfCardNeedsDetails)&&<PlayerCardEditor key={validSelected} playerId={validSelected} participant={home.data?.participants.find(p=>p.id===validSelected)} onChanged={home.refresh}/>}
            {home.data?.invitations?.filter(i=>i.status==='PENDING').map(i=><AdmissionInvitationCard key={i.id} invitation={i} participants={home.data?.participants??[]} onChanged={home.refresh}/>)}
            {home.data?.inquiries?.filter(i=>!validSelected||i.playerId===validSelected||i.playerId==null).map(i=><article key={`inquiry:${i.id}`} className="admission-card"><p className="admission-eyebrow">{i.playerName||copy('General question','ზოგადი კითხვა')}</p><h2>{i.organizationName}</h2><p>{i.message}</p><p>{inquiryCopy.status(i)}</p><p>{inquiryCopy.next(i)}</p><Link className="admission-button" to={playerPath(`/admissions/inquiries/${i.id}`,i.playerId)}>{copy('View conversation and next step','საუბრისა და შემდეგი ნაბიჯის ნახვა')}</Link></article>)}
            <p className="admission-muted" role="status">{cases.length} {copy('requests shown','ნაჩვენები მოთხოვნა')}</p>
            <div className="admission-grid">{cases.map(c=><article key={c.id} className="admission-card"><p className="admission-eyebrow">{c.playerName}</p><h2>{c.groupName}</h2><p>{c.organizationName} · {c.intake}</p><span className="admission-badge">{stage(c.stage)}</span><p>{next(c.nextAction)} · {owner(c.nextAction.owner)}</p>{c.enrollment?.status==='CANCELLED'&&<p>{copy('Enrollment ended','ჩარიცხვა დასრულდა')}</p>}{c.enrollment?.status==='ACTIVE'&&<p>{copy('Confirmed start','დადასტურებული დასაწყისი')}: {c.enrollment.startDate}</p>}<Link className="admission-button admission-primary" to={`/admissions/cases/${c.id}`}>{copy('View next step and history','შემდეგი ნაბიჯისა და ისტორიის ნახვა')}</Link></article>)}</div>
            {cases.length===0&&<section className="admission-panel"><h2>{copy('Your next group starts here','თქვენი შემდეგი ჯგუფი აქ იწყება')}</h2><p>{copy('Beginners can start with basic details. No public photo, playing career or child login is needed.','დამწყებს ძირითადი მონაცემები საკმარისია. საჯარო ფოტო, კარიერა ან ბავშვის შესვლა საჭირო არ არის.')}</p><Link className="admission-button admission-primary" to={playerPath("/map",validSelected)}>{copy('Find a suitable group','შესაფერისი ჯგუფის მოძებნა')}</Link></section>}
            <details className="admission-panel" onToggle={e=>setHistoryOpen(e.currentTarget.open)}><summary>{copy('Earlier club participation records','კლუბში მონაწილეობის წინა ჩანაწერები')}</summary>{historyOpen&&<LegacyAdmissions sessionId={sessionId} playerId={validSelected} onChanged={home.refresh}/>}</details>
        </div>}
        <div style={{marginTop:24}}><AddChild onCreated={id=>{setSelected(id);home.refresh();}}/></div>
    </AdmissionFrame>;
}
