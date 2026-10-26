import { useCallback, useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchStaffLinks, type StaffLink } from './api';

const LIVE_EVERY_MS = 10_000;

/**
 * The club's active staff links, for admins. While `live` (the link is on screen), it asks again every ten seconds so
 * the list of who joined fills in as people scan the code. `null` until the first answer.
 */
export function useStaffLinks(club: number, enabled: boolean, live: boolean, fallback: string) {
    const [links, setLinks] = useState<StaffLink[] | null>(null), [error, setError] = useState('');
    const [round, setRound] = useState(0);
    const reload = useCallback(() => setRound(value => value + 1), []);
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        fetchStaffLinks(club, controller.signal).then(found => { if (!controller.signal.aborted) { setLinks(found); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, fallback)); });
        return () => controller.abort();
    }, [club, enabled, round, fallback]);
    useEffect(() => {
        if (!enabled || !live) return;
        const timer = window.setInterval(reload, LIVE_EVERY_MS);
        return () => window.clearInterval(timer);
    }, [enabled, live, reload]);
    return { links, error, reload, setLinks };
}
