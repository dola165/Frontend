import { useInquiryCopy } from '../features/admissions/inquiryPresentation';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HeartHandshake, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaImage } from '../components/ui/MediaImage';
import { fetchJoiningChildren, type JoiningChild, type ParentChild } from '../features/parents/api';
import type { AuthSessionId } from '../utils/authStorage';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { AddChild } from '../features/parents/AddChild';
import { FamilyRelationships } from '../features/parents/FamilyRelationships';
import { ChildSquadSchedule } from '../features/parents/FamilySchedule';
import { PlayerLinkCode } from '../features/parents/PlayerLinkCode';
import { PlayerIdentityEditor } from '../features/players/PlayerIdentityEditor';
import { playerPositionLabel } from '../features/players/playerIdentityLabels';
import { playerPath, usePlayerSelection } from '../features/parents/playerSelection';
import { AdmissionError, AdmissionLoading } from '../features/admissions/applicant/AdmissionFrame';
import { useAdmissionData } from '../features/admissions/applicant/useAdmissionData';
import { useAdmissionCopy } from '../features/admissions/applicant/copy';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import '../features/squadCommunication/squad-life.css';
import '../features/parents/parents.css';
import '../features/parents/family-workspace.css';
import '../features/parents/parent-hub-refinement.css';
import '../features/parents/connected-parent-hub.css';

const Portrait = ({ child }: { child: JoiningChild }) => child.identity.photoUrl
    ? <MediaImage src={resolveMediaUrl(child.identity.photoUrl) || undefined} alt="" className="parent-child-avatar" />
    : <span className="parent-child-avatar parent-child-initials" aria-hidden="true">{child.identity.fullName.slice(0, 2).toUpperCase()}</span>;
interface ParentHubPageProps { previewSessionId?: AuthSessionId }
export function ParentHubPage(props: ParentHubPageProps = {}) {
    if ('previewSessionId' in props) return import.meta.env.DEV ? <ParentHubContent sessionId={props.previewSessionId ?? null} /> : null;
    return <AuthenticatedParentHub />;
}
function AuthenticatedParentHub() {
    const { user, sessionId, isAuthenticated } = useAuth();
    return isAuthenticated ? <ParentHubContent key={`${user?.id}:${sessionId}`} sessionId={sessionId} /> : null;
}
function ParentHubContent({ sessionId }: { sessionId: AuthSessionId }) {
    const copy = useJourneyCopy(); const {stage, next, owner} = useAdmissionCopy(); const inquiryCopy=useInquiryCopy();
    const hub = useAdmissionData(useCallback(signal => fetchJoiningChildren(sessionId, signal), [sessionId]), sessionId);
    const { requestedPlayerId, selectPlayer } = usePlayerSelection();
    const [created, setCreated] = useState<number>(); const [editing, setEditing] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const revisit = () => { if (document.visibilityState === 'visible') { hub.refresh(); setRevision(v => v + 1); } };
        document.addEventListener('visibilitychange', revisit);
        return () => document.removeEventListener('visibilitychange', revisit);
        // Refresh uses a stable state setter; do not resubscribe on each directory response.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const refresh = () => { hub.refresh(); setRevision(v => v + 1); };
    const children = hub.error ? [] : hub.data?.children ?? [];
    const selected = children.find(c => c.playerId === requestedPlayerId) ?? children[0];
    const playerId = selected?.playerId;
    const cases = selected?.cases ?? [];
    const currentCases = cases.filter(c => c.stage !== 'CLOSED' && c.enrollment?.status !== 'CANCELLED');
    const pastCases = cases.filter(c => !currentCases.includes(c));
    const caseCard = (c: JoiningChild['cases'][number]) => <article key={c.id} className="parent-request-card"><div><p className="parent-eyebrow">{c.organizationName}</p><h3>{c.groupName}</h3><span className="parent-badge">{stage(c.stage)}</span><p>{next(c.nextAction)} · {owner(c.nextAction.owner)}</p></div><Link className="parent-button" to={playerPath(`/admissions/cases/${c.id}`, c.playerId)}>{copy('View next step', 'შემდეგი ნაბიჯის ნახვა')} <ArrowRight size={16}/></Link></article>;
    return <main className="parent-hub parent-hub-refined connected-parent-hub">
        <header className="parent-hub-header"><div className="parent-hub-heading"><p className="parent-eyebrow"><HeartHandshake size={15}/>{copy('Your family’s football', 'თქვენი ოჯახის ფეხბურთი')}</p><h1>{copy('Parent Hub', 'მშობლის სივრცე')}</h1><p>{copy('Choose a child to see their clubs, joining requests and football week.', 'აირჩიეთ ბავშვი მისი კლუბების, მოთხოვნებისა და საფეხბურთო კვირის სანახავად.')}</p></div><div className="parent-header-actions"><Link className="parent-button" to={playerPath('/admissions', playerId)}>{copy('My requests', 'ჩემი მოთხოვნები')}</Link><button type="button" className="parent-button" disabled={hub.loading} onClick={refresh} aria-label={copy('Refresh Parent Hub', 'მშობლის სივრცის განახლება')}><RefreshCw size={16}/>{copy('Refresh', 'განახლება')}</button></div></header>
        <AddChild onCreated={id => { setCreated(id); selectPlayer(id); setEditing(false); refresh(); }}/>
        {hub.loading ? <AdmissionLoading/> : hub.error ? <AdmissionError message={hub.error} retry={refresh}/> : children.length === 0 ? <section className="parent-panel parent-empty"><Users size={28}/><h2>{copy('Start your child’s football journey', 'დაიწყეთ ბავშვის საფეხბურთო გზა')}</h2><p>{copy('Add a child above, or review a guardian invitation in Family connections below. A club or child login is not needed.', 'დაამატეთ ბავშვი ზემოთ ან განიხილეთ მეურვის მოწვევა ქვემოთ. კლუბი ან ბავშვის შესვლა საჭირო არ არის.')}</p><Link className="parent-button" to="/map">{copy('Browse football groups', 'საფეხბურთო ჯგუფების დათვალიერება')}</Link></section> : selected && <>
            <nav className="parent-children parent-children-top" aria-label={copy('Choose a child', 'აირჩიეთ ბავშვი')}><div className="parent-children-heading"><h2>{copy('Your children', 'თქვენი ბავშვები')}</h2><p>{children.length} {copy('linked', 'დაკავშირებული')}</p></div><div className="parent-child-list">{children.map(child => <button key={child.playerId} type="button" aria-label={`${child.identity.fullName} ${child.clubs.length ? child.clubs.map(c => c.clubName).join(' · ') : child.cases.some(c => c.stage !== 'CLOSED') ? copy('Joining in progress','მონაწილეობა მზადდება') : copy('No club yet','კლუბი ჯერ არ არის')}`} aria-pressed={child.playerId === playerId} onClick={() => { selectPlayer(child.playerId); setEditing(false); }} className={`parent-child-choice ${child.playerId === playerId ? 'is-selected' : ''}`}><Portrait child={child}/><span><strong>{child.identity.fullName}</strong><small>{child.clubs.length ? child.clubs.map(c => c.clubName).join(' · ') : child.cases.some(c => c.stage !== 'CLOSED') ? copy('Joining in progress', 'მონაწილეობა მზადდება') : copy('No club yet', 'კლუბი ჯერ არ არის')}</small></span></button>)}</div></nav>
            <section className="parent-panel parent-selected-player"><div className="parent-profile"><Portrait child={selected}/><div><p className="parent-eyebrow">{copy('Selected player', 'არჩეული მოთამაშე')}</p><h2>{selected.identity.fullName}</h2><p>{selected.identity.dateOfBirth ? `${copy('Born', 'დაბადების წელი')} ${selected.identity.dateOfBirth.slice(0,4)}` : copy('Basic details needed', 'საჭიროა ძირითადი მონაცემები')}{selected.identity.positions.length ? ` · ${selected.identity.positions.map(p => playerPositionLabel(p,copy)).join(', ')}` : ''}</p></div></div><div className="parent-header-actions"><Link className="parent-button parent-button-primary" to={playerPath('/map', playerId)}>{copy('Find a group', 'ჯგუფის მოძებნა')} <ArrowRight size={16}/></Link>{selected.identity.canEdit && <button className="parent-button" type="button" aria-expanded={editing} onClick={() => setEditing(v => !v)}>{copy('Edit player card', 'მოთამაშის ბარათის რედაქტირება')}</button>}</div></section>
            {editing && <section className="parent-panel"><PlayerIdentityEditor playerId={selected.playerId} onSaved={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)}/></section>}
            <div className="parent-family-layout"><div className="parent-family-main">
                {(currentCases.length > 0 || selected.inquiries.length > 0) && <section className="parent-panel"><h2>{copy('Joining progress', 'მონაწილეობის პროგრესი')}</h2>{currentCases.map(caseCard)}{selected.inquiries.filter(i => !i.caseId).map(i => <article key={i.id} className="parent-request-card"><div><p className="parent-eyebrow">{i.organizationName}</p><h3>{copy('Club conversation', 'კლუბთან საუბარი')}</h3><p>{inquiryCopy.status(i)}</p><p>{inquiryCopy.next(i)}</p></div><Link className="parent-button" to={playerPath(i.applicantDestination || `/admissions/inquiries/${i.id}`, playerId)}>{copy('Open conversation and next step', 'საუბრისა და შემდეგი ნაბიჯის გახსნა')}</Link></article>)}</section>}
                {selected.clubs.length === 0 && currentCases.length === 0 && <section className="parent-panel"><h2>{copy('Ready to find a group', 'მზადაა ჯგუფის მოსაძებნად')}</h2><p>{copy('Your child’s private player card is ready. Explore clubs, ask a question or arrange a first visit.', 'ბავშვის პირადი ბარათი მზადაა. მოძებნეთ კლუბი, დასვით კითხვა ან შეთანხმდით პირველ ვიზიტზე.')}</p><Link className="parent-button" to={playerPath('/world', playerId)}>{copy('Explore the map', 'რუკის დათვალიერება')} <ArrowRight size={16}/></Link></section>}
                {selected.clubs.filter(c => ['ACTIVE','TRIALIST'].includes(c.affiliationStatus || '') && ['CONFIRMED','NOT_REQUIRED'].includes(c.consentStatus || '')).map(club => {
                    const child: ParentChild = { cardId: club.cardId ?? 0, userId: selected.playerId, fullName: selected.identity.fullName, birthYear: selected.identity.dateOfBirth ? Number(selected.identity.dateOfBirth.slice(0,4)) : null, photoUrl: selected.identity.photoUrl, position: selected.identity.positions[0] ?? null, registered: false, activationEligible: false, clubId: club.clubId, clubName: club.clubName, squadNames: club.squadNames, affiliationStatus: club.affiliationStatus || '', consentStatus: club.consentStatus, trialEndsOn: null, publicEvents: [] };
                    return <section key={club.clubId} className="parent-panel" aria-label={`${selected.identity.fullName}’s schedule · ${club.clubName}`}><h2>{copy('Your football week', 'თქვენი საფეხბურთო კვირა')}</h2><p>{club.clubName}</p><ChildSquadSchedule child={child}/></section>;
                })}
                {pastCases.length > 0 && <details className="parent-panel"><summary>{copy('Earlier requests and participation', 'წინა მოთხოვნები და მონაწილეობა')}</summary>{pastCases.map(caseCard)}</details>}
            </div><aside className="parent-child-detail"><section className="parent-panel"><h2>{copy('Clubs & groups', 'კლუბები და ჯგუფები')}</h2>{selected.clubs.length === 0 ? <p>{copy('No club yet. Your family connection is active.', 'კლუბი ჯერ არ არის. ოჯახური კავშირი აქტიურია.')}</p> : selected.clubs.map(club => <article className="parent-club-context" key={club.clubId}><h3><Link to={playerPath(`/clubs/${club.clubId}`,playerId)}>{club.clubName}</Link></h3><p>{club.squadNames.join(' · ') || copy('Group to be arranged', 'ჯგუფი შესათანხმებელია')}</p>{club.consentStatus === 'PENDING' && <p>{copy('Review participation consent in Family connections.', 'განიხილეთ მონაწილეობის თანხმობა ოჯახურ კავშირებში.')}</p>}<Link className="parent-button" to={playerPath(`/clubs/${club.clubId}?tab=teams`,playerId)}>{copy('Explore this club’s groups', 'კლუბის ჯგუფების ნახვა')}</Link></article>)}</section><PlayerLinkCode key={selected.playerId} child={selected} onChanged={()=>setRevision(v=>v+1)}/></aside></div>
        </>}
        <FamilyRelationships key={created ?? 'family'} compact revision={revision} onChanged={refresh} />
    </main>;
}
