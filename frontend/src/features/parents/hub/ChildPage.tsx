import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button, Skeleton } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { JoiningChild } from '../api';
import { FamilyTravel } from '../../travel/FamilyTravel';
import { FamilySchedule } from '../FamilySchedule';
import { childPath, laterSession } from './childParams';
import { childWaiting, firstName, playingClubs } from './childFacts';
import { visitEvents } from './familyEvents';
import { useChildSquads } from './useChildSquads';
import { ThisWeek } from './ThisWeek';
import { CoachUpdates } from './CoachUpdates';
import { ChildChats } from './ChildChats';
import { ChildMoney } from './ChildMoney';
import { ChildDetails } from './ChildDetails';
import { NoClub } from './NoClub';
import { WaitingForYou } from './WaitingForYou';
import './parent-hub.css';

/**
 * A child's page: what a parent needs and nothing else (owner, 29 October 2026). For a child at a club: this week, from
 * the coaches, the chats and the money, each item marked with its squad; the child's details behind one quiet link.
 * For a child with no club yet: finding one, and a coach's link or code. `view=calendar|updates` opens the whole of a
 * box in place, `details=1` the details; the address keeps all of it, so Back returns here. The calendar holds the
 * child's first visits too, also for a child whose only plans so far are visits.
 */
export function ChildPage({ child, sessionId, revision, onChanged }: { child: JoiningChild; sessionId: AuthSessionId; revision: number; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const first = firstName(child);
    const clubs = playingClubs(child);
    const { squads, loading, error, failedSquads, retry } = useChildSquads(child, revision, sessionId);
    const view = params.get('view');
    const later = laterSession(params);
    const home = childPath(child.playerId);
    const backHome = <Link className="ph-back" to={home}><ArrowLeft aria-hidden="true" />{copy(`${first}’s page`, `${first}-ს გვერდი`)}</Link>;
    const visits = useMemo(() => visitEvents(child, copy), [child, copy]);
    const calendar = (squadState?: ReactNode) => <>{backHome}<section className="ph-full" aria-label={copy(`${first}’s calendar`, `${first}-ს კალენდარი`)} data-guide="child-calendar">
        {squadState ?? <FamilySchedule squads={squads.map(squad => ({ ...squad, can_manage: false }))} playerId={child.playerId} combined hideContext optOut extraEvents={visits}
            initialSquadId={later?.squadId} initialDate={later?.at} initialSessionId={later?.sessionId} />}
    </section></>;
    if (params.get('details') === '1') return <>{backHome}<ChildDetails child={child} onChanged={onChanged} /></>;
    if (!clubs.length) return view === 'calendar' ? calendar() : <NoClub child={child} onChanged={onChanged} />;
    const waiting = childWaiting(child, copy);
    const squadState = loading && !squads.length ? <Skeleton height={180} />
        : error && !squads.length ? <div className="ph-failed" role="alert"><p>{copy('Couldn’t load the squads.', 'გუნდები ვერ ჩაიტვირთა.')}</p><Button size="sm" onClick={retry}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>
        : null;
    if (view === 'calendar' || later) return calendar(squadState);
    if (view === 'updates') return <>{backHome}{squadState ?? <CoachUpdates squads={squads} child={child} all />}</>;
    return <div className="ph-child">
        {waiting.length > 0 && <WaitingForYou items={waiting} />}
        {error && squads.length > 0 && <p className="ph-quiet" role="alert">{copy('Some squads couldn’t load:', 'ზოგი გუნდი ვერ ჩაიტვირთა:')} {failedSquads.join(' · ')} <button type="button" className="ph-link" onClick={retry}>{copy('Try again', 'ხელახლა ცდა')}</button></p>}
        <div className="ph-grid">
            <div className="ph-col ph-col--main">
                {squadState ?? <>
                    <ThisWeek squads={squads} child={child} />
                    {child.travelAvailable && <FamilyTravel key={`${sessionId}:${child.playerId}`} childId={child.playerId} />}
                    <CoachUpdates squads={squads} child={child} />
                </>}
            </div>
            <div className="ph-col ph-col--side">
                {squadState ? <Skeleton height={140} /> : <ChildChats squads={squads} child={child} />}
                <ChildMoney childId={child.playerId} clubs={clubs} squads={squads} revision={revision} />
                <Link className="ph-details-link" to={childPath(child.playerId, { details: '1' })} data-guide="child-details">
                    <span>{copy(`${first}’s details · player card · family`, `${first}-ს მონაცემები · მოთამაშის ბარათი · ოჯახი`)}</span><ChevronRight aria-hidden="true" />
                </Link>
            </div>
        </div>
    </div>;
}
