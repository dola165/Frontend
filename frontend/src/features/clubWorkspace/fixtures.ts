import type { BadgeTone, FixtureTone } from '../../design/primitives';
import type { ScheduleEventOccurrence, ScheduleEventType } from '../schedule/api';
import { formatDate, formatTime } from '../../utils/formatting';

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

/** "Today", "Tomorrow" or a short weekday and date, for the fixture line's day column. */
export function dayLabel(value: string, now = new Date()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return formatDate(date, { weekday: 'short', day: 'numeric' });
}
export const timeLabel = (value: string) => formatTime(value);
export const isToday = (value: string, now = new Date()) => startOfDay(new Date(value)) === startOfDay(now);

export const eventKind: Record<ScheduleEventType, { tone: FixtureTone; badge: BadgeTone; label: string }> = {
    TRAINING: { tone: 'training', badge: 'info', label: 'Training' },
    MATCH: { tone: 'match', badge: 'accent', label: 'Match' },
    FRIENDLY: { tone: 'match', badge: 'accent', label: 'Friendly' },
    TRYOUT: { tone: 'trial', badge: 'warning', label: 'Tryout' },
    ACTIVITY: { tone: 'event', badge: 'violet', label: 'Club event' },
};
export const kindOf = (event: ScheduleEventOccurrence) => eventKind[event.eventType] ?? eventKind.ACTIVITY;

/** The squad a club calendar entry belongs to, when the calendar says so. */
export function eventSquadId(event: ScheduleEventOccurrence) {
    const fromOccurrence = /^squad:(\d+):/.exec(event.occurrenceId ?? '')?.[1];
    return event.challengerSquadId ?? (fromOccurrence ? Number(fromOccurrence) : null);
}

/** A short "due" label for a record date without inventing a time. */
export function dueLabel(value: string | null | undefined, now = new Date()) {
    if (!value) return null;
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
    if (days < 0) return { label: `Overdue since ${formatDate(date, { day: 'numeric', month: 'short' })}`, overdue: true };
    if (days === 0) return { label: 'Due today', overdue: false };
    if (days === 1) return { label: 'Due tomorrow', overdue: false };
    return { label: `Due ${formatDate(date, { day: 'numeric', month: 'short' })}`, overdue: false };
}

type Session = { id: number; title: string; starts_at: string; squad_id: number; squad_name: string };
/** One line in a squad agenda: a training session from the squad's plan, or a match or event from the club calendar. */
export interface AgendaEntry { key: string; startsAt: string; squadId: number; squadName: string; session?: Session; event?: ScheduleEventOccurrence }

/** Training sessions plus the matches and events of some squads, soonest first, within a time window. */
export function squadAgenda(sessions: Session[], events: ScheduleEventOccurrence[], squads: { id: number; name: string }[], from: number, to: number): AgendaEntry[] {
    const ids = new Set(squads.map(squad => squad.id));
    const name = (id: number) => squads.find(squad => squad.id === id)?.name ?? '';
    const entries: AgendaEntry[] = [
        ...sessions.filter(session => ids.has(session.squad_id)).map(session => ({ key: `s-${session.id}`, startsAt: session.starts_at, squadId: session.squad_id, squadName: session.squad_name, session })),
        ...events.filter(event => event.eventType !== 'TRAINING').map(event => ({ event, squad: eventSquadId(event) }))
            .filter((item): item is { event: ScheduleEventOccurrence; squad: number } => item.squad !== null && ids.has(item.squad))
            .map(({ event, squad }) => ({ key: `e-${event.eventId}-${event.occurrenceId}`, startsAt: event.startsAt, squadId: squad, squadName: name(squad), event })),
    ];
    return entries.filter(entry => { const time = new Date(entry.startsAt).getTime(); return time >= from && time <= to; })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
