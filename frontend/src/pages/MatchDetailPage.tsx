import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Pencil, Send } from 'lucide-react';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Section, Skeleton } from '../design/primitives';
import { chatApi, type ConversationDto } from '../api/chat';
import { formats, label, when, type Match, type Squad } from '../features/matchExchange/api';
import type { ScoreSummary } from '../features/scores/api';
import { useClock, useLoad } from '../features/matchExchange/hooks';
import { journeyLabel, useJourneyCopy } from '../features/matchExchange/journeyCopy';
import { useMatchCopy } from '../features/matchExchange/copy';
import { AppointmentCard } from '../features/matchExchange/AppointmentCard';
import { MatchParticipants } from '../features/matchExchange/MatchParticipants';
import { MatchResultSection } from '../features/matchExchange/MatchResultSection';
import { MatchShare } from '../features/matchExchange/MatchShare';
import { OfficialCoordination } from '../features/matchExchange/OfficialCoordination';
import { MatchReadiness } from '../features/clubOperations/MatchReadiness';
import { ChallengeJourneyProgress } from '../features/mapPlanning/ChallengeJourneyProgress';
import { BroadcastPanel } from '../features/broadcasts/BroadcastPanel';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';
import { EditMatchForm } from '../features/matchExchange/arrange/EditMatchForm';
import { clubProfile } from '../features/matchExchange/arrange/api';
import { useWorldData } from '../features/world/useWorldData';
import { FixtureBand } from '../features/matchExchange/detail/FixtureBand';
import { GroundReservation } from '../features/matchExchange/detail/GroundReservation';
import { MatchDayPlan } from '../features/matchExchange/detail/MatchDayPlan';
import { MatchManagement } from '../features/matchExchange/detail/MatchManagement';
import { Officials } from '../features/matchExchange/detail/Officials';
import { InvitationResponse, ProposalList, ProposeForm } from '../features/matchExchange/detail/OpponentPanels';
import { Readiness } from '../features/matchExchange/detail/Readiness';
import { matchGates } from '../features/matchExchange/detail/matchState';
import '../features/matchExchange/detail/match-detail.css';

/** The match conversation exists once both coaching teams have agreed; `undefined` while unknown. */
function useMatchConversation(m: Match | undefined) {
    const [lookup, setLookup] = useState<{ eventId: number; conversation: ConversationDto | null }>();
    const event = m?.event_id, open = Boolean(m?.can_arrange && m.listing_status === 'ARRANGED');
    useEffect(() => {
        if (!event || !open) return;
        const controller = new AbortController();
        void chatApi.findConversationByContext('MATCH_CHALLENGE', event, controller.signal)
            .then(conversation => { if (!controller.signal.aborted) setLookup({ eventId: event, conversation }); })
            .catch(() => { if (!controller.signal.aborted) setLookup({ eventId: event, conversation: null }); });
        return () => controller.abort();
    }, [event, open]);
    return open && lookup && lookup.eventId === event ? lookup.conversation : undefined;
}

/**
 * One match: the fixture at a glance, then planning the day (time, ground, referee, squads),
 * the opponent decision, officials, players and the result, with changes of plan kept aside.
 */
export function MatchDetailPage() {
    const t = useMatchCopy();
    const now = useClock();
    const { copy, language } = useJourneyCopy();
    const { eventId } = useParams();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { data: m, error, reload } = useLoad<Match>(`/match-exchange/${eventId}`);
    const { data: squads } = useLoad<Squad[]>('/match-exchange/squads');
    const [editing, setEditing] = useState(false);
    const [summary, setSummary] = useState<ScoreSummary>();
    const onSummary = useCallback((next: ScoreSummary | undefined) => setSummary(next), []);
    const conversation = useMatchConversation(m);
    // A direct invitation names its club only by id until it is accepted.
    const requested = m?.requested_club_id && !m.opponent_name ? m.requested_club_id : null;
    const invitedClub = useWorldData(requested ? `match-invited-club:${requested}` : null, signal => clubProfile(requested!, signal));

    if (!m) return (
        <GkRoot className="gk-page gk-match"><PageFrame>
            <PageHeader title={t('Match')} crumbs={[{ label: t('Matches'), to: '/world/matches' }, { label: t('Match') }]} />
            {error
                ? <Panel><EmptyNote title={t('This match could not load')} action={<Button onClick={reload}>{t('Try again')}</Button>}>{t(error)}</EmptyNote></Panel>
                : <div className="gk-stack" role="status" aria-label={t('Loading the match')}><Skeleton height={148} /><Skeleton height={260} /></div>}
        </PageFrame></GkRoot>
    );

    // Before kick-off there is no result to report or suggest; the band shows the kick-off instead.
    const { active, eligible, canPropose, respond, finished, started } = matchGates(m, now, squads ?? []);
    const facts = [m.age_group === 'SENIOR' ? t('Senior') : m.age_group, t(formats[m.format] ?? label(m.format)), t('{level} level', { level: t(label(m.level)) }), m.requested_club_id ? t('Direct invitation') : m.listing_status === 'OPEN' ? t('Open match') : null].filter(Boolean).join(' · ');
    const invited = requested ? { name: invitedClub.data?.name ?? (m.can_respond ? t('Your club') : t('The invited club')), logoUrl: invitedClub.data?.logoUrl } : null;
    // Using a reservation is a step over the page, kept in the address so Back closes it. Opened here it adds one
    // history entry, which closing goes back over; opened from a link (World's match drawer) closing just drops it.
    const reserving = params.get('ground') === 'reserve';
    const reserve = (open: boolean) => {
        if (open) { const next = new URLSearchParams(params); next.set('ground', 'reserve'); setParams(next, { state: { reserveSheet: true } }); return; }
        if ((location.state as { reserveSheet?: boolean } | null)?.reserveSheet) navigate(-1);
        else { const next = new URLSearchParams(params); next.delete('ground'); setParams(next, { replace: true }); }
        // Its opener may be gone (the reservation now holds the match): once the sheet has gone, focus lands on the plan
        // it changed instead of the page.
        const settle = (frames: number) => window.setTimeout(() => {
            if (document.querySelector('.gk-reserve')) { if (frames) settle(frames - 1); return; }
            if (document.activeElement && document.activeElement !== document.body) return;
            const target = document.querySelector<HTMLElement>('[data-reserve-opener]') ?? document.querySelector<HTMLElement>('#plan h2');
            if (target && !target.matches('button')) target.tabIndex = -1;
            target?.focus();
        }, 30);
        settle(30);
    };
    const result = <div id="result" className="gk-mx gk-match-result"><MatchResultSection match={m} reload={reload} scoreboard={false} onSummary={onSummary} /></div>;

    return (
        <GkRoot className="gk-page gk-match"><PageFrame>
            <PageHeader title={m.title} subtitle={facts}
                crumbs={[{ label: t('Matches'), to: '/world/matches' }, { label: m.title }]}
                actions={<>
                    {canPropose && <a className="gk-btn gk-btn--primary" href="#match-proposal"><Send aria-hidden="true" />{t('Propose to play')}</a>}
                    {m.can_manage && active && !editing && <Button onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{copy('editDetails')}</Button>}
                    <MatchHistoryLink clubId={m.club_id} squadId={m.squad_id} className="gk-btn gk-btn--ghost" />
                </>} />
            {error && <p className="gk-notice gk-notice--danger" role="alert">{t(error)}</p>}
            <FixtureBand match={m} summary={summary} invitedClub={invited} now={now} />

            {editing ? <Section title={t('Edit match details')} className="gk-match-edit">
                <EditMatchForm match={m} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
            </Section> : <div className="gk-grid gk-grid--split gk-match-layout">
                <div className="gk-stack">
                    {respond && <InvitationResponse match={m} squads={squads ?? []} reload={reload} />}
                    {canPropose && <ProposeForm match={m} squads={eligible} reload={reload} />}
                    {finished && result}
                    <ProposalList match={m} active={active} reload={reload} />
                    <MatchDayPlan match={m} active={active} conversation={conversation} reload={reload} onReserve={() => reserve(true)} />
                    {m.own_appointments?.map(a => <div key={a.id} className="gk-mx"><AppointmentCard appointment={a} reload={reload} embedded /></div>)}
                    <Officials match={m} active={active} reload={reload} />
                    {(m.can_arrange || m.own_appointments?.some(a => a.status === 'ACCEPTED')) && (m.appointments?.some(a => a.status === 'ACCEPTED')
                        ? <div className="gk-mx"><OfficialCoordination eventId={m.event_id} /></div>
                        : <details className="gk-match-disclosure gk-mx"><summary>{t('Message the match officials')}</summary><OfficialCoordination eventId={m.event_id} /></details>)}
                    {m.listing_status === 'ARRANGED' && <MatchParticipants match={m} reload={reload} />}
                    {started && !finished && result}
                    {m.opponent_name && <details className="gk-match-disclosure gk-mx"><summary>{t('Broadcast and filming')}</summary><BroadcastPanel match={m} /></details>}
                    {!!m.history?.length && <details className="gk-match-disclosure">
                        <summary>{copy('arrangementHistory')}</summary>
                        <ol className="gk-match-history">{m.history.map(item => <li key={item.id}><strong>{journeyLabel(item.action, language)}</strong> <span className="gk-faint">· {when(item.created_at)}</span>{item.reason && <p>{item.reason}</p>}</li>)}</ol>
                    </details>}
                </div>
                <aside className="gk-stack gk-match-side" aria-label={t('Arrangement')}>
                    <Readiness match={m} now={now} conversation={conversation} />
                    {m.can_arrange && <div className="gk-mx gk-match-journey"><ChallengeJourneyProgress match={m} /></div>}
                    {(m.can_manage || m.can_arrange) && <div className="gk-mx"><MatchReadiness key={m.event_id} event={m.event_id} /></div>}
                    <MatchManagement match={m} active={active} now={now} reload={reload} />
                    <div className="gk-mx gk-match-share"><MatchShare key={m.event_id} eventId={m.event_id} privateMatch={m.requested_club_id != null} /></div>
                    <details className="gk-match-disclosure"><summary>{copy('arrangementHelp')}</summary><p className="gk-muted">{copy('arrangementHelpBody')}</p><p className="gk-muted">{copy('readinessNote')}</p></details>
                </aside>
            </div>}
            {/* Only where a reservation can help (once open it stays, to show what it did, even when the match now holds one). */}
            {reserving && m.can_arrange && active && (m.can_manage || m.venue_id != null) && <GroundReservation match={m} onClose={() => reserve(false)} reload={reload} />}
        </PageFrame></GkRoot>
    );
}
