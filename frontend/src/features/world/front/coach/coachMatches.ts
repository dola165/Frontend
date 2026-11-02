import type { AuthSessionId } from '../../../../utils/authStorage';
import { getMatchHistory } from '../../../matchHistory/api';
import { get as exchangeGet, type Match } from '../../../matchExchange/api';
import { shared, detached } from '../../cache';
import { zoned } from '../../scoreboard/standings';

/** Shared requests outlive the field that started them, so they carry no field's abort signal. */
type Period = 'UPCOMING' | 'HISTORY';

/** Match history for a squad, a club or a competition, shared by every field that needs it for a minute. */
export function historyOf(sessionId: AuthSessionId, scope: { squadId?: number | null; clubId?: number | null; tournamentId?: number | null }, period: Period, size = 20) {
    const query = new URLSearchParams({ period, page: '0', size: String(size) });
    for (const [key, value] of Object.entries(scope)) if (value != null) query.set(key, String(value));
    // Club fixtures and tournament matches come as the venue's wall clock without a zone; friendlies in UTC.
    return shared(`history:${sessionId}:${query}`, () => getMatchHistory(query.toString(), detached(), sessionId)
        .then(page => page.items.map(match => ({ ...match, startsAt: zoned(match.startsAt), endsAt: zoned(match.endsAt) }))));
}

/** One listing in full (with the offers on it), shared for a minute. */
export const listingDetail = (sessionId: AuthSessionId, id: number) =>
    shared(`listing:${sessionId}:${id}`, () => exchangeGet<Match>(`/match-exchange/${id}`, undefined, detached()));
