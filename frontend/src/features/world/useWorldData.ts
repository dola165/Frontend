import { useEffect, useEffectEvent, useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { WORLD_CHANGED } from './cache';

export interface WorldData<T> { data: T | undefined; loading: boolean; error: string; retry: () => void }

/**
 * Loads data for one World block. `key` identifies the request: a new key starts a new
 * load and never shows the previous key's data as current; `null` skips loading.
 */
export function useWorldData<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, fallbackError = 'This could not load.', { keep = false, follow = false }: {
    /** While a new key loads, keep showing the last answer (asking again after a change, not a different question). */ keep?: boolean;
    /** Ask again quietly whenever something changed on the page (a result saved in a drawer), keeping the last answer meanwhile. */ follow?: boolean;
} = {}): WorldData<T> {
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!follow || key === null) return;
        const again = () => setAttempt(value => value + 1);
        window.addEventListener(WORLD_CHANGED, again);
        return () => window.removeEventListener(WORLD_CHANGED, again);
    }, [follow, key]);
    const [result, setResult] = useState<{ key: string; attempt: number; data?: T; error: string }>();
    const run = useEffectEvent((signal: AbortSignal) => load(signal));
    useEffect(() => {
        if (key === null) return;
        const controller = new AbortController();
        void run(controller.signal)
            .then(data => { if (!controller.signal.aborted) setResult({ key, attempt, data, error: '' }); })
            .catch(cause => { if (!controller.signal.aborted) setResult({ key, attempt, error: extractApiErrorMessage(cause, fallbackError) }); });
        return () => controller.abort();
    }, [key, attempt, fallbackError]);
    const current = result && key !== null && result.key === key && result.attempt === attempt ? result : undefined;
    return {
        data: current?.data ?? ((keep || follow) && key !== null && !current ? result?.data : undefined),
        loading: key !== null && !current,
        error: current?.error ?? '',
        retry: () => setAttempt(value => value + 1),
    };
}
