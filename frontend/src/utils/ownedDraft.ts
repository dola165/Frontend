import { useState, useSyncExternalStore } from 'react';
import { getStoredUserId } from './authStorage';

const subscribeIdentity = (listener: () => void) => {
    window.addEventListener('gk-auth-changed', listener); window.addEventListener('storage', listener);
    return () => { window.removeEventListener('gk-auth-changed', listener); window.removeEventListener('storage', listener); };
};

/**
 * A form draft kept in the tab's session storage under the signed-in person: another account signing in on the same
 * tab starts from its own draft (or an empty one), never the last person's. Signed out, the draft lives in memory.
 * `start` is laid over the stored draft whenever it is read (an address that asks for a club, say).
 */
export function useOwnedDraft<T extends object>(name: string, empty: T, start?: Partial<T>) {
    const userId = useSyncExternalStore(subscribeIdentity, getStoredUserId);
    const key = userId ? `gk.${name}.draft:${userId}` : null;
    const read = (): T => {
        try {
            sessionStorage.removeItem(`gk.${name}.draft`); // the unowned key of earlier builds
            return { ...empty, ...(key ? JSON.parse(sessionStorage.getItem(key) ?? '{}') : {}), ...start };
        } catch { return { ...empty, ...start }; }
    };
    const [state, setState] = useState(() => ({ key, draft: read() }));
    if (state.key !== key) setState({ key, draft: read() });
    const write = (draft: T) => { if (key) try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* memory only */ } };
    const change = (patch: Partial<T>) => setState(current => { const draft = { ...current.draft, ...patch }; if (current.key === key) write(draft); return { key: current.key, draft }; });
    const clear = () => { if (key) try { sessionStorage.removeItem(key); } catch { /* nothing to clear */ } };
    const reset = () => { clear(); setState({ key, draft: { ...empty, ...start } }); };
    return { draft: state.draft, change, clear, reset };
}
