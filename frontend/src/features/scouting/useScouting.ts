import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import type { Command, ScoutingApi, Prospect } from './api';

/** A refresh clears private data until current authority answers. Late responses cannot cross scope. */
export function useScoutingResource<T>(load: (signal: AbortSignal) => Promise<T>, refreshOnFocus = true) {
    const [refresh, setRefresh] = useState(0);
    const [state, setState] = useState<{ load: typeof load; refresh: number; data?: T; error?: string }>();
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal).then(data => {
            if (!controller.signal.aborted) setState({ load, refresh, data });
        }).catch(error => {
            if (!controller.signal.aborted) setState({ load, refresh, error: extractApiErrorMessage(error, 'Scouting could not load. Try again.') });
        });
        return () => controller.abort();
    }, [load, refresh]);
    const reload = useCallback(() => setRefresh(n => n + 1), []);
    useEffect(() => {
        if (!refreshOnFocus) return;
        window.addEventListener('focus', reload);
        return () => window.removeEventListener('focus', reload);
    }, [reload, refreshOnFocus]);
    const current = state?.load === load && state.refresh === refresh ? state : undefined;
    return { data: current?.data, error: current?.error, loading: !current, reload };
}

export type ScoutingOperation =
    | { kind: 'WATCH'; squad: number | null; person: number; application: number | null; requestId: string }
    | { kind: 'COMMAND' | 'CONTACT'; id: number; command: Command };
type Result = { kind: 'WATCH' | 'COMMAND'; record: Prospect } | { kind: 'CONTACT'; conversationId: number };
type Pending = { session: AuthSessionId; operation: ScoutingOperation; busy: boolean };
// Tab-memory receipts survive routed unmount/return, without persisting private notes to storage.
const pending = new Map<string, Pending>(), listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const scrub = () => { for (const [key, value] of pending) if (!isCurrentAuthSession(value.session)) pending.delete(key); emit(); };
window.addEventListener('gk-auth-changed', scrub); window.addEventListener('storage', scrub); window.addEventListener('pageshow', scrub);

/** Exact operation identity belongs to one login, club, squad and record, even after remount. */
export function useScoutingAction(session: AuthSessionId, scope: string, api: ScoutingApi, onRefused: () => void, success: (result: Result) => void) {
    const key = JSON.stringify([session, scope]);
    const entry = useSyncExternalStore(subscribe, () => pending.get(key));
    const [error, setError] = useState('');
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const execute = async (operation: ScoutingOperation) => {
        if (pending.get(key)?.busy || !isCurrentAuthSession(session)) return;
        pending.set(key, { session, operation, busy: true }); emit(); setError('');
        try {
            const result: Result = operation.kind === 'WATCH'
                ? { kind: 'WATCH', record: await api.watch(operation.squad, operation.person, operation.application, operation.requestId) }
                : operation.kind === 'COMMAND' ? { kind: 'COMMAND', record: await api.command(operation.id, operation.command) }
                    : { kind: 'CONTACT', ...await api.contact(operation.id, operation.command) };
            if (!alive.current || !isCurrentAuthSession(session)) return;
            pending.delete(key); success(result);
        } catch (e) {
            if (!isCurrentAuthSession(session)) return;
            const status = (e as { response?: { status?: number } }).response?.status;
            const unknown = status == null || status >= 500;
            if (!unknown) pending.delete(key);
            if (alive.current) {
                setError(unknown ? '' : extractApiErrorMessage(e, 'This action was not accepted. Reload the record.'));
                if ([401, 403, 404].includes(status ?? 0)) onRefused();
            }
        } finally {
            if (!isCurrentAuthSession(session)) pending.delete(key);
            else if (pending.has(key)) pending.set(key, { session, operation, busy: false });
            emit();
        }
    };
    return { busy: Boolean(entry?.busy), uncertain: Boolean(entry),
        error: entry && !entry.busy ? 'A saved action needs confirmation. Retry it to recover the recorded result.' : error,
        run: (operation: ScoutingOperation) => { if (!pending.has(key)) void execute(Object.freeze(structuredClone(operation))); },
        retry: () => { const saved = pending.get(key); if (saved) void execute(saved.operation); } };
}
