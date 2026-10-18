import type { BadgeTone, FixtureTone } from '../../design/primitives';
import type { ScheduleEventOccurrence, ScheduleEventType } from '../schedule/api';
import { formatDate } from '../../utils/formatting';
import { translate } from '../../locales/useCopy';
import { fixtureCopyEn } from '../../locales/workspaceDesign';

const tr = (key: Parameters<typeof translate<typeof fixtureCopyEn>>[2], values?: Record<string, string | number>) => translate('fixtureCopy', fixtureCopyEn, key, values);
const validZone = (zone?: string | null) => {
    if (!zone) return undefined;
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone; } catch { return undefined; }
};
/** The calendar day of a moment as YYYY-MM-DD, in a time zone when one is given (the club's), otherwise the device's. */
const calendarDay = (value: Date, timeZone?: string | null) => {
    const zone = validZone(timeZone);
    if (zone) return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
/** Whole days from today to a date (negative once it has passed), or null without a valid date. */
export function daysFromToday(value: string | null | undefined, now: Date | number = new Date()) {
    const day = value?.slice(0, 10);
    return day && !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) ? daysBetween(calendarDay(new Date(now)), day) : null;
}
/** A deadline in words that scan down a list: "3 days overdue", "Today", "Tomorrow", "Thu 16", "24 Oct". */
export function dueWords(value: string | null | undefined, now: Date | number = new Date()) {
    const days = daysFromToday(value, now);
    if (days === null || !value) return null;
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    const text = days < 0 ? tr('daysOverdue', { count: -days }) : days === 0 ? tr('today') : days === 1 ? tr('tomorrow')
        : formatDate(date, days < 7 ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' });
    return { text, days, late: days < 0, today: days === 0, date };
}

/** "Today", "Tomorrow" or a short weekday and date, for the fixture line's day column. */
export function dayLabel(value: string, now: Date | number = new Date(), timeZone?: string | null) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const days = daysBetween(calendarDay(new Date(now), timeZone), calendarDay(date, timeZone));
    if (days === 0) return tr('today');
    if (days === 1) return tr('tomorrow');
    return formatDate(date, { weekday: 'short', day: 'numeric', ...(validZone(timeZone) ? { timeZone: validZone(timeZone) } : {}) });
}
/** The same day in running text: "today", "tomorrow" or "Mon 12". */
export function dayInline(value: string, now: Date | number = new Date(), timeZone?: string | null) {
    const label = dayLabel(value, now, timeZone);
    return label === tr('today') ? tr('todayInline') : label === tr('tomorrow') ? tr('tomorrowInline') : label;
}
/** A clock time, in the club's time zone when one is given. */
export const timeLabel = (value: string, timeZone?: string | null) => formatDate(value, { hour: '2-digit', minute: '2-digit', ...(validZone(timeZone) ? { timeZone: validZone(timeZone) } : {}) });
export const isToday = (value: string, now: Date | number = new Date(), timeZone?: string | null) => calendarDay(new Date(value), timeZone) === calendarDay(new Date(now), timeZone);

const kinds: Record<ScheduleEventType, { tone: FixtureTone; badge: BadgeTone }> = {
    TRAINING: { tone: 'training', badge: 'info' },
    MATCH: { tone: 'match', badge: 'accent' },
    FRIENDLY: { tone: 'match', badge: 'accent' },
    TRYOUT: { tone: 'trial', badge: 'warning' },
    ACTIVITY: { tone: 'event', badge: 'violet' },
    MEETING: { tone: 'event', badge: 'violet' },
};
/** How a calendar entry looks on a fixture line: its tone, badge colour and translated kind. */
export const kindOf = (event: Pick<ScheduleEventOccurrence, 'eventType'>) => {
    const type = event.eventType in kinds ? event.eventType : 'ACTIVITY';
    return { ...kinds[type], label: tr(type) };
};

/** The squad a club calendar entry belongs to, when the calendar says so. */
export function eventSquadId(event: ScheduleEventOccurrence) {
    const fromOccurrence = /^squad:(\d+):/.exec(event.occurrenceId ?? '')?.[1];
    return event.challengerSquadId ?? (fromOccurrence ? Number(fromOccurrence) : null);
}

/**
 * The one "due" label for a record date, without inventing a time: "Overdue since 7 Oct", "Due today",
 * "Due tomorrow" or "Due 9 Oct". A finished record is never late; it shows its date only.
 */
export function dueLabel(value: string | null | undefined, now: Date | number = new Date(), finished = false) {
    if (!value) return null;
    const day = value.slice(0, 10);
    const date = new Date(`${day}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const short = formatDate(date, { day: 'numeric', month: 'short' });
    if (finished) return { label: short, overdue: false };
    const days = daysBetween(calendarDay(new Date(now)), day);
    if (days < 0) return { label: tr('overdueSince', { date: short }), overdue: true };
    if (days === 0) return { label: tr('dueToday'), overdue: false };
    if (days === 1) return { label: tr('dueTomorrow'), overdue: false };
    return { label: tr('due', { date: short }), overdue: false };
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
