import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ageFromDob, isAdult } from '../../utils/age';
import { usePreferences } from '../preferences/preferencesStore';
import { devicePosition, fetchPlace, resolveTown, saveStart, type Place } from './startApi';

/**
 * What the setup already knows about the person, so it asks nothing it can decide: their place (from sign-up, the
 * device or their connection, as the server decides) and whether they are an adult. `locate` asks the device once,
 * only when the person presses it.
 */
export function useWelcomeFacts() {
    const { user } = useAuth();
    const userId = user?.id;
    const age = ageFromDob(user?.dob);
    const [place, setPlace] = useState<Place | null>(null);
    const [locating, setLocating] = useState<'idle' | 'locating' | 'failed'>('idle');
    // The town kept for the person: a new one (the sign-up town arriving, a device position) asks again.
    const town = usePreferences(userId).start?.town;
    const townName = town?.name ?? '';

    useEffect(() => {
        const controller = new AbortController();
        const ask = () => fetchPlace(controller.signal);
        void ask()
            .then(async first => {
                let answer = first;
                // A town saved a moment ago may not have reached the server yet: once it has, ask again.
                if (userId && townName && (answer.source !== 'SAVED' || answer.name !== townName)) {
                    await saveStart(userId, {}).catch(() => undefined);
                    if (!controller.signal.aborted) answer = await ask();
                }
                if (!controller.signal.aborted) setPlace(answer);
            })
            .catch(() => { if (!controller.signal.aborted) setPlace(null); });
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

    return {
        place, locating, locate, age,
        /** A missing birth date is not adult (utils/age); under 18 the welcome offers only Play (for me) and Follow. */
        adult: isAdult(user?.dob),
    };
}

export type WelcomeFacts = ReturnType<typeof useWelcomeFacts>;
