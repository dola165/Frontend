import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { fetchAdmissionHome } from '../api';
import { AddChild } from '../../parents/AddChild';
import { useAdmissionData } from './useAdmissionData';
import { useAdmissionTab } from './useAdmissionTab';
import { AdmissionError, AdmissionFrame, AdmissionLoading, AdmissionSection } from './AdmissionFrame';
import { useAdmissionCopy } from './copy';
import { PlayerCardEditor } from './PlayerCardEditor';
import { AdmissionInvitationCard } from './AdmissionInvitationCard';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';
import { useInquiryCopy } from '../inquiryPresentation';
import { LegacyAdmissions } from '../legacy/LegacyAdmissions';
import type { AdmissionCase } from '../types';

export function AdmissionHomePage() {
    const { user, sessionId } = useAuth();
    return <AdmissionHomeContent key={`${user?.id}:${sessionId}`} />;
}
function AdmissionHomeContent() {
    const { sessionId, user } = useAuth();
    const { copy, stage, owner, next } = useAdmissionCopy();
    const inquiryCopy = useInquiryCopy();
    const { requestedPlayerId: selected, selectPlayer: setSelected } = usePlayerSelection();
    const tab = useAdmissionTab(['overview', 'requests', 'players', 'history']);
    const [historyOpen, setHistoryOpen] = useState(false);
    const home = useAdmissionData(useCallback(signal => fetchAdmissionHome(sessionId, signal), [sessionId]), sessionId);
    const people = home.data?.participants ?? [];
    const validSelected = people.some(p => p.id === selected) ? selected : undefined;
    const cases = home.data?.cases.filter(c => !validSelected || c.playerId === validSelected) ?? [];
    const current = cases.filter(c => c.stage !== 'CLOSED' && c.enrollment?.status !== 'CANCELLED');
    const earlier = cases.filter(c => !current.includes(c));
    const inquiries = home.data?.inquiries?.filter(i => !validSelected || i.playerId === validSelected || i.playerId == null) ?? [];
    const invitations = home.data?.invitations?.filter(i => i.status === 'PENDING') ?? [];
    const sectionPath = (section: string) => playerPath('/admissions?tab=' + section, validSelected);
    const caseCard = (c: AdmissionCase) => <article key={c.id} className="admission-card"><header><div><p className="admission-eyebrow">{c.playerName}</p><h2>{c.groupName}</h2></div><span className="admission-badge">{stage(c.stage)}</span></header><p>{c.organizationName} · {c.intake}</p><p>{next(c.nextAction)} · {owner(c.nextAction.owner)}</p>{c.enrollment?.status === 'CANCELLED' && <p>{copy('Enrollment ended', 'ჩარიცხვა დასრულდა')}</p>}{c.enrollment?.status === 'ACTIVE' && <p>{copy('Confirmed start', 'დადასტურებული დასაწყისი')}: {c.enrollment.startDate}</p>}<Link className="admission-button" to={playerPath('/admissions/cases/' + c.id, c.playerId)}>{copy('View next step and history', 'შემდეგი ნაბიჯისა და ისტორიის ნახვა')}<ArrowRight size={14} aria-hidden="true" /></Link></article>;
    const empty = <section className="admission-empty"><Search size={24} aria-hidden="true" /><h2>{copy('Find your next group', 'იპოვეთ თქვენი შემდეგი ჯგუფი')}</h2><p>{copy('Explore clubs and training groups. Choose a player when you are ready to ask a question or arrange a first visit.', 'მოძებნეთ კლუბები და სავარჯიშო ჯგუფები. აირჩიეთ მოთამაშე კითხვის დასასმელად ან პირველ ვიზიტზე შესათანხმებლად.')}</p><Link className="admission-button admission-primary" to={playerPath('/map', validSelected)}>{copy('Find a suitable group', 'შესაფერისი ჯგუფის მოძებნა')}<ArrowRight size={14} aria-hidden="true" /></Link></section>;
    return <AdmissionFrame title={copy('Joining football', 'ფეხბურთში მონაწილეობა')} description={copy('Your players, club conversations and next steps.', 'თქვენი მოთამაშეები, კლუბთან საუბრები და შემდეგი ნაბიჯები.')}
        action={<Link className="admission-button admission-primary" to={playerPath('/map', validSelected)}><Search size={15} aria-hidden="true" />{copy('Find a group', 'ჯგუფის მოძებნა')}</Link>}
        tabs={[{ id: 'overview', label: copy('Overview', 'მიმოხილვა') }, { id: 'requests', label: copy('Requests', 'მოთხოვნები'), count: home.data ? current.length + inquiries.length + invitations.length : undefined }, { id: 'players', label: copy('Player cards', 'მოთამაშის ბარათები'), count: home.data ? people.length : undefined }, { id: 'history', label: copy('History', 'ისტორია') }]} activeTab={tab}>
        {home.loading ? <AdmissionLoading /> : home.error ? <AdmissionError message={home.error} retry={home.refresh} /> : <div className="admission-stack">
            <div className="admission-context-bar"><label>{copy('Player', 'მოთამაშე')}<select aria-label={copy('Filter cases by player', 'საქმეების გაფილტვრა მოთამაშით')} value={validSelected ?? ''} onChange={e => setSelected(Number(e.target.value) || undefined)}><option value="">{copy('Everyone', 'ყველა')}</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}{p.dateOfBirth ? ' · ' + p.dateOfBirth.slice(0, 4) : ''}</option>)}</select></label><Link className="admission-back" to={playerPath('/parent', validSelected)}>{copy('Family connections', 'ოჯახური კავშირები')}<ArrowRight size={14} aria-hidden="true" /></Link></div>
            <AdmissionSection active={tab === 'overview'}>
                <div className="admission-overview-metrics"><Link to={sectionPath('requests')}><strong>{current.length}</strong><span>{copy('Active arrangements', 'მიმდინარე შეთანხმებები')}</span></Link><Link to={sectionPath('requests')}><strong>{inquiries.length + invitations.length}</strong><span>{copy('Conversations & invitations', 'საუბრები და მოწვევები')}</span></Link><Link to={sectionPath('players')}><strong>{people.length}</strong><span>{copy('Player cards', 'მოთამაშის ბარათები')}</span></Link></div>
                {home.data?.selfCardNeedsDetails && <section className="admission-notice"><p>{copy('Complete your player card before requesting a place.', 'ადგილის მოთხოვნამდე შეავსეთ მოთამაშის ბარათი.')}</p><Link className="admission-button" to={sectionPath('players')}>{copy('Complete player card', 'მოთამაშის ბარათის შევსება')}</Link></section>}
                {(invitations.length > 0 || inquiries.length > 0) && <section className="admission-panel"><h2>{copy('Club conversations', 'კლუბთან საუბრები')}</h2><p>{copy('Open Requests to review replies and invitations.', 'პასუხებისა და მოწვევების სანახავად გახსენით მოთხოვნები.')}</p><Link className="admission-button" to={sectionPath('requests')}>{copy('View requests', 'მოთხოვნების ნახვა')}<ArrowRight size={14} aria-hidden="true" /></Link></section>}
                {current.length ? <><div className="admission-section-heading"><h2>{copy('Your next steps', 'თქვენი შემდეგი ნაბიჯები')}</h2><Link className="admission-back" to={sectionPath('requests')}>{copy('View all', 'ყველას ნახვა')}<ArrowRight size={14} aria-hidden="true" /></Link></div><div className="admission-grid">{current.slice(0, 4).map(caseCard)}</div></> : empty}
            </AdmissionSection>
            <AdmissionSection active={tab === 'requests'}>
                {invitations.map(i => <AdmissionInvitationCard key={i.id} invitation={i} participants={people} onChanged={home.refresh} />)}
                {inquiries.map(i => <article key={i.id} className="admission-card"><p className="admission-eyebrow">{i.playerName || copy('General question', 'ზოგადი კითხვა')}</p><h2>{i.organizationName}</h2><p>{i.message}</p><p>{inquiryCopy.status(i)}</p><p>{inquiryCopy.next(i)}</p><Link className="admission-button" to={playerPath('/admissions/inquiries/' + i.id, i.playerId)}>{copy('View conversation and next step', 'საუბრისა და შემდეგი ნაბიჯის ნახვა')}</Link></article>)}
                <p className="admission-muted" role="status">{current.length} {copy('requests shown', 'ნაჩვენები მოთხოვნა')}</p><div className="admission-grid">{current.map(caseCard)}</div>{!current.length && !inquiries.length && !invitations.length && empty}
            </AdmissionSection>
            <AdmissionSection active={tab === 'players'}>
                <section className="admission-panel"><h2>{copy('Your player cards', 'თქვენი მოთამაშის ბარათები')}</h2><p>{copy('Select a player above to review their private details.', 'პირადი მონაცემების სანახავად ზემოთ აირჩიეთ მოთამაშე.')}</p><div className="admission-actions">{user?.id && <Link className="admission-button" to={playerPath('/admissions?tab=players', user.id)}>{copy('My player card', 'ჩემი მოთამაშის ბარათი')}</Link>}<Link className="admission-button" to={playerPath('/parent', validSelected)}>{copy('Manage family connections', 'ოჯახური კავშირების მართვა')}</Link><Link className="admission-button" to="/account">{copy('My account details', 'ჩემი ანგარიშის მონაცემები')}</Link></div></section>
                {home.data?.selfCardNeedsDetails && user?.id && <PlayerCardEditor playerId={user.id} initialName={user.fullName || user.username || ''} onChanged={home.refresh} />}
                {validSelected && !(validSelected === user?.id && home.data?.selfCardNeedsDetails) && <PlayerCardEditor key={validSelected} playerId={validSelected} participant={people.find(p => p.id === validSelected)} onChanged={home.refresh} />}
                <AddChild onCreated={id => { setSelected(id); home.refresh(); }} />
            </AdmissionSection>
            <AdmissionSection active={tab === 'history'}><h2>{copy('Earlier arrangements', 'წინა შეთანხმებები')}</h2><div className="admission-grid">{earlier.map(caseCard)}</div>{!earlier.length && <p className="admission-muted">{copy('No earlier arrangements for this view.', 'ამ ხედში წინა შეთანხმებები არ არის.')}</p>}<details className="admission-panel" onToggle={e => setHistoryOpen(e.currentTarget.open)}><summary>{copy('Earlier club participation records', 'კლუბში მონაწილეობის წინა ჩანაწერები')}</summary>{historyOpen && <LegacyAdmissions sessionId={sessionId} playerId={validSelected} onChanged={home.refresh} />}</details></AdmissionSection>
        </div>}
    </AdmissionFrame>;
}
