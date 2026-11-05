import { useCallback, useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchStaffClubChoice, type StaffClubChoice } from './api';

/** The staff-club choice for this person: `null` while it loads, `needed: false` for nearly everyone. */
export function useStaffClubChoice(enabled = true, fallback = 'Your clubs couldn’t load.') {
    const [choice, setChoice] = useState<StaffClubChoice | null>(null), [error, setError] = useState(''), [round, setRound] = useState(0);
    const reload = useCallback(() => setRound(value => value + 1), []);
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        fetchStaffClubChoice(controller.signal).then(found => { if (!controller.signal.aborted) { setChoice(found); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, fallback)); });
        return () => controller.abort();
    }, [enabled, round, fallback]);
    return { choice, error, reload };
}
