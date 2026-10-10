import type { BadgeTone } from '../../design/primitives';
import type { ClubJoinPolicy } from '../../components/discovery/clubDirectoryTypes';
import { appLocale } from '../../utils/formatting';

const TZ = 'Asia/Tbilisi';
const ymd = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const parse = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Scoreboard time for a fixture line, e.g. "18:00". */
export const fixtureTime = (value?: string | null, timeZone = TZ) => {
    const date = parse(value);
    return date ? date.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }) : 'TBC';
};

/** The day under a fixture time: Today, Tomorrow or "Sat 11". */
export const fixtureDay = (value?: string | null, timeZone = TZ) => {
    const date = parse(value);
    if (!date) return 'Date to confirm';
    const today = ymd(new Date()), day = ymd(date);
    if (day === today) return 'Today';
    if (day === ymd(new Date(Date.now() + 86_400_000))) return 'Tomorrow';
    return date.toLocaleDateString(appLocale(), { weekday: 'short', day: 'numeric', timeZone });
};

export const shortDate = (value?: string | null) => {
    const date = parse(value);
    return date ? date.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', timeZone: TZ }) : null;
};

/** The coming weekend in Georgian time: this Saturday and Sunday, or the rest of it when it has begun. */
export function comingWeekend(now = new Date()) {
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(now);
    const offset = { Sat: 0, Sun: -1, Mon: 5, Tue: 4, Wed: 3, Thu: 2, Fri: 1 }[weekday] ?? 0;
    const saturday = new Date(now.getTime() + offset * 86_400_000), sunday = new Date(saturday.getTime() + 86_400_000);
    const from = weekday === 'Sun' ? now : saturday;
    const part = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(appLocale(), { ...options, timeZone: TZ }).format(date);
    const label = `${part(saturday, { weekday: 'short' })} ${part(saturday, { day: 'numeric' })} – ${part(sunday, { weekday: 'short' })} ${part(sunday, { day: 'numeric' })} ${part(sunday, { month: 'short' })}`;
    return { from: ymd(from), to: ymd(sunday), label };
}

/** The calendar day (YYYY-MM-DD, Georgian time) of an instant. */
export const isoDayOf = (value: string) => ymd(new Date(value));
export const isoDay = (offsetDays = 0) => ymd(new Date(Date.now() + offsetDays * 86_400_000));
export const daysUntil = (value?: string | null) => {
    const date = parse(value);
    return date ? Math.ceil((date.getTime() - Date.now()) / 86_400_000) : null;
};

/** "U14_GIRLS" → "U14 girls"; sentence case for API codes. */
export const sentence = (value?: string | null) => {
    if (!value) return '';
    const text = value.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
};

export const CLUB_TYPE_LABEL: Record<string, string> = {
    PROFESSIONAL: 'Professional club', SEMI_PROFESSIONAL: 'Semi-professional club', AMATEUR: 'Amateur club',
    GRASSROOTS: 'Grassroots club', ACADEMY: 'Academy', SCHOOL: 'Football school', OTHER: 'Football club',
};
export const clubTypeLabel = (type?: string | null) => (type && CLUB_TYPE_LABEL[type]) || 'Football club';

export const JOIN_POLICY: Record<ClubJoinPolicy, { label: string; tone: BadgeTone }> = {
    OPEN_TRIAL: { label: 'Open trials', tone: 'accent' },
    APPLICATION_REQUIRED: { label: 'Apply to join', tone: 'warning' },
    INVITE_ONLY: { label: 'Invite only', tone: 'neutral' },
};

export const plural = (count: number, one: string, other = `${one}s`) => `${count.toLocaleString(appLocale())} ${count === 1 ? one : other}`;
