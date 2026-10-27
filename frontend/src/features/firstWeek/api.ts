import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { fetchClubsNearYou, type NearbyClub } from '../start/startApi';

/** The person's own profile photo (PUT /users/me), as the profile page saves it. */
export const saveMyPhoto = (avatarUrl: string) => apiClient.put('/users/me', { avatarUrl });

/**
 * Clubs in the person's country, nearest first, asked again on each attempt: null while loading, 'failed' when they
 * could not load. `change` updates the loaded list in place (a club followed).
 */
export function useClubsNearYou(attempt: number) {
    const [loaded, setLoaded] = useState<{ attempt: number; clubs: NearbyClub[] | 'failed' } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchClubsNearYou(8, 'NEAREST', controller.signal).then(
            clubs => setLoaded({ attempt, clubs }),
            () => { if (!controller.signal.aborted) setLoaded({ attempt, clubs: 'failed' }); });
        return () => controller.abort();
    }, [attempt]);
    const change = (update: (clubs: NearbyClub[]) => NearbyClub[]) =>
        setLoaded(current => current && Array.isArray(current.clubs) ? { ...current, clubs: update(current.clubs) } : current);
    return [loaded?.attempt === attempt ? loaded.clubs : null, change] as const;
}
