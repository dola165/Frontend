import type { HistoryMatch } from '../../../matchHistory/api';
import type { wt } from '../../copy';

/** One day of a squad's next two weeks: its matches, and whether the rest before it is short. */
export interface LoadDay { date: string; matches: HistoryMatch[]; tight: boolean; restDays: number | null }

const HOUR = 3_600_000;
const dayKey = (value: number, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
const at = (match: HistoryMatch) => Date.parse(match.startsAt!);

/**
 * The match rest is counted from: the newest one that has kicked off and was not cancelled. Match history also
 * returns cancelled fixtures (future ones too), which nobody played.
 */
export const lastPlayedOf = (recent: HistoryMatch[], now = Date.now()) =>
    recent.find(match => match.startsAt && at(match) <= now && match.fixtureStatus !== 'CANCELLED') ?? null;

/** Matches with too little rest before them: under 72 hours after the last, or a third match within seven days. */
export function tightMatches(sorted: HistoryMatch[]): HistoryMatch[] {
    return sorted.filter((match, index) => {
        const previous = sorted[index - 1], twoBefore = sorted[index - 2];
        return (previous && at(match) - at(previous) < 72 * HOUR) || (twoBefore && at(match) - at(twoBefore) < 7 * 24 * HOUR);
    });
}

/**
 * Whole days of rest before each coming match, counted from the match before it (the last one played, for the
 * first), and whether that rest is short by the rule above.
 */
export function restBefore(upcoming: HistoryMatch[], lastPlayed?: HistoryMatch | null) {
    const ahead = upcoming.filter(match => match.startsAt && match.fixtureStatus !== 'CANCELLED' && match.id !== lastPlayed?.id);
    const sorted = [...(lastPlayed?.startsAt ? [lastPlayed] : []), ...ahead].sort((a, b) => at(a) - at(b));
    const tight = new Set(tightMatches(sorted).map(match => match.id));
    return new Map(sorted.slice(1).map((match, index) => [match.id, { days: Math.floor((at(match) - at(sorted[index])) / (24 * HOUR)), tight: tight.has(match.id) }]));
}

/**
 * A squad's match load over the coming days, today first. Rest is counted from the last match played, so the
 * strip, its notes and each match's rest all come from the same list.
 */
export function loadDays(upcoming: HistoryMatch[], { now = Date.now(), days = 14, timeZone = 'Asia/Tbilisi', lastPlayed }: { now?: number; days?: number; timeZone?: string; lastPlayed?: HistoryMatch | null } = {}): LoadDay[] {
    const ahead = upcoming.filter(match => match.startsAt && match.fixtureStatus !== 'CANCELLED' && at(match) >= now - 12 * HOUR && match.id !== lastPlayed?.id);
    const rest = restBefore(ahead, lastPlayed);
    return Array.from({ length: days }, (_, index) => {
        const date = dayKey(now + index * 24 * HOUR, timeZone);
        const today = ahead.filter(match => dayKey(at(match), timeZone) === date).sort((a, b) => at(a) - at(b));
        return { date, matches: today, tight: today.some(match => rest.get(match.id)?.tight), restDays: today[0] ? rest.get(today[0].id)?.days ?? null : null };
    });
}

/** "Same day", "1 day’s rest", "3 days’ rest". */
export const restLabel = (days: number, t: typeof wt) => days === 0 ? t('Same day') : days === 1 ? t('1 day’s rest') : t('{days} days’ rest', { days });
