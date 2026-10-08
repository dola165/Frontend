import { createContext, useContext, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { getAuthSessionId, getStoredUserId, subscribeAuthSession } from '../../utils/authStorage';

type DraftStore = ReturnType<typeof createStore>;
function createStore() {
    const values = new Map<string, unknown>();
    const listeners = new Set<() => void>();
    let formGeneration = 0;
    return {
        values,
        get formGeneration() { return formGeneration; },
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        notify: () => listeners.forEach(listener => listener()),
        clearForm: () => { formGeneration++; for (const key of values.keys()) if (key.startsWith('form:')) values.delete(key); },
    };
}
const drafts = new Map<string, DraftStore>();
export const CommerceDraftContext = createContext<DraftStore | null>(null);
const ownerPrefix = (sessionId: string | null, userId: string | null) => `${sessionId ?? 'legacy'}:${userId ?? 'guest'}:`;
// Profile identity resolves after the login event. Compare each store's owner with
// the current account, so a later renewal cannot retire drafts created meanwhile.
// Logout/new logins change the generation and retire the old stores; their delayed
// callbacks can still only update an unreachable old store.
const retireSession = () => {
    const currentOwner = ownerPrefix(getAuthSessionId(), getStoredUserId());
    for (const key of drafts.keys()) {
        if (!key.startsWith(currentOwner)) drafts.delete(key);
    }
};
window.addEventListener('gk-auth-changed', retireSession);
window.addEventListener('storage', retireSession);
window.addEventListener('beforeunload', event => {
    if ([...drafts.values()].some(store => store.values.get('editing') || store.values.get('updates') || store.values.get('busy') || store.values.get('jobBusy') || store.values.get('form:uploading'))) {
        event.preventDefault(); event.returnValue = '';
    }
});
const subscribeIdentity = (listener: () => void) => {
    window.addEventListener('gk-auth-changed', listener); window.addEventListener('storage', listener);
    return () => { window.removeEventListener('gk-auth-changed', listener); window.removeEventListener('storage', listener); };
};
export function useScopedDraftStore(clubId: number, feature: string) {
    const userId = useSyncExternalStore(subscribeIdentity, getStoredUserId);
    const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const key = `${ownerPrefix(sessionId, userId)}${clubId}:${feature}`;
    const [anonymous] = useState(createStore);
    let store = userId ? drafts.get(key) : anonymous;
    if (!store) { store = createStore(); drafts.set(key, store); }
    return { key, store };
}
export function useCommerceDraftState<T>(name: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
    const context = useContext(CommerceDraftContext);
    const [local] = useState(createStore);
    const store = context ?? local;
    const [fallback] = useState(initial);
    const value = useSyncExternalStore(store.subscribe, () => store.values.has(name) ? store.values.get(name) as T : fallback);
    const generation = store.formGeneration;
    const setValue: Dispatch<SetStateAction<T>> = next => {
        // Navigation keeps the generation; discarding or saving retires old form callbacks.
        if (name.startsWith('form:') && generation !== store.formGeneration) return;
        const previous = store.values.has(name) ? store.values.get(name) as T : fallback;
        store.values.set(name, typeof next === 'function' ? (next as (old: T) => T)(previous) : next);
        store.notify();
    };
    return [value, setValue];
}
export function useClearCommerceForm() {
    const store = useContext(CommerceDraftContext);
    const generation = store?.formGeneration;
    return () => {
        // Save completions, like field writes, belong to the form that started them.
        if (!store || generation !== store.formGeneration) return;
        store.clearForm();
        store.notify();
    };
}
