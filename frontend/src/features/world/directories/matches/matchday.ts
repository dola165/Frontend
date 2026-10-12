import { getMatchHistory } from '../../../matchHistory/api';
import type { AuthSessionId } from '../../../../utils/authStorage';
import { shared, detached } from '../../cache';
import { first, type DirectoryQuery } from '../../directory/types';
import { rememberMatches } from '../../scoreboard/matchRegistry';
import { loadMyTeams } from '../../scoreboard/myTeams';
import { toFixtures, type Fixture } from './fixtures';

/** A day's matches in the strip: how many, and whether one of my teams plays. */
export interface DayCount { count: number; mine: boolean }
/** Every match a week either side of today, once: the strip's counts and each day's list come from it. */
export interface MatchdayWindow { from: string; to: string; days: string[]; counts: Map<string, DayCount>; items: Fixture[]; truncated: boolean }

const WINDOW_PAGE = 100, WINDOW_PAGES = 2;
/** A calendar day (YYYY-MM-DD) moved by whole days; days are dates, never instants, so no clock is involved. */
export const shiftDay = (day: string, by: number) => new Date(Date.parse(`${day}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

/** The days of the strip: a week either side of today. */
export function windowRange(today: string, span = 7) {
    const days = Array.from({ length: span * 2 + 1 }, (_, index) => shiftDay(today, index - span));
    return { from: days[0], to: days[days.length - 1], days };
}

/** How many matches each day of the window has, and which days one of my teams plays. */
export function bucketDays(items: Fixture[], days: string[]): Map<string, DayCount> {
    const counts = new Map(days.map(day => [day, { count: 0, mine: false }]));
    for (const f of items) {
        const day = f.day ? counts.get(f.day) : undefined;
        if (!day) continue;
        day.count += 1;
        day.mine ||= f.mine.home || f.mine.away;
    }
    return counts;
}

/** Where Fixtures opens: today when it has matches, else the next day that does; null when nothing comes in the window. */
export function openingDay(counts: Map<string, DayCount>, today: string): string | null {
    return [...counts].find(([day, count]) => day >= today && count.count > 0)?.[0] ?? null;
}

/** The next day after `after` with matches, and how many. */
export function nextMatchday(counts: Map<string, DayCount>, after: string): { day: string; count: number } | null {
    const found = [...counts].find(([day, count]) => day > after && count.count > 0);
    return found ? { day: found[0], count: found[1].count } : null;
}

/** The filters that narrow what the window holds (a day and an end of the list do not). */
const WINDOW_KEYS = ['source', 'mine', 'clubId', 'squadId', 'tournamentId', 'resultStatus'];
export function windowFilters(query: DirectoryQuery) {
    const params = new URLSearchParams();
    for (const key of WINDOW_KEYS) if (first(query, key)) params.set(key, first(query, key));
    if (query.q) params.set('q', query.q);
    return params.toString();
}

/**
 * The window's matches: one `period=ALL` request of up to 100 a page, at most two pages (the backend sorts it newest
 * first and leaves undated matches out). Sorted by kick-off here. Shared for 20 seconds, below the list's refresh.
 * `truncated` says more were there than were read: the counts are then not to be trusted.
 */
export function loadWindow(sessionId: AuthSessionId, filters: string, today: string): Promise<MatchdayWindow> {
    const { from, to, days } = windowRange(today);
    return shared(`matchday:${sessionId}:${from}:${filters}`, async () => {
        const rows = [];
        let total = 0, page = 0;
        do {
            const result = await getMatchHistory(`period=ALL&from=${from}&to=${to}&size=${WINDOW_PAGE}&page=${page}${filters ? `&${filters}` : ''}`, detached(), sessionId);
            rows.push(...result.items);
            total = result.total;
            page += 1;
        } while (rows.length < total && page < WINDOW_PAGES);
        // A drawer opened from the strip's lists shows at once what they showed.
        rememberMatches(sessionId, rows);
        const items = toFixtures(rows, await loadMyTeams(sessionId), false).filter(f => f.day).sort((a, b) => Date.parse(a.m.startsAt!) - Date.parse(b.m.startsAt!));
        return { from, to, days, items, counts: bucketDays(items, days), truncated: rows.length < total };
    }, 20_000);
}

/** A day as a heading: "Tuesday 13 October". */
export const longDay = (day: string, locale: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
/** A day as the strip shows it: "Tue" and "13". */
export const stripDay = (day: string, locale: string) => {
    const date = new Date(`${day}T12:00:00Z`);
    return { weekday: date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }), date: date.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' }) };
};
