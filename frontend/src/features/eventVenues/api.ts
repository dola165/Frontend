import { apiClient } from '../../api/axiosConfig';
import type { BookingDraft } from '../venues/api';
export interface EventVenueSourceRef { type: string; id: number; occurrenceStart?: string; timezone?: string; durationMinutes?: number }
export interface EventVenueSource { type: string; id: number; title: string; occurrenceKey: string; localStart: string | null; localEnd: string | null; timezone: string | null; startsAt: string | null; endsAt: string | null; canBook: boolean; returnPath: string }
export interface EventReservation { id: number; bookingId: number; venueId: number; venueName: string; pitchName: string; startsAt: string; endsAt: string; bookingStatus: string; state: 'LINKED' | 'RELEASED' | 'NEEDS_ATTENTION'; reason: string | null; canCancel: boolean; venuePhone: string | null; cancellationDeadline: string }
export interface EventVenueDetail { source: EventVenueSource; reservations: EventReservation[] }
export const fetchEventVenue = async (source: EventVenueSourceRef) => (await apiClient.get<EventVenueDetail>('/event-venues', { params: source })).data;
export const reserveEventVenue = async (source: EventVenueSourceRef, venueId: number, booking: BookingDraft) => (await apiClient.post<EventVenueDetail>('/event-venues/reserve', { source, venueId, booking })).data;
export const attachEventVenue = async (source: EventVenueSourceRef, bookingId: number) => (await apiClient.post<EventVenueDetail>('/event-venues/attach', { source, bookingId })).data;
export const cancelEventVenue = async (id: number, source: EventVenueSourceRef) => (await apiClient.post<EventVenueDetail>(`/event-venues/${id}/cancel`, source)).data;

export function coversEvent(startsAt: string, endsAt: string, source: EventVenueSource) {
    return !!source.startsAt && !!source.endsAt && Date.parse(startsAt) <= Date.parse(source.startsAt) && Date.parse(endsAt) >= Date.parse(source.endsAt);
}
