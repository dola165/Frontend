import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { fetchAccess, type AccessAction, type AccessDecision, type AccessRules, type AccessSubject } from '../api/access';
import { getAuthSessionId, subscribeAuthSession } from '../utils/authStorage';

/** One answer per session and subject, shared by every button on the page; `refreshAccess` after a change. */
const cache = new Map<string, Promise<AccessRules | null>>();
const listeners = new Set<() => void>();
export const refreshAccess = () => { cache.clear(); listeners.forEach(listener => listener()); };

const load = (key: string, subject: AccessSubject) => {
    let found = cache.get(key);
    if (!found) {
        found = fetchAccess(subject);
        found.catch(() => cache.delete(key));
        cache.set(key, found);
    }
    return found;
};

export interface Can {
    /** True while the answer is on its way: show the screen's own buttons disabled, so none appears and then vanishes. */
    pending: boolean;
    /**
     * The decision for one action. Without the checker (an older server, or a failed check) the screen's own flag
     * decides, so buttons never vanish because the checker is missing; with it, unknown actions are refused. While
     * it loads, the flag decides and the decision says `pending`.
     */
    decide: (action: AccessAction, fallback: boolean) => AccessDecision;
    /** Who "Ask the admin" writes to, when the server named one. */
    admin: { userId: number; name: string } | null;
}

/** "What can I do here?" for a club or a squad, in one place for every screen. `null` skips the check. */
export function useCan(subject: AccessSubject | null): Can {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [state, setState] = useState<{ key: string; rules: AccessRules | null } | null>(null);
    const [round, setRound] = useState(0);
    const key = subject ? `${session ?? ''}:${subject}` : null;
    useEffect(() => {
        const bump = () => setRound(value => value + 1);
        listeners.add(bump);
        return () => { listeners.delete(bump); };
    }, []);
    useEffect(() => {
        if (!key || !subject) return;
        let live = true;
        load(key, subject).then(rules => { if (live) setState({ key, rules }); }, () => { if (live) setState({ key, rules: null }); });
        return () => { live = false; };
    }, [key, subject, round]);
    const rules = state && state.key === key ? state.rules : undefined;
    // Nothing to wait for when no check was asked for; a failed check counts as answered (the flags decide).
    const pending = key !== null && rules === undefined;
    const decide = useCallback((action: AccessAction, fallback: boolean): AccessDecision =>
        rules ? rules.actions[action] ?? { allowed: false } : { allowed: fallback, pending }, [rules, pending]);
    return { pending, decide, admin: rules?.admins?.[0] ?? null };
}
