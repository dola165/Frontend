import { useSyncExternalStore } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import type { AuthSessionId } from '../../../../utils/authStorage';
import type { Match } from '../../../matchExchange/api';
import { fetchMatchListings } from '../../api';
import { forget, shared } from '../../cache';
import { hasStarted, hoursUntil } from '../../format';
import { listingDetail } from '../../front/coach/coachMatches';
import { useSquadFocus } from '../../front/coach/mySquads';
import { useWorldRole } from '../../front/useWorldRole';
import { useWorldData } from '../../useWorldData';

/** Referee seats still to fill (an invited referee has not answered yet, or one withdrew). */
export const OPEN_SEAT = new Set(['NEEDED', 'INVITED', 'REPLACEMENT_NEEDED']);
const SETTLED_DAYS = 14;

// Seats change when someone is invited from a peek; the Dugout then asks again.
let revision = 0;
const listeners = new Set<() => void>();
/** Something changed the coach's referee seats: forget what was loaded and ask again. */
export function seatsChanged(sessionId: AuthSessionId, eventId: number) {
    forget(`listing:${sessionId}:${eventId}`);
    forget(`my-seats:${sessionId}`);
    revision += 1;
    listeners.forEach(listener => listener());
}
const useSeatsRevision = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => revision);

/** Yesterday in the browser's calendar: the server compares `from` with the match's own local date, so a browser ahead of
 * the match's time zone would otherwise drop tonight's matches. Matches that have started are dropped here. */
const yesterday = () => {
    const day = new Date(Date.now() - 86_400_000);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};
const PAGES = 4;
/** This person's listings from a day on, every page up to four (96 rows), and whether that was all of them. */
async function myListings(from: string) {
    const items: Match[] = [];
    for (let page = 0; page < PAGES; page++) {
        const result = await fetchMatchListings(new URLSearchParams({ mine: 'true', from, page: String(page) }));
        items.push(...result.items);
        if (!result.items.length || (page + 1) * (result.pageSize ?? 24) >= result.total) return { items, complete: true };
    }
    return { items, complete: false };
}

export interface Seat { match: Match; /** The referee duty's appointment, once the match's details have loaded. */ referee?: { id: number; name: string; status: string } }

/**
 * The coach's coming match days that need a referee: open seats first (soonest first), then seats already settled in
 * the next two weeks. Only listings this person can arrange officials for, not yet started. Each seat's referee comes
 * from the match's details (list rows do not carry them).
 */
export function useSeats() {
    const { status, sessionId } = useAuth();
    const role = useWorldRole();
    const focus = useSquadFocus(role);
    const changed = useSeatsRevision();
    const from = yesterday();
    const key = status === 'authenticated' ? `my-seats:${sessionId}:${from}:${changed}` : null;
    // After an invitation the seats are asked for again; the last answer stays on screen meanwhile, so nothing jumps.
    const listings = useWorldData(key, () => shared(key!, () => myListings(from)), undefined, { keep: true });
    // Your own squads' match days: the host's staff arrange the referee, or the guest's when the match says so.
    const mine = (id?: number | null) => focus.focus.some(squad => squad.id === id);
    const ours = (match: Match) => match.can_arrange_official !== false && mine(match.referee_responsibility === 'OPPONENT' ? match.target_squad_id : match.squad_id);
    const soon = (match: Match) => (hoursUntil(match.starts_at_iso) ?? Infinity) < SETTLED_DAYS * 24;
    const seats = (listings.data?.items ?? [])
        .filter(match => match.referee_required && !hasStarted(match.starts_at_iso) && match.event_status !== 'CANCELLED' && ours(match)
            && (OPEN_SEAT.has(match.referee_status) || (match.referee_status === 'ACCEPTED' && soon(match))))
        .sort((a, b) => Number(OPEN_SEAT.has(b.referee_status)) - Number(OPEN_SEAT.has(a.referee_status)) || Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
    const ids = seats.map(match => match.event_id);
    const details = useWorldData(ids.length && key ? `seat-details:${key}:${ids.join(',')}` : null,
        () => Promise.all(ids.map(id => listingDetail(sessionId, id).catch(() => null))), undefined, { keep: true });
    const detailOf = new Map((details.data ?? []).flatMap(item => item ? [[item.event_id, item] as const] : []));
    const withReferees: Seat[] = seats.map(match => {
        const live = detailOf.get(match.event_id)?.appointments?.find(item => item.duty === 'REFEREE' && ['INVITED', 'ACCEPTED'].includes(item.status));
        return { match, referee: live ? { id: live.referee_id, name: live.full_name ?? '', status: live.status } : undefined };
    });
    const coaching = focus.status === 'ready' && focus.squads.length > 0;
    return { seats: withReferees, open: seats.filter(match => OPEN_SEAT.has(match.referee_status) && match.referee_status !== 'INVITED').length,
        invited: seats.filter(match => match.referee_status === 'INVITED').length, complete: listings.data?.complete ?? false,
        shown: coaching || seats.length > 0, loading: listings.loading && !listings.data, error: listings.error, retry: listings.retry };
}
