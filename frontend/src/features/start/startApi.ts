import { apiClient } from '../../api/axiosConfig';
import type { FootballRole } from '../roles/domain';
import { kmBetween, type Town } from './towns';

/** What a person chose to see; the feed ranks local posts on these topics first. */
export type Interest = 'CLUBS' | 'YOUTH' | 'MATCHES' | 'TOURNAMENTS' | 'WOMENS' | 'JOBS' | 'STORE';
/** What a person does in football. Sets what they see first, never what they may open. */
export type Activity = 'PLAY' | 'COACH' | 'PARENT' | 'WATCH';

export interface FeedPreferences {
    town: Town | null;
    topics: Interest[];
    activity: Activity | null;
    updatedAt?: string | null;
}

// Backend needed: GET/PUT /users/me/feed-preferences (BACKEND_NEEDS.md, "Sign-in and the start").
export const fetchFeedPreferences = async (signal?: AbortSignal) => (await apiClient.get<FeedPreferences>('/users/me/feed-preferences', { signal })).data;
export const saveFeedPreferences = async (changes: Partial<FeedPreferences>) => (await apiClient.put<FeedPreferences>('/users/me/feed-preferences', changes)).data;

export interface NearbyClub {
    id: number;
    name: string;
    logoUrl?: string | null;
    type?: string | null;
    cityName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isFollowedByMe?: boolean;
    km: number;
}

/** The clubs nearest a town, from the public directory, nearest first. Clubs without coordinates are left out. */
export async function fetchClubsNear(town: Town, limit = 6, signal?: AbortSignal): Promise<NearbyClub[]> {
    const response = await apiClient.get<NearbyClub[] | { content: NearbyClub[] }>('/clubs', { params: { page: 0, size: 200 }, signal });
    const clubs = Array.isArray(response.data) ? response.data : response.data.content ?? [];
    return clubs
        .filter(club => typeof club.latitude === 'number' && typeof club.longitude === 'number')
        .map(club => ({ ...club, km: Math.round(kmBetween(town, { latitude: club.latitude!, longitude: club.longitude! })) }))
        .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name))
        .slice(0, limit);
}

export const followClub = (id: number) => apiClient.post(`/clubs/${id}/follow`);
export const unfollowClub = (id: number) => apiClient.delete(`/clubs/${id}/follow`);

/** The football role the person named at the start, as their primary public role (changed any time on Account › Roles and work). */
export const saveFootballRole = (role: FootballRole) => apiClient.put('/users/me/roles', { profiles: [{ role, primary: true, published: true }] });
