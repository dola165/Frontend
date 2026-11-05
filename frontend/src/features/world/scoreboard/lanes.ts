import type { Match } from '../../matchExchange/api';
import type { ScoreRecord } from '../../scores/api';
import { isOfficial } from '../../scores/status';
import { appLocale } from '../../../utils/formatting';
import type { Said, TagTone } from './matchState';

/** Where one of my arrangements stands: something needs me, I wait on them, it is coming up, it has been played. */
export type Lane = 'needs' | 'waiting' | 'coming' | 'played';
/**
 * What decides a lane: my clubs, the listing's detail when it was read (the offers on it), its result when it was read
 * (who may confirm a reported score or settle a disputed one), and the time.
 */
export interface LaneContext { clubIds: Set<number>; detail?: Match; result?: ScoreRecord; now: number }
/** What a lane item waits for: its words, its tone, and what kind of answer it asks of me (a reply, a choice of offers). */
export interface LanePlace { lane: Lane; wait?: Said & { tone: TagTone; ask?: 'reply' | 'choose' } }

const HOUR = 3_600_000;
/** Kick-off is within three days and still ahead (a match already started is never "soon"). */
const soon = (m: Match, now: number) => { const until = Date.parse(m.starts_at_iso) - now; return until >= 0 && until < 72 * HOUR; };
const cancelled = (m: Match) => m.event_status === 'CANCELLED' || m.listing_status === 'CANCELLED';
const dayOf = (m: Match) => new Date(m.starts_at_iso).toLocaleDateString(appLocale(), { weekday: 'short', timeZone: m.timezone || 'Asia/Tbilisi' });

/**
 * The lane of one arrangement, from my side. Never from the list's `can_*` flags (the backend sends those only on the
 * detail): who I am in it comes from my clubs. Null when it is not mine to see any more (an offer of mine that was
 * declined, a match agreed with another club, a listing that expired or closed without an opponent). Nothing is
 * claimed that was not read: an open listing whose offers were not looked at is only "open for offers", and a reported
 * score whose result was not read is only "to confirm".
 */
export function laneOf(m: Match, { clubIds, detail, result, now }: LaneContext): LanePlace | null {
    const host = clubIds.has(m.club_id), guest = m.opponent_club_id != null && clubIds.has(m.opponent_club_id);
    if (m.opponent_club_id != null && !host && !guest) return null;
    const invitedMe = m.requested_club_id != null && clubIds.has(m.requested_club_id) && !host;
    const past = Date.parse(m.ends_at_iso) <= now;
    if (cancelled(m)) return { lane: past ? 'played' : 'coming' };
    if (m.listing_status === 'EXPIRED' || m.listing_status === 'CLOSED') return m.opponent_club_id ? { lane: 'played' } : null;
    if (m.listing_status === 'ARRANGED' || m.opponent_club_id != null) {
        if (!past) return { lane: 'coming' };
        if (isOfficial(m.result_status)) return { lane: 'played' };
        // A dispute waits on its settler; a friendly with none keeps both versions, and nothing is left to do.
        if (m.result_status === 'DISPUTED') return !result ? { lane: 'needs', wait: { word: 'Result disputed', tone: 'danger' } }
            : result.permissions.settle.length ? { lane: 'needs', wait: { word: 'Settle score', tone: 'danger' } }
                : result.settler ? { lane: 'waiting', wait: { word: 'Result disputed', tone: 'neutral' } } : { lane: 'played' };
        if (m.result_status === 'REPORTED') return !result ? { lane: 'needs', wait: { word: 'Score to confirm', tone: 'warning' } }
            : result.permissions.respond.length ? { lane: 'needs', wait: { word: 'Confirm score', tone: 'warning' } }
                : { lane: 'waiting', wait: { word: 'Waiting for them to confirm', tone: 'neutral' } };
        return { lane: 'needs', wait: { word: 'Report score', tone: 'warning' } };
    }
    // Still open: an invitation to me, my own listing (with or without offers, or sent to one club), or my offer on theirs.
    if (invitedMe) return { lane: 'needs', wait: { word: 'Reply by {day}', vars: { day: dayOf(m) }, tone: soon(m, now) ? 'danger' : 'warning', ask: 'reply' } };
    if (host) {
        if (m.requested_club_id != null) return { lane: 'waiting', wait: { word: 'Waiting for their answer', tone: 'neutral' } };
        if (!detail) return { lane: 'waiting', wait: { word: 'Open for offers', tone: 'neutral' } };
        const offers = detail.proposals?.filter(offer => offer.status === 'PENDING').length ?? 0;
        return offers ? { lane: 'needs', wait: { word: '{count} offers to choose', vars: { count: offers }, tone: soon(m, now) ? 'danger' : 'warning', ask: 'choose' } }
            : { lane: 'waiting', wait: { word: 'Waiting for offers', tone: 'neutral' } };
    }
    if (guest) return { lane: 'coming' };
    const mine = detail?.proposals?.find(offer => clubIds.has(offer.club_id));
    if (mine?.status === 'DECLINED' || mine?.status === 'WITHDRAWN') return null;
    return { lane: 'waiting', wait: { word: 'Offer sent', tone: 'neutral' } };
}

/** One dot of an arrangement's track: done, mine to do, urgent, waiting on someone else, or not needed. */
export type DotState = 'done' | 'yours' | 'urgent' | 'waiting' | 'none';
export interface TrackDot { part: 'opponent' | 'ground' | 'referee' | 'result'; state: DotState; word: string }

/**
 * The four things a match needs, in order: an opponent, a ground, a referee, a result. Each dot is done, mine to do
 * (amber), urgent (red, within three days of kick-off or a disputed result), waiting on the other side, or not needed.
 * Once kicked off, what was not arranged can no longer be (a dash). A cancelled match needs nothing, so it has no
 * track (its time says "Canc."). A reported score is mine to confirm only when its result says so (`confirmable`).
 */
export function trackOf(m: Match, { clubIds, now, confirmable }: Pick<LaneContext, 'clubIds' | 'now'> & { confirmable?: boolean }): TrackDot[] {
    if (cancelled(m)) return [];
    const host = clubIds.has(m.club_id), guest = m.opponent_club_id != null && clubIds.has(m.opponent_club_id);
    const close = soon(m, now), started = Date.parse(m.starts_at_iso) <= now, past = Date.parse(m.ends_at_iso) <= now;
    const todo = (mineToDo: boolean): DotState => started ? 'none' : close ? 'urgent' : mineToDo ? 'yours' : 'waiting';
    const opponent: TrackDot = m.opponent_club_id != null ? { part: 'opponent', state: 'done', word: 'Opponent agreed' }
        : { part: 'opponent', state: todo(host || (m.requested_club_id != null && clubIds.has(m.requested_club_id))), word: 'Opponent to find' };
    const ground: TrackDot = m.venue_status === 'BOOKED' ? { part: 'ground', state: 'done', word: 'Ground booked' }
        : m.venue_status === 'HOST_CONFIRMED' ? { part: 'ground', state: 'done', word: 'Ground confirmed' }
            : { part: 'ground', state: todo(host), word: m.location_name ? 'Ground not booked yet' : 'Ground to arrange' };
    // Who arranges the referee: the host, unless the match says the opponent does.
    const ours = (m.referee_responsibility ?? 'HOST') === 'OPPONENT' ? guest : host;
    const referee: TrackDot = !m.referee_required || m.referee_status === 'NOT_REQUIRED' ? { part: 'referee', state: 'none', word: 'No referee needed' }
        : m.referee_status === 'ACCEPTED' ? { part: 'referee', state: 'done', word: 'Referee confirmed' }
            : m.referee_status === 'INVITED' ? { part: 'referee', state: started ? 'none' : close ? 'urgent' : 'waiting', word: 'Referee invited' }
                : { part: 'referee', state: todo(ours), word: 'Referee needed' };
    const result: TrackDot = !past ? { part: 'result', state: 'none', word: 'Result after the match' }
        : isOfficial(m.result_status) ? { part: 'result', state: 'done', word: 'Result confirmed' }
            : m.result_status === 'DISPUTED' ? { part: 'result', state: 'urgent', word: 'Result disputed' }
                : m.result_status === 'REPORTED' ? { part: 'result', state: confirmable ? 'yours' : 'waiting', word: 'Score to confirm' }
                    : { part: 'result', state: host || guest ? 'yours' : 'waiting', word: 'Result to add' };
    return [opponent, ground, referee, result];
}
