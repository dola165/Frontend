import { useCallback, useSyncExternalStore } from 'react';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import type { TwoFactorSetup } from './api';

type SensitiveState = {
    setup: (TwoFactorSetup & { expiresAt: number }) | null;
    recoveryCodes: string[] | null;
    enabled?: boolean;
};
const empty: SensitiveState = { setup: null, recoveryCodes: null };
const listeners = new Set<() => void>();
const entries = new Map<string, SensitiveState>();
let owner = getAuthSessionId();
const notify = () => listeners.forEach(listener => listener());
subscribeAuthSession(() => {
    if (owner !== getAuthSessionId()) { owner = getAuthSessionId(); entries.clear(); notify(); }
});
// Preserve codes across same-account SPA navigation, while warning before a document/native view is destroyed.
window.addEventListener('beforeunload', event => {
    if ([...entries.values()].some(value => value.setup || value.recoveryCodes)) { event.preventDefault(); event.returnValue = ''; }
});

export function useTwoFactorSensitiveState(accountId: number) {
    const session = getAuthSessionId();
    const key = `${session}:${accountId}`;
    const snapshot = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => entries.get(key) ?? empty);
    const update = useCallback((value: SensitiveState) => {
        if (getAuthSessionId() !== session) return;
        entries.set(key, value); notify();
    }, [key, session]);
    return [snapshot, update] as const;
}
