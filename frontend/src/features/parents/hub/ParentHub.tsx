import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, HeartHandshake } from 'lucide-react';
import { Button, GkRoot, PageFrame, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { TurnOnNotificationsPrompt } from '../../../components/notifications/TurnOnNotificationsPrompt';
import { useAdmissionData } from '../../admissions/applicant/useAdmissionData';
import { useAdmissionTab } from '../../admissions/applicant/useAdmissionTab';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { AuthSessionId } from '../../../utils/authStorage';
import { fetchJoiningChildren } from '../api';
import { AddChild } from '../AddChild';
import { FamilyRelationships } from '../FamilyRelationships';
import { PlayerLinkCode } from '../PlayerLinkCode';
import { playerPath, positivePlayerId, rememberSelectedPlayer } from '../playerSelection';
import { GuardianClubWork } from '../../clubOperations/PersonalClubWork';
import { PersonalRegistrationHistory } from '../../clubOperations/registration/PersonalRegistrationHistory';
import { ClubFinderHost } from '../../world/finder/ClubFinderHost';
import { ChildSwitcher } from './ChildSwitcher';
import { ChildPage } from './ChildPage';
import { FamilyWeek } from './FamilyWeek';
import { OneCard } from './OneCard';
import { CHILD_PARAMS } from './childParams';
import './parent-hub.css';

/**
 * Parent Hub (step 5): with two or more children it opens on everyone's week, with one on that child's page; a child's
 * page is four things (this week, from the coaches, chat, money) or, without a club, finding one. Everything shown is in
 * the address: `player` (the child), `details`, `view` (calendar, updates), `session`, and `find=club` for World's club
 * map in its pop-up. `tab=children` (add a child) and `tab=connections` (guardians and consent) are as before.
 */
export function ParentHub({ sessionId }: { sessionId: AuthSessionId }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const hub = useAdmissionData(useCallback(signal => fetchJoiningChildren(sessionId, signal), [sessionId]), sessionId);
    const requestedTab = useAdmissionTab(['overview', 'children', 'connections']);
    const [params, setParams] = useSearchParams();
    const tab = params.has('permissionId') ? 'connections' : requestedTab;
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
    // Only the address picks a child here: a stale or someone else's id falls back to the family's own opening.
    const selected = children.find(child => child.playerId === positivePlayerId(params.get('player'))) ?? (children.length === 1 ? children[0] : undefined);
    const select = (playerId?: number) => {
        const next = new URLSearchParams(params);
        // Choosing a child (or adding one) opens their page.
        [...CHILD_PARAMS, 'tab'].forEach(key => next.delete(key));
        if (playerId) next.set('player', String(playerId)); else next.delete('player');
        rememberSelectedPlayer(user?.id, sessionId, playerId);
        setParams(next, { replace: true });
    };
    const added = (id: number) => { select(id); refresh(); };
    const back = <Link className="ph-back" to={playerPath('/parent', selected?.playerId)}><ArrowLeft aria-hidden="true" />{copy('Parent Hub', 'მშობლის სივრცე')}</Link>;
    let body;
    if (tab === 'children') body = <>{back}<section className="ph-start"><h2>{copy('Add a child', 'ბავშვის დამატება')}</h2><AddChild inline onCreated={added} /></section></>;
    else if (tab === 'connections') body = <>{back}<GuardianClubWork /><FamilyRelationships selectedChildId={selected?.playerId} revision={revision} onChanged={refresh} />{selected && <PlayerLinkCode key={selected.playerId} child={selected} onChanged={() => setRevision(v => v + 1)} />}</>;
    else if (!hub.data && hub.loading) body = <div className="ph-stack" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={52} /><Skeleton height={220} /><Skeleton height={140} /></div>;
    else if (hub.error) body = <div className="ph-failed" role="alert"><p>{copy('Couldn’t load your children.', 'ბავშვების ჩატვირთვა ვერ მოხერხდა.')}</p><Button size="sm" onClick={refresh}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>;
    else if (!children.length) body = <section className="ph-start"><HeartHandshake aria-hidden="true" /><h2>{copy('Add your child', 'დაამატეთ ბავშვი')}</h2>
        <p>{copy('Their card is yours to keep. Then find them a club, or open the link a coach sent you.', 'ბარათი თქვენია. შემდეგ მოუძებნეთ კლუბი ან გახსენით მწვრთნელის გამოგზავნილი ბმული.')}</p>
        <AddChild inline onCreated={added} /></section>;
    else body = <>
        <OneCard revision={revision} />
        <ChildSwitcher items={children} selectedId={selected?.playerId} onSelect={select} addTo={playerPath('/parent?tab=children', selected?.playerId)} />
        {/* Once a child plays somewhere, the coach's Notify should reach this phone: the door is here, not in Account. */}
        {children.some(child => child.clubs.length > 0) && <TurnOnNotificationsPrompt group="SQUAD_UPDATES" />}
        {selected ? <><ChildPage key={`${sessionId}:${selected.playerId}`} child={selected} sessionId={sessionId} revision={revision} onChanged={refresh} /><PersonalRegistrationHistory key={`registration:${sessionId}:${selected.playerId}:${revision}`} person={selected.playerId} /></>
            : <FamilyWeek children={children} sessionId={sessionId} revision={revision} />}
    </>;
    return <GkRoot className="gk-page ph"><PageFrame>
        <h1 className="sr-only">{copy('Parent Hub', 'მშობლის სივრცე')}</h1>
        {body}
        {params.get('find') === 'club' && <ClubFinderHost families={children} onBooked={refresh} />}
    </PageFrame></GkRoot>;
}
