import { apiClient } from '../../api/axiosConfig';
import { fetchClubDirectory } from '../world/api';
import { loadPreferences, readPreferences, updatePreferences, type StartPreferences } from '../preferences/preferencesStore';
import { publicProgrammes, fitsAge, programmeAges, programmeFee } from '../world/cards/programmes';
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
/** Where the person's suggestions start, as the server decides it (GET /users/me/place). */
export interface Place {
    name: string;
    latitude: number | null;
    longitude: number | null;
    countryCode: string | null;
    countryName: string | null;
    /** SAVED: a town they gave. CONNECTION: only their connection's country. DEFAULT: nothing known (the launch market). */
    source: 'SAVED' | 'CONNECTION' | 'DEFAULT';
}
export const fetchPlace = (signal?: AbortSignal) => apiClient.get<Place>('/users/me/place', { signal }).then(r => r.data);

/** The town to keep for the sign-up town or a device position; the server decides (nothing is saved). */
export const resolveTown = (origin: 'SIGNUP' | 'DEVICE', at: { name?: string; latitude: number; longitude: number }) =>
    apiClient.get<{ town: Town | null }>('/users/me/place/resolve', { params: { origin, ...at } }).then(r => r.data.town);

/**
 * The town given at sign-up, kept when the account has no town yet, so a town chosen later always wins. The sign-up
 * list holds Georgian towns, so when the connection comes from another country the server keeps no town: that country
 * stands, and no town of it is guessed.
 */
export async function keepRegistrationTown(userId: number, name: string) {
    const town = townByName(name);
    if (!town) return;
    const kept = await resolveTown('SIGNUP', town);
    if (kept) await saveStart(userId, current => (current.town ? {} : { town: kept }));
}

/** The device's position, asked for once; null when the person declines or it fails. */
export const devicePosition = () => new Promise<{ latitude: number; longitude: number } | null>(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
        position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(null),
        { timeout: 10_000, maximumAge: 300_000 },
    );
});

/** A club near the person: in their own country only, nearest first, with its real follower count. */
export interface NearbyClub {
    id: number;
    name: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    cityName: string | null;
    /** Distance from the person's town, when both are placed. */
    km: number | null;
    followers: number;
    following: boolean;
    /** The club's published programme that takes the age asked about (the clubs for an age), when it lists one. */
    programme?: { name: string; ages: string; sessionsPerWeek: number | null; fee: string } | null;
}
/** Clubs in the person's own country: nearest first from a town they gave, or the most followed first. */
export const fetchClubsNearYou = (limit = 8, sort: 'NEAREST' | 'POPULAR' = 'NEAREST', signal?: AbortSignal) =>
    apiClient.get<NearbyClub[]>('/clubs/near-you', { params: { limit, sort }, signal }).then(r => r.data);

/**
 * Clubs from World's directory, as tiles: with a town, how far each is from it; with an age, the published programme
 * that takes it (the server matched the age; the programme says which one, how often and what it costs).
 */
const directoryClubs = async (params: Record<string, string>, signal?: AbortSignal, near?: { town: Town | null; age: number }): Promise<NearbyClub[]> =>
    (await fetchClubDirectory(new URLSearchParams({ page: '0', size: '12', ...params }), signal)).content.map(club => {
        const fit = near ? publicProgrammes(club.presentation).find(programme => fitsAge(programme, near.age)) : undefined;
        const placed = near?.town && club.latitude != null && club.longitude != null;
        return {
            id: club.id, name: club.name, logoUrl: club.logoUrl ?? null, bannerUrl: null, cityName: club.cityName ?? null,
            km: placed ? kmBetween(near.town!, { latitude: club.latitude!, longitude: club.longitude! }) : null,
            followers: club.followerCount ?? 0, following: club.isFollowedByMe === true,
            programme: fit ? { name: fit.name, ages: programmeAges(fit), sessionsPerWeek: fit.sessionsPerWeek, fee: programmeFee(fit) } : null,
        };
    });
/** Clubs found by name, anywhere: searching is how a club far away is found. */
export const searchClubs = (query: string, signal?: AbortSignal) => directoryClubs({ search: query }, signal);
/** Clubs in a town whose published programme takes this age (the server matches the age, as World's directory does). */
export const fetchClubsForAge = (age: number, city: string, signal?: AbortSignal) => directoryClubs({ age: String(age), city }, signal, { town: townByName(city), age });

export const followClub = (id: number) => apiClient.post(`/clubs/${id}/follow`);
/** Follows each club not followed yet; resolves to how many did not go through. */
export const followClubs = async (clubs: NearbyClub[]) =>
    (await Promise.allSettled(clubs.filter(club => !club.following).map(club => followClub(club.id)))).filter(result => result.status === 'rejected').length;
