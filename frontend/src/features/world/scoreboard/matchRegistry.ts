import type { AuthSessionId } from '../../../utils/authStorage';
import type { HistoryMatch } from '../../matchHistory/api';
import { matchCode } from './matchCode';

/**
 * The matches lists have loaded, by session and code, so a match drawer opens at once with what the list showed (a club
 * fixture or a tournament fixture has no detail endpoint of its own). Kept for the visit and only for the session that
 * loaded them; a later load replaces a row, and a row is doubted once something done in a drawer may have changed it.
 */
const known = new Map<string, { match: HistoryMatch; doubted: boolean }>();
const keyOf = (sessionId: AuthSessionId, code: string) => `${sessionId}|${code}`;

export function rememberMatches(sessionId: AuthSessionId, items: HistoryMatch[]) {
    for (const match of items) known.set(keyOf(sessionId, matchCode(match)), { match, doubted: false });
}

/** A remembered row, unless something done since (a result saved in the drawer) may have changed it. */
export function rememberedMatch(sessionId: AuthSessionId, code: string) {
    const entry = known.get(keyOf(sessionId, code));
    return entry && !entry.doubted ? entry.match : undefined;
}

/** When a remembered row kicks off, doubted or not: where to look for it again. */
export const rememberedStart = (sessionId: AuthSessionId, code: string) => known.get(keyOf(sessionId, code))?.match.startsAt ?? null;

/** Something done to this match may have changed it: the drawer reads it again rather than trusting the list's row. */
export function doubtMatch(sessionId: AuthSessionId, code: string) {
    const entry = known.get(keyOf(sessionId, code));
    if (entry) entry.doubted = true;
}
