import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ageFromDob } from '../pages/create/useCreatePage';
import { usePreferences } from '../preferences/preferencesStore';
import { devicePosition, fetchClubsNearYou, fetchPlace, resolveTown, saveStart, type NearbyClub, type Place } from './startApi';

/** How many nearby clubs the setup loads: eight shown, the rest behind "Show more". */
const NEARBY = 24;

/**
 * What the welcome already knows about the person, so it asks nothing it can decide: their place (from sign-up, the
 * device or their connection, as the server decides), the clubs near them in their own country, and whether they
 * are an adult. `locate` asks the device once, only when the person presses it.
 */
export function useWelcomeFacts() {
    const { user } = useAuth();
    const userId = user?.id;
    const age = ageFromDob(user?.dob);
    const [place, setPlace] = useState<Place | null>(null);
    const [clubs, setClubs] = useState<NearbyClub[] | null>(null);
    const [locating, setLocating] = useState<'idle' | 'locating' | 'failed'>('idle');
    // The town kept for the person: a new one (the sign-up town arriving, a device position) asks again.
    const town = usePreferences(userId).start?.town;
    const townName = town?.name ?? '';

    useEffect(() => {
        const controller = new AbortController();
        const ask = () => Promise.all([fetchPlace(controller.signal), fetchClubsNearYou(NEARBY, controller.signal)]);
        void ask()
            .then(async first => {
                let answer = first;
                // A town saved a moment ago may not have reached the server yet: once it has, ask again.
                if (userId && townName && (answer[0].source !== 'SAVED' || answer[0].name !== townName)) {
                    await saveStart(userId, {}).catch(() => undefined);
                    if (!controller.signal.aborted) answer = await ask();
                }
                if (!controller.signal.aborted) { setPlace(answer[0]); setClubs(answer[1]); }
            })
            .catch(() => { if (!controller.signal.aborted) { setPlace(null); setClubs([]); } });
        return () => controller.abort();
    }, [townName, userId]);

    const locate = useCallback(async () => {
        if (!userId) return;
        setLocating('locating');
        const at = await devicePosition();
        const town = at ? await resolveTown('DEVICE', at).catch(() => null) : null;
        if (!town) { setLocating('failed'); return; }
        await saveStart(userId, { town }).catch(() => undefined);
        setLocating('idle');
    }, [userId]);

    /** Updates one club's follow state in place after a tap. */
    const setFollowing = useCallback((id: number, following: boolean) => setClubs(current => current?.map(club => club.id === id
        ? { ...club, following, followers: Math.max(0, club.followers + (following === club.following ? 0 : following ? 1 : -1)) }
        : club) ?? null), []);

    return {
        place, clubs, ready: clubs !== null, locating, locate, setFollowing,
        /** Unknown age counts as adult: the server still refuses what a minor may not do. */
        adult: age == null || age >= 18,
        minor: age != null && age < 18,
    };
}

export type WelcomeFacts = ReturnType<typeof useWelcomeFacts>;
