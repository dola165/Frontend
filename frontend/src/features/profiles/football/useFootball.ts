import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { fetchFootball, type FootballProfileData } from './api';

/**
 * A person's football lines and career as the viewer may see them. A server without the endpoint (404) answers
 * "nothing to show" rather than an error, so the profile still draws; the page never fills anything in itself.
 */
export function useFootball(userId: number | 'me' | null) {
    const { sessionId } = useAuth();
    const [revision, setRevision] = useState(0);
    const key = `${userId}:${sessionId}:${revision}`;
    const [result, setResult] = useState<{ key: string; data: FootballProfileData | null; status: 'ready' | 'missing' | 'failed' } | null>(null);
    useEffect(() => {
        if (userId === null) return;
        const controller = new AbortController();
        void fetchFootball(userId, controller.signal)
            .then(data => { if (!controller.signal.aborted) setResult({ key, data, status: 'ready' }); })
            .catch(error => { if (!controller.signal.aborted) setResult({ key, data: null, status: error?.response?.status === 404 ? 'missing' : 'failed' }); });
        return () => controller.abort();
    }, [userId, key]);
    // A reload keeps the last answer on screen until the new one arrives.
    const current = result?.key === key ? result : null;
    return {
        data: current?.data ?? result?.data ?? null,
        status: current?.status ?? (result ? result.status : 'loading') as 'loading' | 'ready' | 'missing' | 'failed',
        set: (data: FootballProfileData) => setResult({ key, data, status: 'ready' }),
        reload: () => setRevision(value => value + 1),
    };
}

export type FootballView = ReturnType<typeof useFootball>;
