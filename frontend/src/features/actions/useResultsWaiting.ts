import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { fetchResultsWaiting, type ResultWaiting } from './api';

/** One answer per session for the header, Home and the squad page; `refreshResultsWaiting` after a score is saved. */
const cache = new Map<string, Promise<ResultWaiting[]>>();
const listeners = new Set<() => void>();
export const refreshResultsWaiting = () => { cache.clear(); listeners.forEach(listener => listener()); };

/**
 * The person's matches still waiting for a score, newest first: undefined while asked, empty when none (or when the
 * server cannot say, so nothing offers a score that is not owed).
 */
export function useResultsWaiting(enabled = true): ResultWaiting[] | undefined {
    const { status } = useAuth();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const key = enabled && status === 'authenticated' ? session ?? '' : null;
    const [state, setState] = useState<{ key: string; results: ResultWaiting[] } | null>(null);
    const [round, setRound] = useState(0);
    useEffect(() => {
        const bump = () => setRound(value => value + 1);
        listeners.add(bump);
        return () => { listeners.delete(bump); };
    }, []);
    useEffect(() => {
        if (key === null) return;
        let live = true;
        let found = cache.get(key);
        if (!found) {
            const asked = fetchResultsWaiting().catch(() => { if (cache.get(key) === asked) cache.delete(key); return []; });
            cache.set(key, asked);
            found = asked;
        }
        void found.then(results => { if (live) setState({ key, results }); });
        return () => { live = false; };
    }, [key, round]);
    if (key === null) return status === 'bootstrapping' || !enabled ? undefined : [];
    return state?.key === key ? state.results : undefined;
}
