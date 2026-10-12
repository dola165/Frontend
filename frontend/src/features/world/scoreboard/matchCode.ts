import type { HistoryMatch, HistorySource } from '../../matchHistory/api';

/**
 * One short code per match, used as its list key, its choice on the map (`selected=`) and its drawer (`peek=match-…`):
 * `x<event>` an arranged match, `s<event>` a club fixture, `t<tournament>.<fixture>` a tournament fixture. It is built
 * from the source and its id, never from `HistoryMatch.id` (the backend and the sandbox spell that differently, and
 * event and fixture numbers come from different tables).
 */
const PREFIX: Record<HistorySource, string> = { MATCH_EXCHANGE: 'x', SCHEDULE: 's', TOURNAMENT: 't' };

export const matchCode = (match: Pick<HistoryMatch, 'source' | 'sourceId' | 'tournamentId'>) =>
    match.source === 'TOURNAMENT' ? `t${match.tournamentId ?? 0}.${match.sourceId}` : `${PREFIX[match.source]}${match.sourceId}`;

/** An arranged match or an open listing, by its event id. */
export const listingCode = (eventId: number) => `x${eventId}`;

export interface ParsedCode { source: HistorySource; id: number; tournamentId?: number }

/** A code back into its source and ids, or null when it is not one. */
export function parseMatchCode(code: string): ParsedCode | null {
    const found = /^([xst])([1-9]\d*)(?:\.([1-9]\d*))?$/.exec(code);
    if (!found) return null;
    const [, kind, first, second] = found;
    if (kind === 't') return second ? { source: 'TOURNAMENT', id: Number(second), tournamentId: Number(first) } : null;
    if (second) return null;
    return { source: kind === 'x' ? 'MATCH_EXCHANGE' : 'SCHEDULE', id: Number(first) };
}

/** The match's full page (the backend points arranged matches at their result section). */
export const matchPagePath = (match: Pick<HistoryMatch, 'detailPath'>) => match.detailPath.replace(/#result$/, '');
