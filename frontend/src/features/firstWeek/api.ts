import { useEffect, useState } from 'react';
import { fetchJoiningChildren } from '../joining-contract/api';
import { fetchClubsNearYou, type NearbyClub } from '../start/startApi';
import type { AuthSessionId } from '../../utils/authStorage';

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

/**
 * Whether a child is linked to the person, from the family's own child list, asked only while `ask`. Parent Hub
 * alone is not enough: the server also opens it for a pending invitation or a consent email with no child yet.
 */
export function useChildLinked(ask: boolean, session: AuthSessionId) {
    const [linked, setLinked] = useState(false);
    useEffect(() => {
        if (!ask) return;
        const controller = new AbortController();
        fetchJoiningChildren(session, controller.signal).then(
            found => { if (!controller.signal.aborted) setLinked((found.children ?? []).length > 0); },
            () => { /* Unknown stays unticked; the step is still there to press. */ });
        return () => controller.abort();
    }, [ask, session]);
    return ask && linked;
}
