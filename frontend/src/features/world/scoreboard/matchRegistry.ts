import type { AuthSessionId } from '../../../utils/authStorage';
import type { HistoryMatch } from '../../matchHistory/api';
import { matchCode } from './matchCode';

/**
 * The matches lists have loaded, by session and code, so a match drawer opens at once with what the list showed (a club
 * fixture or a tournament fixture has no detail endpoint of its own). Kept for the visit and only for the session that
 * loaded them; a later load replaces a row. The drawer only reads: the match page is where a match changes.
 */
const known = new Map<string, HistoryMatch>();
const keyOf = (sessionId: AuthSessionId, code: string) => `${sessionId}|${code}`;

export function rememberMatches(sessionId: AuthSessionId, items: HistoryMatch[]) {
    for (const match of items) known.set(keyOf(sessionId, matchCode(match)), match);
}

/** A remembered row. */
export const rememberedMatch = (sessionId: AuthSessionId, code: string) => known.get(keyOf(sessionId, code));

/** When a remembered row kicks off: where to look for it again. */
export const rememberedStart = (sessionId: AuthSessionId, code: string) => known.get(keyOf(sessionId, code))?.startsAt ?? null;
