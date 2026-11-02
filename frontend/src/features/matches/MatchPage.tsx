import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Pencil, Trophy } from 'lucide-react';
import { Button, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../design/primitives';
import { chatApi, type ConversationDto } from '../../api/chat';
import { formats, label, opponentName, when, type Match, type Squad } from '../matchExchange/api';
import type { ScoreSummary } from '../scores/api';
import { useClock, useLoad } from '../matchExchange/hooks';
import { journeyLabel, useJourneyCopy as useArrangementCopy } from '../matchExchange/journeyCopy';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import { AppointmentCard } from '../matchExchange/AppointmentCard';
import { MatchParticipants } from '../matchExchange/MatchParticipants';
import { MatchResultSection } from '../matchExchange/MatchResultSection';
import { MatchShare } from '../matchExchange/MatchShare';
import { OfficialCoordination } from '../matchExchange/OfficialCoordination';
import { MatchReadiness } from '../clubOperations/MatchReadiness';
import { ChallengeJourneyProgress } from '../mapPlanning/ChallengeJourneyProgress';
import { BroadcastPanel } from '../broadcasts/BroadcastPanel';
import { EditMatchForm } from '../matchExchange/arrange/EditMatchForm';
import { clubProfile } from '../matchExchange/arrange/api';
import { useWorldData } from '../world/useWorldData';
import { FixtureBand } from '../matchExchange/detail/FixtureBand';
import { GroundReservation } from '../matchExchange/detail/GroundReservation';
import { MatchDayPlan } from '../matchExchange/detail/MatchDayPlan';
import { MatchManagement } from '../matchExchange/detail/MatchManagement';
import { Officials } from '../matchExchange/detail/Officials';
import { InvitationResponse, ProposalList, ProposeForm } from '../matchExchange/detail/OpponentPanels';
import { Readiness } from '../matchExchange/detail/Readiness';
import { kickoffDay, matchGates, windowOf } from '../matchExchange/detail/matchState';
import { backLink, defaultFrom, fromParam, parseFrom } from './matchContext';
import { NameOpponent, OpponentAnswer } from './MatchAsks';
import { OfferToReferee } from './OfferToReferee';
import { WhoPlayed } from './WhoPlayed';
import '../matchExchange/detail/match-detail.css';
import './match-page.css';

/** The match conversation exists once both coaching teams have agreed; `undefined` while unknown. */
function useMatchConversation(m: Match | undefined) {
    const [lookup, setLookup] = useState<{ eventId: number; conversation: ConversationDto | null }>();
    const event = m?.event_id, open = Boolean(m?.can_arrange && m.listing_status === 'ARRANGED' && m.target_squad_id);
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
 * One match, one page (step 6): whatever its origin, the same page for both clubs, the referee and families, opened in
 * the context it came from (`?from=`), which the top bar lights and the back link returns to. Each sees its own
 * call-ups; the buttons follow the job. The fixture at a glance, then what waits on this person, then the call-ups and
 * the day beside the referee, the result and the talk; changes of plan, history and filming stay aside.
 */
export function MatchPage() {
    const copy = useJourneyCopy();
    const { copy: arrangementCopy, language } = useArrangementCopy();
    const now = useClock();
    const { eventId } = useParams();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: m, error, status, reload } = useLoad<Match>(`/match-exchange/${eventId}`);
    const { data: squads } = useLoad<Squad[]>('/match-exchange/squads');
    const [editing, setEditing] = useState(false);
    const [summary, setSummary] = useState<ScoreSummary>();
    const onSummary = useCallback((next: ScoreSummary | undefined) => setSummary(next), []);
    const conversation = useMatchConversation(m);
    // A direct invitation names its club only by id until it is accepted; so does a club asked to add a calendar match.
    const requested = m?.requested_club_id && !m.opponent_name ? m.requested_club_id
        : m?.opponent_answer === 'WAITING' && m.opponent_asked_club ? m.opponent_asked_club : null;
    const invitedClub = useWorldData(requested ? `match-invited-club:${requested}` : null, signal => clubProfile(requested!, signal));
    const parent = hasNavigationCapability(user?.navigationCapabilities, 'parent.hub') && !hasNavigationCapability(user?.navigationCapabilities, 'squad.workspace');
    const from = parseFrom(params.get('from'), params.get('player')) ?? (m ? defaultFrom(m, parent) : null);
    // A link that names no context (an old link, a notification) settles on the viewer's own: the top bar then lights it.
    useEffect(() => {
        if (!m || params.get('from') || !from) return;
        setParams(current => { const next = new URLSearchParams(current); next.set('from', fromParam(from)); return next; }, { replace: true, state: location.state, preventScrollReset: true });
    }, [m, params, from, setParams, location.state]);
    const squadName = from?.kind === 'squad' ? squads?.find(s => s.id === from.id)?.name ?? (m && (m.squad_id === from.id ? m.squad_name : m.target_squad_id === from.id ? m.opponent_squad_name : null)) : null;
    const back = backLink(from ?? { kind: 'world' }, { squad: squadName, competition: m?.competition_name }, copy);

    if (!m) return (
        <GkRoot className="gk-page gk-match"><PageFrame>
            <Link className="gk-match-back" to={back.to}><ArrowLeft aria-hidden="true" />{back.label}</Link>
            {error
                ? <Panel><EmptyNote title={status === 404 || status === 403 ? copy('This match isn’t yours to see', 'ეს მატჩი თქვენთვის ხელმისაწვდომი არ არის') : copy('Couldn’t load the match', 'მატჩი ვერ ჩაიტვირთა')}
                    action={status === 404 || status === 403 ? undefined : <Button onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button>} /></Panel>
                : <div className="gk-stack" role="status" aria-label={copy('Loading the match', 'მატჩი იტვირთება')}><Skeleton height={148} /><Skeleton height={260} /></div>}
        </PageFrame></GkRoot>
    );

    // Before kick-off there is no result to report or suggest; the band shows the kick-off instead.
    const { active, eligible, canPropose, respond, finished, started } = matchGates(m, now, squads ?? []);
    const slot = windowOf(m);
    // A past match added afterwards is a record (owner, 29 October 2026): its result and its day, nothing to plan.
    const added = m.origin === 'PAST';
    const facts = [m.event_type === 'MATCH' ? copy('Match', 'მატჩი') : copy('Friendly', 'ამხანაგური'), m.age_group && m.age_group !== 'OTHER' ? (m.age_group === 'SENIOR' ? copy('Senior', 'უფროსები') : m.age_group) : null,
        m.format && m.format !== 'OTHER' ? formats[m.format] ?? label(m.format) : null, slot ? copy(`Any day ${slot.days.length > 1 ? `of ${slot.days.length}` : ''}, ${slot.from}–${slot.to}`, `ნებისმიერი დღე, ${slot.from}–${slot.to}`) : null,
        m.location_name && !slot ? m.location_name : null, added ? kickoffDay(m) : null].filter(Boolean).join(' · ');
    const invited = requested ? { name: invitedClub.data?.name ?? (m.can_respond || m.can_answer_opponent ? copy('Your club', 'თქვენი კლუბი') : copy('The invited club', 'მოწვეული კლუბი')), logoUrl: invitedClub.data?.logoUrl } : null;
    const reserving = params.get('ground') === 'reserve';
    const reserve = (open: boolean) => {
        if (open) { const next = new URLSearchParams(params); next.set('ground', 'reserve'); setParams(next, { state: { reserveSheet: true } }); return; }
        if ((location.state as { reserveSheet?: boolean } | null)?.reserveSheet) navigate(-1);
        else { const next = new URLSearchParams(params); next.delete('ground'); setParams(next, { replace: true }); }
    };
    const result = <div id="result" className="gk-mx gk-match-result"><MatchResultSection match={m} reload={reload} scoreboard={false} onSummary={onSummary} /></div>;
    const opponent = opponentName(m);
    const resultDue = new Date(new Date(m.ends_at_iso).getTime()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: m.timezone });
    // A competition fixture's match (step 6): its details and its result are the organiser's, in the competition.
    const competition = m.origin === 'COMPETITION' && m.competition_id ? { id: m.competition_id, name: m.competition_name ?? copy('the competition', 'შეჯიბრება') } : null;

    return (
        <GkRoot className="gk-page gk-match gk-match-page"><PageFrame>
            <div className="gk-match-top">
                <Link className="gk-match-back" to={back.to}><ArrowLeft aria-hidden="true" />{back.label}</Link>
                <span className="gk-match-top__actions">
                    {m.can_manage && active && !editing && !competition && <Button size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{arrangementCopy('editDetails')}</Button>}
                </span>
            </div>
            <FixtureBand match={m} summary={summary} invitedClub={invited} now={now} />
            {facts && <p className="gk-match-facts">{facts}</p>}

            {editing ? <Section title={copy('Edit match details', 'მატჩის დეტალების შეცვლა')} className="gk-match-edit">
                <EditMatchForm match={m} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
            </Section> : <div className="gk-match-layout">
                <div className="gk-stack">
                    {m.can_answer_opponent && <OpponentAnswer match={m} squads={squads ?? []} reload={reload} />}
                    {respond && <InvitationResponse match={m} squads={squads ?? []} reload={reload} />}
                    {m.can_name_opponent && !opponent && <Panel padded><NameOpponent match={m} reload={reload} /></Panel>}
                    {canPropose && <ProposeForm match={m} squads={eligible} reload={reload} />}
                    {finished && result}
                    <ProposalList match={m} active={active} reload={reload} />
                    {/* Call-ups until kick-off; from kick-off, who played (saved and locked from them). */}
                    {m.listing_status === 'ARRANGED' && (started ? <WhoPlayed match={m} /> : <MatchParticipants match={m} reload={reload} />)}
                    {!added && <MatchDayPlan match={m} active={active} conversation={conversation} reload={reload} onReserve={() => reserve(true)} />}
                    {started && !finished && result}
                    {m.can_name_opponent && opponent && <NameOpponent match={m} reload={reload} />}
                </div>
                <aside className="gk-stack gk-match-side" aria-label={copy('The match', 'მატჩი')}>
                    {m.own_appointments?.map(a => <div key={a.id} className="gk-mx"><AppointmentCard appointment={a} reload={reload} embedded /></div>)}
                    {!added && <><OfferToReferee match={m} /><Officials match={m} active={active} reload={reload} /></>}
                    {competition && m.home_score == null && <Section boxed icon={Trophy} title={copy('Result', 'შედეგი')}>
                        <p className="gk-muted">{copy('The organiser records the result in', 'შედეგს ორგანიზატორი ჩაწერს შეჯიბრებაში')} <Link to={`/tournaments/${competition.id}`}>{competition.name}</Link>.</p>
                    </Section>}
                    {!competition && !started && m.listing_status === 'ARRANGED' && m.can_arrange && <Section boxed icon={Trophy} title={copy('Result', 'შედეგი')}>
                        <p className="gk-muted">{m.referee_required ? copy(`Report the score after ${resultDue}, or the referee does.`, `ანგარიში შეიყვანეთ ${resultDue}-ის შემდეგ, ან ამას მსაჯი გააკეთებს.`)
                            : copy(`Report the score after ${resultDue}.`, `ანგარიში შეიყვანეთ ${resultDue}-ის შემდეგ.`)}</p>
                    </Section>}
                    {!added && (m.can_arrange || m.own_appointments?.some(a => a.status === 'ACCEPTED')) && (m.appointments?.some(a => a.status === 'ACCEPTED')
                        ? <div className="gk-mx"><OfficialCoordination eventId={m.event_id} /></div>
                        : <details className="gk-match-disclosure gk-mx"><summary><MessagesSquare aria-hidden="true" />{copy('Talk with the match officials', 'მატჩის მსაჯებთან საუბარი')}</summary><OfficialCoordination eventId={m.event_id} /></details>)}
                    {!added && <><Readiness match={m} now={now} conversation={conversation} />
                        {(m.can_manage || m.can_arrange) && <div className="gk-mx"><MatchReadiness key={m.event_id} event={m.event_id} /></div>}
                        <MatchManagement match={m} active={active} now={now} reload={reload} /></>}
                    <div className="gk-mx gk-match-share"><MatchShare key={m.event_id} eventId={m.event_id} privateMatch={m.visibility !== 'PUBLIC' || m.requested_club_id != null} /></div>
                    {!added && m.can_arrange && <details className="gk-match-disclosure gk-mx gk-match-journey"><summary>{copy('Travel', 'მგზავრობა')}</summary><ChallengeJourneyProgress match={m} /></details>}
                    {!added && opponent && <details className="gk-match-disclosure gk-mx"><summary>{copy('Broadcast and filming', 'ტრანსლაცია და გადაღება')}</summary><BroadcastPanel match={m} /></details>}
                    {!!m.history?.length && <details className="gk-match-disclosure">
                        <summary>{arrangementCopy('arrangementHistory')}</summary>
                        <ol className="gk-match-history">{m.history.map(item => <li key={item.id}><strong>{journeyLabel(item.action, language)}</strong> <span className="gk-faint">· {when(item.created_at)}</span>{item.reason && <p>{item.reason}</p>}</li>)}</ol>
                    </details>}
                </aside>
            </div>}
            {/* Only where a reservation can help (once open it stays, to show what it did, even when the match now holds one). */}
            {reserving && m.can_arrange && active && (m.can_manage || m.venue_id != null) && <GroundReservation match={m} onClose={() => reserve(false)} reload={reload} />}
        </PageFrame></GkRoot>
    );
}

export default MatchPage;
