import type { CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, ExternalLink, MapPin, MessageCircle, X } from 'lucide-react';
import { Avatar, Button, ButtonLink, PageFrame, PageHeader } from '../../../design/primitives';
import { Crest, FaceStack } from '../../../design/visuals';
import { EventCalendar, type CalendarView } from '../../../design/calendar/EventCalendar';
import { addDays, fromIsoDay, isoDay, monthGrid, startOfWeek } from '../../../design/calendar/calendarDates';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { canReadSquad } from '../../clubOperations/squadAccess';
import { formatDate } from '../../../utils/formatting';
import { ActivityLegend } from '../DayAgenda';
import { timeLabel } from '../fixtures';
import { coachEvents, type CoachEvent } from './coachEvents';
import { kindNames, replies, useCrests, useSquadSessions } from './useCoachData';
import { ActivityBadge, ReplySummary, SquadSwitch } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/** Everything about one calendar entry: when, where, against whom, and who's coming (who can't and why first). */
function EventDetails({ event, data, onClose }: { event: CoachEvent; data: CoachData; onClose: () => void }) {
    const crests = useCrests(event.opponent?.id ? [event.opponent.id] : []);
    const session = event.session, reply = session ? replies(session) : null;
    const group = (response: string) => reply?.players.filter(player => player.response === response) ?? [];
    const cant = group('NOT_GOING'), unsure = group('UNSURE'), none = session?.response_requested ? group('UNANSWERED') : [], coming = group('GOING');
    const register = event.kind === 'TRAINING' && !event.cancelled && event.start.getTime() <= data.now + 2 * 3_600_000 && canReadSquad(data.boot, 'ATTENDANCE', event.squadId);
    const people = (label: string, list: typeof cant, tone: string, reasons = false) => list.length > 0 && <div className="ch-details__group">
        <p className={`ch-details__label ch-details__label--${tone}`}>{label} · {list.length}</p>
        {reasons ? <ul className="ch-people">{list.map(player => <li key={player.id}><Avatar name={player.name} size={26} /><span>{player.name}{player.reason && <span className="ch-quiet"> · {player.reason}</span>}</span></li>)}</ul>
            : <FaceStack people={list.map(player => ({ id: player.id, name: player.name }))} max={14} size={26} label={list.map(player => player.name).join(', ')} />}
    </div>;
    return <div className="ch-details ch-event" style={{ '--activity': activityColors[event.kind] } as CSSProperties}>
        <div className="ch-event__head">
            <span className="ch-event__kind"><ActivityBadge kind={event.kind} size={28} />{kindNames[event.kind]}</span>
            <Button size="sm" variant="ghost" iconOnly aria-label="Close" onClick={onClose}><X aria-hidden="true" /></Button>
        </div>
        {event.opponent ? <div className="ch-match ch-match--small">
            <span className="ch-match__side"><Crest src={data.clubLogo} name={data.clubName} size={34} /><strong>{event.squad}</strong></span>
            <span className="ch-match__vs">vs</span>
            <span className="ch-match__side"><Crest src={event.opponent.id ? crests.get(event.opponent.id) : null} name={event.opponent.name} size={34} /><strong>{event.opponent.name}</strong></span>
        </div> : <h2 className="ch-event__title">{event.title}</h2>}
        <p className="ch-event__when"><CalendarDays aria-hidden="true" />{formatDate(event.start, { weekday: 'long', day: 'numeric', month: 'long' })} · {timeLabel(event.start.toISOString())}–{timeLabel(event.end.toISOString())}</p>
        {event.location && <p className="ch-event__when"><MapPin aria-hidden="true" />{event.location}</p>}
        {event.cancelled && <p className="gk-notice gk-notice--danger">Cancelled{session?.cancellation_reason ? `: ${session.cancellation_reason}` : ''}</p>}
        {session && !event.cancelled && <>
            <ReplySummary session={session} />
            {people('Can’t come', cant, 'danger', true)}{people('No reply', none, 'warning', true)}{people('Unsure', unsure, 'info', true)}{people('Coming', coming, 'accent')}
        </>}
        <div className="ch-event__actions">
            {register && <ButtonLink size="sm" variant="primary" to={data.workHref('attendance', { squad: String(event.squadId), session: String(session!.id) })}><ClipboardCheck aria-hidden="true" />Take register</ButtonLink>}
            {session ? <ButtonLink size="sm" to={`/squads/${event.squadId}?tab=sessions&sessionId=${session.id}&at=${event.start.toISOString()}`}><ExternalLink aria-hidden="true" />Change or cancel</ButtonLink>
                : event.event && <Button size="sm" onClick={() => data.openEvent(event.event!)}><ExternalLink aria-hidden="true" />Open in club calendar</Button>}
            <ButtonLink size="sm" variant="ghost" to={`/messages?squadId=${event.squadId}`}><MessageCircle aria-hidden="true" />Squad chat</ButtonLink>
        </div>
    </div>;
}

/**
 * The squads' calendar: a real month or week with every session, match and club event in its activity colour.
 * Picking one shows who's coming beside it. View, date and the picked entry live in the URL.
 */
export function CoachCalendar({ data }: { data: CoachData }) {
    const [params, setParams] = useSearchParams();
    const view: CalendarView = params.get('view') === 'week' ? 'week' : 'month';
    const date = fromIsoDay(params.get('date')) ?? new Date(data.now);
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
        setParams(next, { replace: true });
    };
    const grid = monthGrid(date), from = view === 'month' ? grid[0] : startOfWeek(date), to = view === 'month' ? addDays(grid[41], 1) : addDays(startOfWeek(date), 7);
    const ranged = useSquadSessions(data.shown, from, to, data.revision);
    const events = coachEvents(data, ranged.squads);
    const selected = events.find(event => event.key === params.get('event')) ?? null;
    const soon = events.filter(event => event.end.getTime() >= data.now && !event.cancelled).slice(0, 6);
    const note = (event: CoachEvent) => {
        if (!event.session || event.cancelled) return undefined;
        const reply = replies(event.session);
        return reply.asked && reply.none ? <span className="ch-cal-note ch-cal-note--chase">{reply.none} no reply</span> : reply.cant ? <span className="ch-cal-note">{reply.cant} can’t</span> : undefined;
    };

    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Calendar" actions={<ButtonLink to={`/calendar?clubId=${data.clubId}`}><CalendarDays aria-hidden="true" />Club calendar</ButtonLink>} />
        <SquadSwitch data={data} />
        <div className="ch-calendar" aria-busy={ranged.loading}>
            <EventCalendar label="Squad calendar" view={view} date={date} now={new Date(data.now)} selected={selected?.key}
                events={events.map(event => ({ key: event.key, start: event.start, end: event.end, title: event.short, color: activityColors[event.kind], icon: activityIcons[event.kind], cancelled: event.cancelled, note: note(event) }))}
                onSelect={event => set({ event: event.key, date: isoDay(event.start) })} onNavigate={day => set({ date: isoDay(day) })} onView={value => set({ view: value === 'month' ? null : value })} />
            <aside className="ch-calendar__side" aria-label="Details">
                {selected ? <EventDetails key={selected.key} event={selected} data={data} onClose={() => set({ event: null })} />
                    : <div className="ch-details">
                        <p className="ch-details__label">Coming up</p>
                        {soon.length ? <ul className="ch-soon">{soon.map(event => <li key={event.key}><Link to={data.link('calendar', { ...(view === 'week' ? { view } : {}), date: isoDay(event.start), event: event.key })}
                            className="ch-soon__item"><ActivityBadge kind={event.kind} size={28} /><span><strong>{event.short}</strong><span>{formatDate(event.start, { weekday: 'short', day: 'numeric' })} · {timeLabel(event.start.toISOString())} · {event.squad}</span></span></Link></li>)}</ul>
                            : <p className="ch-quiet">Nothing planned in this period.</p>}
                        <p className="ch-quiet">Pick anything on the calendar to see who’s coming.</p>
                    </div>}
            </aside>
        </div>
        <ActivityLegend />
    </PageFrame>;
}
