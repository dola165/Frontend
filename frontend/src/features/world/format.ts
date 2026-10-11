import type { BadgeTone } from '../../design/primitives';
import type { ClubJoinPolicy } from '../../components/discovery/clubDirectoryTypes';
import { appLocale } from '../../utils/formatting';
import { isGeorgian, wt } from './copy';

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
    return date ? date.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }) : wt('TBC');
};

/** The day under a fixture time: Today, Tomorrow or "Sat 11". */
export const fixtureDay = (value?: string | null, timeZone = TZ) => {
    const date = parse(value);
    if (!date) return wt('Date to confirm');
    const today = ymd(new Date()), day = ymd(date);
    if (day === today) return wt('Today');
    if (day === ymd(new Date(Date.now() + 86_400_000))) return wt('Tomorrow');
    return date.toLocaleDateString(appLocale(), { weekday: 'short', day: 'numeric', timeZone });
};

export const shortDate = (value?: string | null) => {
    const date = parse(value);
    return date ? date.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', timeZone: TZ }) : null;
};

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
/** An API code (age group, position, level) in words, in the current language: "SENIOR" → "Senior". */
export const codeLabel = (value?: string | null) => value ? wt(sentence(value)) : '';

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

/** "800 m away", "2.6 km away". */
export const distanceLabel = (km: number) => km < 1
    ? wt('{distance} m away', { distance: Math.max(100, Math.round(km * 10) * 100) })
    : wt('{distance} km away', { distance: km.toLocaleString(appLocale(), { maximumFractionDigits: km < 10 ? 1 : 0 }) });

/** Existing two-language labels (en, ka) follow the World language. */
export const bilingual = (en: string, ka: string) => (isGeorgian() ? ka : en);

/** "Posted today", "Posted 3 days ago". */
export function postedLabel(value?: string | null) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return wt('Recently posted');
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    return days === 0 ? wt('Posted today') : days === 1 ? wt('Posted yesterday') : wt('Posted {days} days ago', { days });
}

/** Who can enter a competition. */
export const SCOPE_LABEL: Record<string, string> = { CLUB: 'Club teams', SQUAD: 'Squads', PLAYER: 'Individual players' };
/** A competition's published status as a badge. */
export const COMPETITION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
    PLANNING: { label: 'Planning', tone: 'violet' }, ACTIVE: { label: 'In progress', tone: 'accent' }, COMPLETED: { label: 'Completed', tone: 'neutral' }, CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

/** A date on the fixture line: the day number over the month, or "to confirm". */
export function dateColumn(value?: string | null) {
    const start = value ? new Date(value) : null;
    const valid = Boolean(start && !Number.isNaN(start.getTime()));
    return valid
        ? { time: start!.toLocaleDateString(appLocale(), { day: 'numeric' }), day: start!.toLocaleDateString(appLocale(), { month: 'short' }) }
        : { time: wt('TBC'), day: wt('Dates to confirm') };
}
