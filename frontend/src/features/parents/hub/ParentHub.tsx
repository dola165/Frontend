import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, HeartHandshake } from 'lucide-react';
import { Button, EmptyNote, GkRoot, PageFrame, Section, Skeleton } from '../../../design/primitives';
import { FaceStack } from '../../../design/visuals';
import { PlayerCard } from '../../clubWorkspace/squads/PlayerCard';
import { useInquiryCopy } from '../../admissions/inquiryPresentation';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { useAdmissionData } from '../../admissions/applicant/useAdmissionData';
import { useAdmissionTab } from '../../admissions/applicant/useAdmissionTab';
import { PlayerIdentityEditor } from '../../players/PlayerIdentityEditor';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useClubCrest } from '../../squadCommunication/useClubCrest';
import type { AuthSessionId } from '../../../utils/authStorage';
import { fetchJoiningChildren, type JoiningChild } from '../api';
import { AddChild } from '../AddChild';
import { FamilyRelationships } from '../FamilyRelationships';
import { FamilySchedule } from '../FamilySchedule';
import { PlayerLinkCode } from '../PlayerLinkCode';
import { playerPath, usePlayerSelection } from '../playerSelection';
import { ChildSwitcher } from './ChildSwitcher';
import { ChildClubs } from './ChildClubs';
import { GroupsThatFit } from './GroupsThatFit';
import { LatestUpdate } from './LatestUpdate';
import { NextUp } from './NextUp';
import { useChildSquads } from './useChildSquads';
import './parent-hub.css';

/**
 * Parent Hub, phone first (F34): which child, their next session with "coming / can't come", the latest coach
 * update; then their squads (into the squad page) and fees, the week, and the card and family settings below.
 * `tab=children` (add a child) and `tab=connections` (guardians and consent) open those parts on their own.
 */
export function ParentHub({ sessionId }: { sessionId: AuthSessionId }) {
    const copy = useJourneyCopy();
    const hub = useAdmissionData(useCallback(signal => fetchJoiningChildren(sessionId, signal), [sessionId]), sessionId);
    const { requestedPlayerId, selectPlayer } = usePlayerSelection();
    const tab = useAdmissionTab(['overview', 'children', 'connections']);
    const [revision, setRevision] = useState(0);
    const refresh = () => { hub.refresh(); setRevision(v => v + 1); };
    useEffect(() => {
        const revisit = () => { if (document.visibilityState === 'visible') { hub.refresh(); setRevision(v => v + 1); } };
        document.addEventListener('visibilitychange', revisit);
        return () => document.removeEventListener('visibilitychange', revisit);
        // `hub.refresh` is a stable state setter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const children = hub.error ? [] : hub.data?.children ?? [];
    const selected = children.find(child => child.playerId === requestedPlayerId) ?? children[0];
    const back = <Link className="ph-back" to={playerPath('/parent', selected?.playerId)}><ArrowLeft aria-hidden="true" />{copy('Parent Hub', 'მშობლის სივრცე')}</Link>;
    let body;
    if (tab === 'children') body = <>{back}<section className="ph-start"><h2>{copy('Add a child', 'ბავშვის დამატება')}</h2><AddChild inline onCreated={id => { selectPlayer(id); refresh(); }} /></section></>;
    else if (tab === 'connections') body = <>{back}<FamilyRelationships selectedChildId={selected?.playerId} revision={revision} onChanged={refresh} />{selected && <PlayerLinkCode key={selected.playerId} child={selected} onChanged={() => setRevision(v => v + 1)} />}</>;
    else if (!hub.data && hub.loading) body = <div className="ph-stack" role="status"><Skeleton height={52} /><Skeleton height={140} /><Skeleton height={110} /></div>;
    else if (hub.error) body = <div role="alert"><EmptyNote title={hub.error} action={<button type="button" className="ph-link" onClick={refresh}>{copy('Try again', 'ხელახლა ცდა')}</button>} /></div>;
    else if (!selected) body = <section className="ph-start"><HeartHandshake aria-hidden="true" /><h2>{copy('Add your child', 'დაამატეთ ბავშვი')}</h2>
        <p>{copy('Make their player card. Then join a squad with the coach’s link, or ask a club.', 'შექმენით მოთამაშის ბარათი. შემდეგ შედით გუნდში მწვრთნელის ბმულით ან მიმართეთ კლუბს.')}</p>
        <AddChild inline onCreated={id => { selectPlayer(id); refresh(); }} /></section>;
    else body = <>
        <ChildSwitcher items={children} selectedId={selected.playerId} onSelect={selectPlayer} addTo={playerPath('/parent?tab=children', selected.playerId)} />
        <ChildView key={`${sessionId}:${selected.playerId}`} child={selected} sessionId={sessionId} revision={revision} onChanged={refresh} />
    </>;
    return <GkRoot className="gk-page ph"><PageFrame>
        <h1 className="sr-only">{copy('Parent Hub', 'მშობლის სივრცე')}</h1>
        {body}
    </PageFrame></GkRoot>;
}

function ChildView({ child, sessionId, revision, onChanged }: { child: JoiningChild; sessionId: AuthSessionId; revision: number; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const { stage, next, owner } = useAdmissionCopy();
    const inquiryCopy = useInquiryCopy();
    const [editing, setEditing] = useState(false);
    const { squads, loading, error, failedSquads, retry } = useChildSquads(child, revision, sessionId);
    const first = child.identity.fullName.split(' ')[0];
    const playing = child.clubs.filter(club => ['ACTIVE', 'TRIALIST'].includes(club.affiliationStatus ?? ''));
    const crest = useClubCrest(playing[0]?.clubId);
    const consent = child.clubs.find(club => club.consentStatus === 'PENDING');
    const cases = child.cases.filter(c => c.stage !== 'CLOSED' && c.enrollment?.status !== 'CANCELLED');
    const enquiries = child.inquiries.filter(i => !i.caseId);
    const born = child.identity.dateOfBirth ? new Date(child.identity.dateOfBirth) : null;
    return <div className="ph-grid">
        <div className="ph-col ph-col--main">
            {consent && <Link className="ph-alert" to={playerPath('/parent?tab=connections', child.playerId)}><span className="ph-dot ph-dot--urgent" aria-hidden="true" /><span>{copy(`${consent.clubName} asks for your consent`, `${consent.clubName} თქვენს თანხმობას ითხოვს`)}</span><ArrowRight aria-hidden="true" /></Link>}
            {playing.length > 0 && <>
                {loading && <p className="ph-quiet" role="status">{squads.length ? copy('Refreshing squads…', 'გუნდები ახლდება…') : copy('Loading squads…', 'გუნდები იტვირთება…')}</p>}
                {error && <div className="ph-quiet" role="alert">
                    <p>{squads.length ? copy('Some squads could not load. Available squads are shown.', 'ზოგი გუნდი ვერ ჩაიტვირთა. ხელმისაწვდომი გუნდები ნაჩვენებია.') : copy('The squads could not load.', 'გუნდები ვერ ჩაიტვირთა.')}</p>
                    {!!failedSquads.length && <p>{failedSquads.join(' · ')}</p>}
                    <Button variant="ghost" disabled={loading} onClick={retry}>{copy('Retry squads', 'გუნდების ხელახლა ჩატვირთვა')}</Button>
                </div>}
                {!loading && !error && !squads.length && <p className="ph-quiet" role="status">{copy(`No squads are listed for ${first} yet.`, `${first}-სთვის გუნდები ჯერ არ არის ჩამოთვლილი.`)}</p>}
            </>}
            {playing.length > 0 && (loading && !squads.length ? <Skeleton height={140} /> : squads.length > 0 && <div className="ph-lead">
                <NextUp squads={squads} playerId={child.playerId} childName={first} crest={crest} />
                <LatestUpdate squads={squads} playerId={child.playerId} />
            </div>)}
            {!playing.length && !cases.length && <GroupsThatFit child={child} />}
            {(cases.length > 0 || enquiries.length > 0) && <Section boxed title={copy('Joining', 'გაწევრიანება')} className="ph-section">
                <ul className="ph-rows">
                    {cases.map(c => <li key={c.id}><Link className="ph-row" to={playerPath(`/admissions/cases/${c.id}`, child.playerId)}><span className="ph-dot ph-dot--decide" aria-hidden="true" />
                        <span className="ph-row__text"><strong>{c.groupName}</strong><small>{c.organizationName} · {stage(c.stage)} · {next(c.nextAction)} ({owner(c.nextAction.owner)})</small></span><ArrowRight aria-hidden="true" /></Link></li>)}
                    {enquiries.map(i => <li key={i.id}><Link className="ph-row" to={playerPath(i.applicantDestination || `/admissions/inquiries/${i.id}`, child.playerId)}><span className="ph-dot" aria-hidden="true" />
                        <span className="ph-row__text"><strong>{i.organizationName}</strong><small>{inquiryCopy.status(i)} · {inquiryCopy.next(i)}</small></span><ArrowRight aria-hidden="true" /></Link></li>)}
                </ul>
            </Section>}
            {squads.length > 0 && <Section boxed icon={CalendarDays} tone="info" title={copy('Coming up', 'მომავალი')} className="ph-section ph-week">
                {/* Parent Hub answers as the parent, also in a squad the parent coaches. */}
                <FamilySchedule squads={squads.map(squad => ({ ...squad, can_manage: false }))} playerId={child.playerId} embedded combined />
            </Section>}
        </div>
        <div className="ph-col ph-col--side">
            {playing.length > 0 && <Section boxed title={copy(`${first}’s squads`, `${first}-ს გუნდები`)} className="ph-section ph-clubs">
                <ChildClubs clubs={playing} squads={squads} playerId={child.playerId} />
            </Section>}
            <Section boxed title={copy('Player card', 'მოთამაშის ბარათი')} className="ph-section ph-card"
                action={child.identity.canEdit ? <button type="button" className="ph-link" aria-expanded={editing} onClick={() => setEditing(v => !v)}>{editing ? copy('Close', 'დახურვა') : copy('Edit', 'რედაქტირება')}</button> : undefined}>
                {editing ? <PlayerIdentityEditor playerId={child.playerId} onSaved={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
                    : <div className="ph-card__face"><PlayerCard crest={crest} player={{ id: child.playerId, name: child.identity.fullName, position: child.identity.positions[0] ?? null, photoUrl: child.identity.photoUrl, age: born ? new Date().getFullYear() - born.getFullYear() : null }} />
                        <p className="ph-quiet">{copy('Yours to keep. Clubs see it while your child plays for them.', 'ბარათი თქვენია. კლუბები მას ხედავენ, სანამ ბავშვი მათთან თამაშობს.')}</p></div>}
            </Section>
            {!playing.length && <PlayerLinkCode key={child.playerId} child={child} onChanged={onChanged} />}
            <Link className="ph-row ph-row--boxed" to={playerPath('/parent?tab=connections', child.playerId)}><span className="ph-row__icon" aria-hidden="true"><HeartHandshake /></span>
                <span className="ph-row__text"><strong>{copy('Family & guardians', 'ოჯახი და მეურვეები')}</strong><small>{child.guardians?.length ? child.guardians.map(g => g.self ? copy('You', 'თქვენ') : g.name.split(' ')[0]).join(' · ') : copy('Who else looks after this card, club consent', 'ვინ უვლის ბარათს, კლუბის თანხმობა')}</small></span>{!!child.guardians?.length && <FaceStack people={child.guardians.map(g => ({ id: g.id, name: g.name }))} size={24} />}<ArrowRight aria-hidden="true" /></Link>
        </div>
    </div>;
}
