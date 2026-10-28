import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Camera, ChevronRight, MessageCircle, Megaphone, MessagesSquare, Plus, Trophy, Users, X } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { PostComposer } from '../../../components/feed/PostComposer';
import type { SquadSession } from '../../squadCommunication/api';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { eventSquadId } from '../fixtures';
import { CancelSessionDialog } from './CancelSessionDialog';
import { Status } from '../../../design/DataTable';
import { ScoreDialog } from '../../scores/ScoreDialog';
import { ActionButton } from '../../actions/ActionButton';
import { isOpen, scoreState } from '../../scores/status';
import { useResultCopy } from '../../matchHistory/copy';
import { Crest } from '../../../design/visuals';
import { addDays, isoDay } from '../../../design/calendar/calendarDates';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { formatDate } from '../../../utils/formatting';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { DayAgenda, type DayAgendaItem } from '../DayAgenda';
import { dayLabel, timeLabel } from '../fixtures';
import { coachEvents, type CoachEvent } from './coachEvents';
import { coachNeeds, squadNeeds, type CoachNeed } from './coachNeeds';
import { NextMatchCard } from './NextMatchCard';
import { openStaffRoom } from './squadApi';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { kindNames, opponentOf, sessionKind, upcoming } from './useCoachData';
import { ActivityBadge } from './CoachVisuals';
import { ActivitySummary } from './ActivitySummary';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

const sessionLink = (data: CoachData, squad: number, session: { id: number; starts_at: string }) => data.link('calendar', { squad: String(squad), date: isoDay(new Date(session.starts_at)), session: `${squad}:${session.id}` });

/**
 * My squads: one card per squad I am responsible for (its people, its next session, the one thing waiting on
 * me), then what is soon across them. Nothing else. The page works with just a squad's name and fills up as
 * players, sessions and families arrive; every action is the club's own, filtered to the squad. Nobody is asked
 * to confirm they are coming (the owner, 14 October): talking to the squad is the main thing.
 */
/** A session the coach is about to cancel, from a card or a Soon row. */
type Cancelling = { squad: number; session: SquadSession } | null;

export function MySquads({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
    const [cancelling, setCancelling] = useState<Cancelling>(null);
    const [sharing, setSharing] = useState(false);
    // An existing session, match or club event opens as a short summary first (`activity` in the address); Edit is one press.
    const [params, setParams] = useSearchParams();
    const activityKey = params.get('activity');
    const activity = activityKey && data.squads ? coachEvents(data).find(event => event.key === activityKey) : undefined;
    const setActivity = (key: string | null) => { const next = new URLSearchParams(params); if (key) next.set('activity', key); else next.delete('activity'); setParams(next, { replace: !key }); };
    // Needs you is personal: what waits on this person's jobs first (joining to decide, call-ups to chase), then the squads' own.
    const needs = [...squadNeeds({ joining: data.joining.items, cards: data.cards, names: data.names, now: data.now, link: data.link }),
        ...(data.squads ? coachNeeds({ club: data.clubId, squads: data.squads, names: data.names, now: data.now, person: data.person,
            records: data.records.rows.filter(record => record.squad_id !== null && data.shown.includes(record.squad_id)), mine: data.records.mine, link: data.link }) : [])].filter(need => need.kind !== 'reply');
    // Posting updates and photos is coaching; staff on a squad who don't coach read it.
    const coaches = Boolean(data.squads?.some(squad => squad.overview?.can_manage));
    return <PageFrame className="cw-page ch-page">
        <PageHeader title={copy('mySquads')} subtitle={formatDate(new Date(data.now), { weekday: 'long', day: 'numeric', month: 'long' })}
            actions={coaches ? <><Button variant="secondary" onClick={() => setSharing(true)}><Camera aria-hidden="true" />{copy('sharePhoto')}</Button>
                <ButtonLink variant="primary" to={data.link('updates', { compose: '1' })}><Megaphone aria-hidden="true" />{copy('postUpdate')}</ButtonLink></> : undefined} />
        <ul className="ch-cards" aria-label={copy('mySquads')}>
            {data.mine.map(squad => <SquadCard key={squad.id} squad={squad} data={data} need={needs.find(need => need.squad === squad.id) ?? null} onCancel={session => setCancelling({ squad: squad.id, session })} />)}
            <li><Link className="ch-card ch-card--ask" to={data.link('coaches')}><Plus aria-hidden="true" />{copy('askSquad')}</Link></li>
        </ul>
        <ResultsToAdd data={data} />
        <Soon data={data} onOpen={setActivity} onCancel={(squad, session) => setCancelling({ squad, session })} />
        {activity && <ActivitySummary event={activity} data={data} onClose={() => setActivity(null)}
            editTo={activity.session ? `${sessionLink(data, activity.squadId, activity.session)}&edit=1` : undefined}
            onEdit={activity.event ? () => data.openEvent(activity.event!) : undefined}
            onCancel={activity.session ? () => { setActivity(null); setCancelling({ squad: activity.squadId, session: activity.session! }); } : undefined} />}
        {cancelling && <CancelSessionDialog squad={cancelling.squad} squadName={data.names.get(cancelling.squad) ?? ''} session={cancelling.session} now={data.now}
            onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); data.refresh(); }} />}
        {sharing && <Dialog open size="md" title={copy('sharePhoto')} description={copy('sharePhotoHint')} onClose={() => setSharing(false)}>
            <PostComposer clubId={data.clubId} onPostCreated={() => setSharing(false)} />
        </Dialog>}
    </PageFrame>;
}

/** Matches of my squads played in the last week whose score still has an open step: one row each, its status beside it. */
function ResultsToAdd({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
    const { copy: result } = useResultCopy();
    const [adding, setAdding] = useState<ScheduleEventOccurrence | null>(null);
    const since = data.now - 7 * 86_400_000;
    const played = data.events.filter(event => ['MATCH', 'FRIENDLY'].includes(event.eventType) && event.status !== 'CANCELLED' && event.canRecordResult !== false
        && ((event.resultStatus ?? 'NONE') === 'NONE' || isOpen(event.resultStatus)) && event.homeScore == null && data.shown.includes(eventSquadId(event) ?? -1)
        && new Date(event.endsAt).getTime() < data.now && new Date(event.endsAt).getTime() >= since);
    if (!played.length) return null;
    const items: DayAgendaItem[] = played.map(event => {
        const state = scoreState(event.resultStatus);
        const word = (event.resultStatus ?? 'NONE') === 'NONE' ? copy('addResult') : result(...state.words);
        return {
            key: `result-${event.eventId}-${event.occurrenceId}`, startsAt: event.startsAt, title: event.title, kind: event.eventType, kindLabel: kindNames[event.eventType],
            squad: data.names.get(eventSquadId(event) ?? -1), meta: [data.names.get(eventSquadId(event) ?? -1), event.locationName].filter(Boolean).join(' · '),
            status: <Status tone={state.tone}>{word}</Status>, onClick: () => setAdding(event), label: `${word}: ${event.title}`,
        };
    });
    return <>
        <Section boxed icon={Trophy} title={result('Scores', 'ანგარიშები')} hint={`${played.length}`}><Panel flush><DayAgenda label={result('Scores', 'ანგარიშები')} items={items} limit={6} /></Panel></Section>
        {/* A Match Exchange match reads its own home and away; a calendar match has this club at home. */}
        {adding && <ScoreDialog target={adding.matchExchangeId ? { kind: 'EXCHANGE', eventId: adding.matchExchangeId } : { kind: 'CALENDAR', eventId: adding.eventId }}
            teams={adding.matchExchangeId ? undefined : { home: { name: data.clubName, logo: data.clubLogo, clubId: data.clubId }, away: { clubId: adding.opponentClubId, name: adding.opponentClubName || result('Opponent', 'მეტოქე') } }}
            title={adding.title} description={`${adding.title} · ${dayLabel(adding.startsAt, data.now)} ${timeLabel(adding.startsAt)}`}
            onClose={() => setAdding(null)} onChanged={data.refresh} />}
    </>;
}

/**
 * A squad as everyone on it sees it: crest and name, the next session, the next match, what waits on this person, the
 * chat, the staff room and a match to arrange (for those whose job arranges them).
 */
function SquadCard({ squad, data, need, onCancel }: { squad: RolesWorkspace['squads'][number]; data: CoachData; need: CoachNeed | null; onCancel: (session: SquadSession) => void }) {
    const copy = useCopy('coachHub', coachHubEn);
    const words = useCopy('mySquads', mySquadsEn);
    const navigate = useNavigate();
    const [roomError, setRoomError] = useState('');
    const card = data.cards?.get(squad.id);
    const openRoom = async () => {
        setRoomError('');
        try { const room = await openStaffRoom(squad.id); navigate(`/messages?conversationId=${room.conversationId}`); }
        catch (error) { setRoomError(extractApiErrorMessage(error, words('staffRoomFailed'))); }
    };
    const space = data.squads?.find(item => item.id === squad.id);
    // The next match has its own line, so the first line is the next other thing: the same fixture is never shown twice.
    const sameFixture = (session: SquadSession) => Boolean(card?.match) && sessionKind(session) !== 'TRAINING'
        && Math.abs(new Date(session.starts_at).getTime() - new Date(card!.match!.starts_at_iso).getTime()) < 60_000;
    const next = space ? upcoming(space, data.now).find(session => !sameFixture(session)) : undefined;
    const kind = next ? sessionKind(next) : null;
    const opponent = next ? opponentOf(next, squad.id, data.events, data.clubName) : null;
    const week = data.link('calendar', { squad: String(squad.id) });
    const noPlayers = data.squads && !data.roles.people.some(person => person.squad_id === squad.id);
    return <li><article className="ch-card" aria-label={squad.name}>
        {/* The squad is the thing: its crest and name on a pitch, and the whole band opens its page (updates and chats). */}
        <Link className="ch-card__band" to={data.link('overview', { squad: String(squad.id) })} style={{ backgroundImage: `url(${kind && kind !== 'TRAINING' ? '/football/touchline.jpg' : '/football/ball-field.jpg'})` }}>
            <Crest src={data.clubLogo} name={data.clubName} size={52} />
            <span className="ch-card__name"><strong>{squad.name}</strong><span>{[data.roleOf(squad.id), copy('playerCount', { count: squad.player_count })].filter(Boolean).join(' · ')}</span></span>
            <ChevronRight className="ch-card__go" aria-hidden="true" />
        </Link>
        <div className="ch-card__lines">
            {!data.squads ? <Skeleton height={24} />
                : next && kind ? <span className="ch-card__row">
                    <Link className="ch-card__line" to={data.link('overview', { activity: `s-${next.id}` })}>
                        <ActivityBadge kind={kind} size={26} />
                        <span className="ch-card__line-text"><strong>{dayLabel(next.starts_at, data.now)} {timeLabel(next.starts_at)}</strong> · {opponent ? copy('versus', { team: opponent.name }) : next.title}{next.location ? ` · ${next.location}` : ''}</span>
                    </Link>
                    <Button size="sm" variant="ghost" iconOnly aria-label={`${copy('cancelSession')}: ${next.title}`} title={copy('cancelSession')} onClick={() => onCancel(next)}><X aria-hidden="true" /></Button>
                </span>
                    // Sessions that could not be read are not "no sessions": say so, with the retry, instead of asking to plan one.
                    : space?.failed.includes('sessions') ? <button type="button" className="ch-card__line" disabled={data.retrying.includes(squad.id)} onClick={() => data.retrySquad(squad.id)}>
                        <span className="ch-card__line-icon"><span className="cw-dot cw-dot--warning" aria-hidden="true" /></span>
                        <span className="ch-card__line-text">{copy('sessionsFailed')}</span>
                        <span className="cw-status cw-status--warning">{data.retrying.includes(squad.id) ? copy('retrying') : copy('retry')}</span>
                    </button>
                    : noPlayers ? <Link className="ch-card__line" to={data.link('players', { squad: String(squad.id), roster: '1' })}><span className="ch-card__line-icon"><Users aria-hidden="true" /></span><span className="ch-card__line-text ch-card__line-text--action">{copy('addPlayers')}</span></Link>
                        : <Link className="ch-card__line" to={week}><span className="ch-card__line-icon"><CalendarDays aria-hidden="true" /></span><span className="ch-card__line-text ch-card__line-text--action">{copy('whenTrain')}</span></Link>}
            {card?.match && <NextMatchCard card={card} data={data} compact onChanged={data.refresh} />}
            {need && <Link className="ch-card__line" to={need.to}>
                <span className="ch-card__line-icon"><span className={`cw-dot cw-dot--${need.tone}`} aria-hidden="true" /></span>
                <span className="ch-card__line-text">{need.title}</span>
                <span className={`cw-status cw-status--${need.tone}`}>{need.status}</span><ChevronRight className="cw-chevron" aria-hidden="true" />
            </Link>}
        </div>
        <div className="ch-card__actions">
            <ButtonLink size="sm" variant="primary" to={`/messages?squadId=${squad.id}`}><MessageCircle aria-hidden="true" />{copy('squadChat')}</ButtonLink>
            <Button size="sm" onClick={() => void openRoom()}><MessagesSquare aria-hidden="true" />{words('staffRoom')}</Button>
            {/* Already seeded with this squad and the home ground: only the opponent and the day are left to choose. */}
            <ActionButton action="arrange_match" subject={{ kind: 'squad', id: squad.id, clubId: data.clubId }} size="sm" className="ch-card__arrange" label={copy('arrangeMatch')} />
        </div>
        {roomError && <p className="gk-notice gk-notice--danger ch-card__error" role="alert">{roomError}</p>}
    </article></li>;
}

/** The next seven days of my squads by day, same-time entries merged; only a cancellation gets a status word. */
function Soon({ data, onOpen, onCancel }: { data: CoachData; onOpen: (key: string) => void; onCancel: (squad: number, session: SquadSession) => void }) {
    const copy = useCopy('coachHub', coachHubEn);
    const all = coachEvents(data), end = addDays(new Date(data.now), 7);
    const events = all.filter(event => event.end.getTime() >= data.now && event.start < end);
    const later = all.find(event => event.start >= end);
    const open = (event: CoachEvent) => onOpen(event.key);
    const items: DayAgendaItem[] = events.map(event => ({
        key: event.key, startsAt: event.start.toISOString(), title: event.opponent ? copy('matchTitle', { home: event.squad, away: event.opponent.name }) : event.title, kind: event.kind, kindLabel: kindNames[event.kind],
        squad: event.squad, meta: [event.opponent ? null : event.squad, event.location].filter(Boolean).join(' · '),
        status: event.cancelled ? <span className="cw-status cw-status--danger">{copy('cancelled')}</span> : undefined, onClick: () => open(event), label: `${event.title} · ${event.squad}`,
        actions: event.session && !event.cancelled && event.start.getTime() > data.now
            ? <Button size="sm" variant="ghost" iconOnly aria-label={`${copy('cancelSession')}: ${event.title}`} title={copy('cancelSession')} onClick={() => onCancel(event.squadId, event.session!)}><X aria-hidden="true" /></Button> : undefined,
    }));
    return <Section boxed icon={CalendarDays} title={copy('soon')} hint={copy('nextSevenDays')} action={<span className="ch-soon__actions">
        <Link className="gk-section__action" to={data.link('matches', { arrange: '1' })}>+ {copy('arrangeMatch')}</Link>
        <Link className="gk-section__action" to={data.link('calendar')}>{copy('calendar')}</Link>
    </span>}>
        <Panel flush>{!data.squads ? <div className="cw-skeleton-rows" role="status" aria-label={copy('soon')}>{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
            : items.length ? <DayAgenda label={copy('soon')} items={items} limit={14} />
                : data.squads.some(squad => data.shown.includes(squad.id) && squad.failed.includes('sessions')) ? <p className="cw-panel-note cw-panel-note--first">{copy('sessionsFailed')}</p>
                : <EmptyNote title={copy('soonEmpty')} action={<ButtonLink size="sm" to={data.link('calendar')}>{copy('planSession')}</ButtonLink>}>
                    {later ? copy('nextUp', { day: dayLabel(later.start.toISOString(), data.now), time: timeLabel(later.start.toISOString()), name: later.short, squad: later.squad }) : copy('soonEmptyHint')}
                </EmptyNote>}</Panel>
    </Section>;
}
