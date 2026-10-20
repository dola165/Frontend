import { apiClient } from '../../api/axiosConfig';
import { loadPreferences, readPreferences, updatePreferences, type StartPreferences } from '../preferences/preferencesStore';
import { kmBetween, townByName, type Town } from './towns';

const abortable = <T,>(work: Promise<T>, signal?: AbortSignal) => signal
    ? Promise.race([work, new Promise<never>((_, reject) => {
        if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })])
    : work;

/** The first-run section of the person's preferences (GET /users/me/preferences). */
export const fetchStart = async (userId: number, signal?: AbortSignal): Promise<StartPreferences> =>
    (await abortable(loadPreferences(userId), signal)).start ?? {};
/** The town Home, World and a new page start from, when the person gave one. */
export const fetchSavedTown = async (userId: number, signal?: AbortSignal): Promise<Town | null> => {
    const town = (await fetchStart(userId, signal)).town;
    return town ? townByName(town.name) ?? town : null;
};
/**
 * Changes part of the first-run section and keeps the rest; resolves once the server holds it. The change is worked
 * out from the section as it is when it applies, so two changes made one after the other never undo each other.
 */
export async function saveStart(userId: number, changes: Partial<StartPreferences> | ((current: StartPreferences) => Partial<StartPreferences>)) {
    await loadPreferences(userId);
    const current = readPreferences(userId).start ?? {};
    const next = typeof changes === 'function' ? changes(current) : changes;
    return (await updatePreferences(userId, { start: { ...current, ...next } })).start ?? {};
}
/**
 * The town given at sign-up, kept when the account has no town yet, so a town chosen later always wins.
 * Backend needed: POST /auth/register accepting `town`, which makes this unnecessary.
 */
export async function keepRegistrationTown(userId: number, name: string) {
    const town = townByName(name);
    if (town) await saveStart(userId, current => (current.town ? {} : { town }));
}

export interface NearbyClub {
    id: number;
    name: string;
    logoUrl?: string | null;
    cityName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isFollowedByMe?: boolean;
    km: number;
}

/** The clubs nearest a town, from the public directory, nearest first. Clubs without coordinates are left out. */
export async function fetchClubsNear(town: Town, limit = 6, signal?: AbortSignal): Promise<NearbyClub[]> {
    const response = await apiClient.get<NearbyClub[] | { content: NearbyClub[] }>('/clubs', { params: { page: 0, size: 100 }, signal });
    const clubs = Array.isArray(response.data) ? response.data : response.data.content ?? [];
    return clubs
        .filter(club => typeof club.latitude === 'number' && typeof club.longitude === 'number')
        .map(club => ({ ...club, km: Math.round(kmBetween(town, { latitude: club.latitude!, longitude: club.longitude! })) }))
        .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name))
        .slice(0, limit);
}

export const followClub = (id: number) => apiClient.post(`/clubs/${id}/follow`);
export const unfollowClub = (id: number) => apiClient.delete(`/clubs/${id}/follow`);
