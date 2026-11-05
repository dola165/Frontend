import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { existingTravelLinks, type ExistingTravelLink } from './existingTravelLinks';
import { travelCommand, travelGet } from './api';

export function useTravelRead<T>(path: string) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [version, setVersion] = useState(0);
    const [state, setState] = useState<{ key: string; data?: T; error?: string }>();
    const key = `${session}:${path}`;
    useEffect(() => {
        const abort = new AbortController();
        void travelGet<T>(path, abort.signal).then(data => { if (!abort.signal.aborted && isCurrentAuthSession(session)) setState({ key, data }); })
            .catch(cause => { if (!abort.signal.aborted && isCurrentAuthSession(session)) setState({ key, error: extractApiErrorMessage(cause, 'Travel could not load. Try again.') }); });
        return () => abort.abort();
    }, [key, path, session, version]);
    return { data: state?.key === key ? state.data : undefined, error: state?.key === key ? state.error : undefined, refresh: () => setVersion(v => v + 1) };
}

export function useTravelCommand(onSaved: () => void) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const lock = useRef(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [links, setLinks] = useState<ExistingTravelLink[]>([]);
    const runExternal = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(''); setLinks([]);
        try {
            const saved = await work();
            if (!isCurrentAuthSession(session)) return;
            onSaved(); return saved;
        } catch (cause) {
            if (isCurrentAuthSession(session)) { setError(extractApiErrorMessage(cause, 'Travel was not saved. Your draft is kept. Reload current details before retrying a conflict.')); setLinks(existingTravelLinks(cause)); }
        } finally { lock.current = false; if (isCurrentAuthSession(session)) setBusy(false); }
    };
    return { busy, error, links, runExternal, run: <T,>(path: string, body: unknown, method: 'post' | 'put' | 'get' = 'post') => runExternal(() => travelCommand<T>(path, body, method)) };
}
