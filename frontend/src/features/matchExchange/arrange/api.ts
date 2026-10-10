import { apiClient } from '../../../api/axiosConfig';
import type { ClubSearchResult } from '../../tournaments/domain';
import type { PublicFacility } from '../../clubs/ClubPlaceCard';
import { placeType } from '../../clubs/clubPlaceTypes';
import type { PublicSquad } from '../../clubs/publicJourney';
import type { Venue } from '../../venues/api';
import type { SquadSpace } from '../../squadCommunication/api';
import type { Match, Squad } from '../api';

/** A ground the form can offer: a club's own or regular venue, or any venue on GrassKickZ. */
export interface Ground { key: string; venueId: number | null; name: string; city: string; detail: string; latitude: number | null; longitude: number | null; timezone?: string }

const timeout = 15000;
export const searchClubs = async (q: string, signal: AbortSignal) =>
    (await apiClient.get<ClubSearchResult[]>('/clubs/search', { params: { q, limit: 8 }, signal, timeout })).data;
export const clubSquads = async (clubId: number, signal: AbortSignal) =>
    (await apiClient.get<PublicSquad[]>(`/clubs/${clubId}/squads`, { signal, timeout })).data;
export const clubProfile = async (clubId: number, signal: AbortSignal) =>
    (await apiClient.get<{ id: number; name: string; logoUrl?: string | null; cityName?: string | null }>(`/clubs/${clubId}`, { signal, timeout })).data;
export const mySquads = async (signal: AbortSignal) => (await apiClient.get<Squad[]>('/match-exchange/squads', { signal, timeout })).data;
/** Squads the person works with day to day (squad spaces they manage). Used only to prefill. */
export const coachedSquadIds = async (signal: AbortSignal) =>
    (await apiClient.get<SquadSpace[]>('/squad-communication', { signal, timeout })).data.filter(space => space.can_manage).map(space => space.id);

const relationship: Record<string, string> = { OWNED: 'Club-owned', RENTED: 'Club’s regular ground', SHARED: 'Shared use', REGULAR_USE: 'Regular ground' };
/** A club's playing venues from its published places (venue relationships and training grounds). */
export async function clubGrounds(clubId: number, signal: AbortSignal): Promise<Ground[]> {
    const places = (await apiClient.get<PublicFacility[]>(`/clubs/${clubId}/facilities`, { signal, timeout })).data;
    const seen = new Set<string>();
    return places.filter(place => placeType(place) === 'VENUE').flatMap(place => {
        const venueId = place.linkedVenue?.id ?? (Number(place.details.venueId) || null);
        const key = venueId ? `venue:${venueId}` : `place:${place.id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const latitude = Number(place.details.latitude), longitude = Number(place.details.longitude);
        const city = place.linkedVenue?.city ?? place.details.address?.split(',').pop()?.trim() ?? '';
        return [{ key, venueId, name: place.title || place.linkedVenue?.name || 'Club ground', city,
            detail: [relationship[place.details.relationship], place.squadName, place.details.address || place.linkedVenue?.address].filter(Boolean).join(' · '),
            latitude: Number.isFinite(latitude) && place.details.latitude ? latitude : null, longitude: Number.isFinite(longitude) && place.details.longitude ? longitude : null }];
    });
}
export async function searchVenues(q: string, signal: AbortSignal): Promise<Ground[]> {
    const page = (await apiClient.get<{ content: Venue[] }>('/venues', { params: { q, size: 8 }, signal, timeout })).data;
    return page.content.map(venue => ({ key: `venue:${venue.id}`, venueId: venue.id, name: venue.displayName, city: venue.city, detail: venue.addressText,
        latitude: venue.latitude, longitude: venue.longitude, timezone: venue.timezone }));
}

/** The match terms both the direct invitation and the open listing send (the listing contract). */
export interface MatchTerms {
    squadId: number; title: string; description: string; startsAt: string; endsAt: string; timezone: string;
    city: string; locationName: string; latitude: number | null; longitude: number | null;
    ageGroup: string; level: string; format: string; venuePreference: 'HOME' | 'AWAY' | 'EITHER'; refereeRequired: boolean; venueId: number | null;
    requestId: string; revision: number;
}
export type OfficialMode = 'LATER' | 'EXTERNAL' | 'NONE';
export interface Arrangement {
    match: MatchTerms; targetClubId: number | null; targetSquadId: number | null; bookingId: null;
    matchType: 'FRIENDLY' | 'COMPETITIVE'; hostingChoice: 'HOME' | 'AWAY' | 'NEUTRAL' | 'FLEXIBLE';
    officialMode: OfficialMode; officialResponsibility: 'HOST' | 'OPPONENT'; refereeId: null; externalRefereeName: string | null;
    volunteer: boolean; fee: number; currency: string;
}
/** Sends a direct invitation (with `targetClubId`) or publishes an open listing (without). */
export const createArrangement = async (body: Arrangement) => (await apiClient.post<Match>('/match-arrangements', body, { timeout: 30000 })).data;
/** Revises a listing's terms. A material change answers 409 with the impact to confirm via `X-Match-Impact-Token`. */
export const updateListing = async (eventId: number, terms: MatchTerms, impactToken?: string) =>
    (await apiClient.put<Match>(`/match-exchange/${eventId}`, terms, { timeout: 30000, headers: impactToken ? { 'X-Match-Impact-Token': impactToken } : {} })).data;
