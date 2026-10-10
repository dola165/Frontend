import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Pencil, Send } from 'lucide-react';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Section, Skeleton } from '../design/primitives';
import { chatApi, type ConversationDto } from '../api/chat';
import { formats, label, when, type Match, type PublicMatchResult, type Squad } from '../features/matchExchange/api';
import { useClock, useLoad } from '../features/matchExchange/hooks';
import { journeyLabel, useJourneyCopy } from '../features/matchExchange/journeyCopy';
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
import { MatchDayPlan } from '../features/matchExchange/detail/MatchDayPlan';
import { MatchManagement } from '../features/matchExchange/detail/MatchManagement';
import { Officials } from '../features/matchExchange/detail/Officials';
import { InvitationResponse, ProposalList, ProposeForm } from '../features/matchExchange/detail/OpponentPanels';
import { Readiness } from '../features/matchExchange/detail/Readiness';
import { isActive } from '../features/matchExchange/detail/matchState';
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

/** What just happened, after the arrange form sends a match here. */
function SentNotice({ invited, kind, onDismiss }: { invited?: string; kind: string; onDismiss: () => void }) {
    const text = kind === 'direct'
        ? `Invitation sent. ${invited ?? 'The club'} can accept or decline; their answer appears here and in your inbox.`
        : 'Your open match is published. Squads that want to play will propose here, and you choose one.';
    return <div className="gk-notice gk-match-sent" role="status"><span>{text}</span><Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button></div>;
}

/**
 * One match: the fixture at a glance, then planning the day (time, ground, referee, squads),
 * the opponent decision, officials, players and the result, with changes of plan kept aside.
 */
export function MatchDetailPage() {
    const now = useClock();
    const { copy, language } = useJourneyCopy();
    const { eventId } = useParams();
    const [params, setParams] = useSearchParams();
    const { data: m, error, reload } = useLoad<Match>(`/match-exchange/${eventId}`);
    const { data: squads } = useLoad<Squad[]>('/match-exchange/squads');
    const [editing, setEditing] = useState(false);
    const [summary, setSummary] = useState<PublicMatchResult>();
    const onSummary = useCallback((next: PublicMatchResult | undefined) => setSummary(next), []);
    const conversation = useMatchConversation(m);
    // A direct invitation names its club only by id until it is accepted.
    const requested = m?.requested_club_id && !m.opponent_name ? m.requested_club_id : null;
    const invitedClub = useWorldData(requested ? `match-invited-club:${requested}` : null, signal => clubProfile(requested!, signal));

    if (!m) return (
        <GkRoot className="gk-page gk-match"><PageFrame>
            <PageHeader title="Match" crumbs={[{ label: 'Matches', to: '/world/matches' }, { label: 'Match' }]} />
            {error
                ? <Panel><EmptyNote title="This match could not load" action={<Button onClick={reload}>Try again</Button>}>{error}</EmptyNote></Panel>
                : <div className="gk-stack" role="status" aria-label="Loading the match"><Skeleton height={148} /><Skeleton height={260} /></div>}
        </PageFrame></GkRoot>
    );

    const active = isActive(m, now);
    const eligible = squads?.filter(s => s.club_id !== m.club_id) ?? [];
    const canPropose = m.listing_status === 'OPEN' && !m.requested_club_id && !m.can_manage && eligible.length > 0 && active;
    const respond = Boolean(m.can_respond && m.listing_status === 'OPEN' && active);
    const finished = new Date(m.ends_at_iso).getTime() <= now || m.result_status === 'PROPOSED' || m.result_status === 'DISPUTED';
    // Before kick-off there is no result to report or suggest; the band shows the kick-off instead.
    const started = new Date(m.starts_at_iso).getTime() <= now || Boolean(m.result_status);
    const facts = [m.age_group === 'SENIOR' ? 'Senior' : m.age_group, formats[m.format] ?? label(m.format), `${label(m.level)} level`, m.requested_club_id ? 'Direct invitation' : m.listing_status === 'OPEN' ? 'Open match' : null].filter(Boolean).join(' · ');
    const invited = requested ? { name: invitedClub.data?.name ?? (m.can_respond ? 'Your club' : 'The invited club'), logoUrl: invitedClub.data?.logoUrl } : null;
    const sent = params.get('sent');
    const dismissSent = () => { const next = new URLSearchParams(params); next.delete('sent'); setParams(next, { replace: true }); };
    const result = <div id="result" className="gk-mx gk-match-result"><MatchResultSection match={m} reload={reload} scoreboard={false} onSummary={onSummary} /></div>;

    return (
        <GkRoot className="gk-page gk-match"><PageFrame>
            <PageHeader title={m.title} subtitle={facts}
                crumbs={[{ label: 'Matches', to: '/world/matches' }, { label: m.title }]}
                actions={<>
                    {canPropose && <a className="gk-btn gk-btn--primary" href="#match-proposal"><Send aria-hidden="true" />Propose to play</a>}
                    {m.can_manage && active && !editing && <Button onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{copy('editDetails')}</Button>}
                    <MatchHistoryLink clubId={m.club_id} squadId={m.squad_id} className="gk-btn gk-btn--ghost" />
                </>} />
            {sent && !editing && <SentNotice invited={invitedClub.data?.name} kind={sent} onDismiss={dismissSent} />}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <FixtureBand match={m} summary={summary} invitedClub={invited} now={now} />

            {editing ? <Section title="Edit match details" className="gk-match-edit">
                <EditMatchForm match={m} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
            </Section> : <div className="gk-grid gk-grid--split gk-match-layout">
                <div className="gk-stack">
                    {respond && <InvitationResponse match={m} squads={squads ?? []} reload={reload} />}
                    {canPropose && <ProposeForm match={m} squads={eligible} reload={reload} />}
                    {finished && result}
                    <ProposalList match={m} active={active} reload={reload} />
                    <MatchDayPlan match={m} active={active} conversation={conversation} reload={reload} />
                    {m.own_appointments?.map(a => <div key={a.id} className="gk-mx"><AppointmentCard appointment={a} reload={reload} embedded /></div>)}
                    <Officials match={m} active={active} reload={reload} />
                    {(m.can_arrange || m.own_appointments?.some(a => a.status === 'ACCEPTED')) && (m.appointments?.some(a => a.status === 'ACCEPTED')
                        ? <div className="gk-mx"><OfficialCoordination eventId={m.event_id} /></div>
                        : <details className="gk-match-disclosure gk-mx"><summary>Message the match officials</summary><OfficialCoordination eventId={m.event_id} /></details>)}
                    {m.listing_status === 'ARRANGED' && <MatchParticipants match={m} reload={reload} />}
                    {started && !finished && result}
                    {m.opponent_name && <details className="gk-match-disclosure gk-mx"><summary>Broadcast and filming</summary><BroadcastPanel match={m} /></details>}
                    {!!m.history?.length && <details className="gk-match-disclosure">
                        <summary>{copy('arrangementHistory')}</summary>
                        <ol className="gk-match-history">{m.history.map(item => <li key={item.id}><strong>{journeyLabel(item.action, language)}</strong> <span className="gk-faint">· {when(item.created_at)}</span>{item.reason && <p>{item.reason}</p>}</li>)}</ol>
                    </details>}
                </div>
                <aside className="gk-stack gk-match-side" aria-label="Arrangement">
                    <Readiness match={m} now={now} conversation={conversation} />
                    {m.can_arrange && <div className="gk-mx gk-match-journey"><ChallengeJourneyProgress match={m} /></div>}
                    {(m.can_manage || m.can_arrange) && <div className="gk-mx"><MatchReadiness key={m.event_id} event={m.event_id} /></div>}
                    <MatchManagement match={m} active={active} now={now} reload={reload} />
                    <div className="gk-mx gk-match-share"><MatchShare key={m.event_id} eventId={m.event_id} privateMatch={m.requested_club_id != null} /></div>
                    <details className="gk-match-disclosure"><summary>{copy('arrangementHelp')}</summary><p className="gk-muted">{copy('arrangementHelpBody')}</p><p className="gk-muted">{copy('readinessNote')}</p></details>
                </aside>
            </div>}
        </PageFrame></GkRoot>
    );
}
