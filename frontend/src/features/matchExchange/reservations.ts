import { label, post, type ChangeImpact, type Match } from './api';

/** A pitch reservation a match can use, as `GET /match-arrangements/bookings` returns it, with the matches already on it. */
export interface MatchReservation {
    id: number; venueId: number; venueName: string; pitchId: number; pitchName: string; format: string;
    startsAt: string; endsAt: string; timezone: string; totalPrice: number; currency: string; status: string;
    /** The club its booker shared it with, whose match staff may use it. */ allocatedClubId: number | null;
    /** The viewer booked it, so may share it with their own club's staff. */ canAllocate: boolean;
    city: string; addressText: string; latitude: number | null; longitude: number | null;
    allocations: { eventId?: number; startsAt: string; endsAt: string }[];
}

/** Uses a reservation at the match's own ground (either side that arranges the match). */
export const linkReservation = (m: Pick<Match, 'event_id' | 'revision'>, bookingId: number) =>
    post(`/match-exchange/${m.event_id}/venue`, { bookingId, externalConfirmed: false, revision: m.revision });
/** What moving the match to a reservation's ground changes, and who must be told (the host only). */
export const previewGround = (m: Pick<Match, 'event_id' | 'revision'>, bookingId: number, requestId: string) =>
    post(`/match-arrangements/${m.event_id}/ground-preview`, { bookingId, revision: m.revision, requestId }) as Promise<ChangeImpact>;
/** Moves the match to the reservation's ground, with the token from its preview. */
export const moveGround = (m: Pick<Match, 'event_id' | 'revision'>, bookingId: number, requestId: string, token?: string) =>
    post(`/match-arrangements/${m.event_id}/ground`, { bookingId, revision: m.revision, requestId }, token);
/** Shares a reservation the viewer booked with their own club's match staff (never with another club). */
export const shareReservation = (bookingId: number, clubId: number) => post(`/match-arrangements/bookings/${bookingId}/allocate`, { clubId });

/** Why a reservation cannot hold this match, in words; empty when it can. */
export function reservationIssue(reservation: Pick<MatchReservation, 'status' | 'format' | 'startsAt' | 'endsAt' | 'allocations'>, m: Pick<Match, 'event_id' | 'format' | 'starts_at_iso' | 'ends_at_iso'>) {
    if (reservation.status === 'PENDING') return 'Waiting for the venue to confirm';
    if (reservation.status !== 'CONFIRMED') return label(reservation.status);
    if (reservation.format !== 'OTHER' && m.format !== 'OTHER' && reservation.format !== m.format) return 'A different playing format';
    const start = Date.parse(m.starts_at_iso), end = Date.parse(m.ends_at_iso);
    if (Date.parse(reservation.startsAt) > start || Date.parse(reservation.endsAt) < end) return 'Does not cover the whole match';
    if (reservation.allocations.some(other => other.eventId !== m.event_id && Date.parse(other.startsAt) < end && Date.parse(other.endsAt) > start)) return 'Already used by an overlapping match';
    return '';
}
