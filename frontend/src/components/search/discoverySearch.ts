import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';
import { eventSearch, eventDestination, type EventItem } from '../../features/requests/api';

export interface PersonResult { type: 'user'; id: number; fullName: string; username: string; avatarUrl: string | null; position: string | null }
export interface ClubResult { type: 'club'; id: number; name: string; logoUrl: string | null; memberCount: number; city: string | null }
export interface TournamentResult { type: 'tournament'; id: number; name: string; description: string | null }
export type EventResult = EventItem & { type: 'event' };
export interface PlaceResult { type: 'organization' | 'venue'; id: number; name: string; location: string | null; profileKind: string; venueCount: number; fromPrice: number | null; currency: string | null; bookingMode: string | null }
export type SearchResult = PersonResult | ClubResult | TournamentResult | PlaceResult | EventResult;
export type SearchKind = 'ALL' | 'ORGANIZATION' | 'VENUE' | 'EVENT';
export type SearchActivity = 'ALL' | 'VENUE' | 'TOURNAMENT';
export interface SearchResponse { results: SearchResult[]; failed: boolean; partial: boolean; more: boolean }
interface DiscoveryResponse { organizations: Omit<PlaceResult, 'type'>[]; venues: Omit<PlaceResult, 'type'>[]; moreOrganizations: boolean; moreVenues: boolean }

export const resultName = (result: SearchResult) => result.type === 'user' ? result.fullName || result.username : result.name;
export function resultLink(result: SearchResult) {
    switch (result.type) {
        case 'user': return `/profile/${result.id}`;
        case 'club': return `/clubs/${result.id}`;
        case 'organization': return `/organizations/${result.id}`;
        case 'venue': return `/stadiums/${result.id}`;
        case 'tournament': return `/tournaments/${result.id}`;
        case 'event': return eventDestination(result) ?? '/events';
    }
}

export async function searchDirectory(query: string, kind: SearchKind, location: string, activity: SearchActivity,
    signedIn: boolean, sessionId: AuthSessionId, signal: AbortSignal): Promise<SearchResponse> {
    const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
    const sources: Promise<SearchResult[]>[] = [];
    let more = false;
    if (kind === 'ALL') {
        sources.push(apiClient.get<{ content: Omit<PersonResult, 'type'>[] }>('/users/search', { ...config, params: { query, page: 0, size: 5 } })
            .then(r => (r.data.content ?? []).map(u => ({ ...u, type: 'user' as const }))));
        sources.push(apiClient.get<Omit<ClubResult, 'type'>[]>('/clubs/search', { ...config, params: { q: query, limit: 5 } })
            .then(r => r.data.map(c => ({ ...c, type: 'club' as const }))));
    }
    if (kind === 'ALL' || kind === 'EVENT') sources.push(eventSearch({ q: query, location: kind === 'EVENT' ? location : undefined, page: 0, size: 5 }, sessionId, signal)
        .then(r => { more ||= r.hasMore; return r.items.map(item => ({ ...item, type: 'event' as const })); }));
    // Organization profile routes already require sign-in. Keep that boundary intact.
    if (signedIn && kind !== 'EVENT') sources.push(apiClient.get<DiscoveryResponse>('/organizations/discovery', {
        ...config, params: { q: query, kind, location: kind === 'ALL' ? undefined : location || undefined, activity, limit: 5 },
    }).then(r => {
        more ||= r.data.moreOrganizations || r.data.moreVenues;
        return [...r.data.organizations.map(o => ({ ...o, type: 'organization' as const })), ...r.data.venues.map(v => ({ ...v, type: 'venue' as const }))];
    }));
    const responses = await Promise.allSettled(sources);
    const results = responses.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const key = query.toLocaleLowerCase();
    const rank = (r: SearchResult) => resultName(r).toLocaleLowerCase() === key ? 0 : resultName(r).toLocaleLowerCase().startsWith(key) ? 1 : 2;
    results.sort((a, b) => rank(a) - rank(b));
    const failedCount = responses.filter(r => r.status === 'rejected').length;
    return { results, failed: failedCount === responses.length, partial: failedCount > 0 && failedCount < responses.length, more };
}
