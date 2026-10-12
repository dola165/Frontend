import type { AuthSessionId } from '../../../../utils/authStorage';
import type { Match } from '../../../matchExchange/api';
import { getMatchResult, type MatchResultState } from '../../../matchExchange/api';
import { mySquads } from '../../../matchExchange/arrange/api';
import { fetchMatchListings } from '../../api';
import { shared, detached } from '../../cache';
import type { ResultGroup } from '../../directory/groups';
import { listingDetail } from '../../front/coach/coachMatches';
import { laneOf, trackOf, type Lane, type LanePlace, type TrackDot } from '../../scoreboard/lanes';
import { listingCode } from '../../scoreboard/matchCode';

/** One of my arrangements: the listing, its code, its lane (and what it waits for) and its track. */
export interface Arrangement { m: Match; code: string; lane: Lane; wait?: LanePlace['wait']; track: TrackDot[]; mine: { home: boolean; away: boolean } }

const PAGES = 5, DETAILS = 8, RESULTS = 4;

/**
 * Every listing I am part of (the backend lists them oldest first, 24 a page, and no other way): read to the end,
 * at most five pages.
 */
export async function loadAllMine(filters: string) {
    const items: Match[] = [];
    let total = 0, page = 0;
    do {
        const result = await fetchMatchListings(new URLSearchParams(`mine=true&page=${page}${filters ? `&${filters}` : ''}`), detached());
        items.push(...result.items);
        total = result.total;
        page += 1;
    } while (items.length < total && page < PAGES);
    return items;
}

/**
 * My arrangements in their lanes. Who I am in each comes from my clubs (the squads I may arrange for). The offers on
 * my open listings, and my own offer on others', are only on a listing's detail: up to eight are read (not for a
 * listing sent to one club, which has none). Whose turn a proposed score is, only its result says: up to four are read.
 * Shared for 20 seconds, so the tab's count and the list ask once.
 */
export const loadMyArrangements = (sessionId: AuthSessionId, filters: string, now = Date.now()) => shared(`arrangements:${sessionId}:${filters}`, async () => {
    const [items, squads] = await Promise.all([loadAllMine(filters), mySquads(detached()).catch(() => [])]);
    const clubIds = new Set(squads.map(squad => squad.club_id));
    const open = items.filter(m => m.listing_status === 'OPEN' && Date.parse(m.starts_at_iso) > now && m.requested_club_id == null);
    const proposed = items.filter(m => m.result_status === 'PROPOSED' && Date.parse(m.ends_at_iso) <= now);
    const [read, results] = await Promise.all([
        Promise.allSettled(open.slice(0, DETAILS).map(m => listingDetail(sessionId, m.event_id))),
        Promise.allSettled(proposed.slice(0, RESULTS).map(m => getMatchResult(m.event_id, detached(), sessionId))),
    ]);
    const details = new Map(read.flatMap(result => result.status === 'fulfilled' ? [[result.value.event_id, result.value] as const] : []));
    const scores = new Map(results.flatMap((result): [number, MatchResultState][] => result.status === 'fulfilled' ? [[result.value.eventId, result.value]] : []));
    const order: Record<Lane, number> = { needs: 0, waiting: 1, coming: 2, played: 3 };
    return items.flatMap((m): Arrangement[] => {
        const result = scores.get(m.event_id);
        const place = laneOf(m, { clubIds, detail: details.get(m.event_id), result, now });
        if (!place) return [];
        return [{ m, code: listingCode(m.event_id), lane: place.lane, wait: place.wait, track: trackOf(m, { clubIds, now, confirmable: Boolean(result?.authority.confirmableRoles.length) }),
            mine: { home: clubIds.has(m.club_id), away: m.opponent_club_id != null && clubIds.has(m.opponent_club_id) } }];
    }).sort((a, b) => order[a.lane] - order[b.lane] || (a.lane === 'played' ? Date.parse(b.m.starts_at_iso) - Date.parse(a.m.starts_at_iso) : Date.parse(a.m.starts_at_iso) - Date.parse(b.m.starts_at_iso)));
}, 20_000);

/** The lanes, always shown in this order; an empty one says so in a line. */
export const LANES: Record<Lane, ResultGroup> = {
    needs: { key: 'needs', label: 'Needs you', rank: 0, empty: 'Nothing needs you' },
    waiting: { key: 'waiting', label: 'Waiting on them', rank: 1, empty: 'Nothing waiting on them' },
    coming: { key: 'coming', label: 'Coming up', rank: 2, empty: 'Nothing coming up' },
    played: { key: 'played', label: 'Played', rank: 3, empty: 'Nothing played yet' },
};

/** Over the map, by where each is played from my side: at home, away, on neutral ground, or still to agree. */
export function hostingGroup(a: Arrangement): ResultGroup {
    const choice = a.m.hosting_choice ?? a.m.venue_preference;
    const mineHosts = a.mine.home;
    const where = choice === 'HOME' ? (mineHosts ? 'home' : 'away') : choice === 'AWAY' ? (mineHosts ? 'away' : 'home') : choice === 'NEUTRAL' ? 'neutral' : 'open';
    return { home: { key: 'home', label: 'At home', rank: 0 }, away: { key: 'away', label: 'Away', rank: 1 }, neutral: { key: 'neutral', label: 'Neutral ground', rank: 2 }, open: { key: 'open', label: 'To be agreed', rank: 3 } }[where];
}
