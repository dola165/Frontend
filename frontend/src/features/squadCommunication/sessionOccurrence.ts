import { useEffect, useState, useSyncExternalStore } from 'react';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { apiClient } from '../../api/axiosConfig';
import type { SquadSession } from './api';

export interface SessionHistoryEntry {
    revision: number; changedAt: string; beforeTitle: string; title: string;
    beforeStartsAt: string; startsAt: string; beforeEndsAt: string; endsAt: string;
    beforeLocation: string | null; location: string | null; status: string; cancellationReason: string | null;
}
export interface SessionOccurrence { session: SquadSession; history: SessionHistoryEntry[] }

export async function fetchSessionOccurrence(squad: number, session: number, playerId?: number, signal?: AbortSignal) {
    const response = await apiClient.get<SessionOccurrence>(`/squad-communication/${squad}/events/${session}`, { params: { playerId }, signal });
    if (!response.data?.session || !Array.isArray(response.data.history)) throw new Error('The session could not be read. Try again.');
    return response.data;
}

export function useSessionOccurrence(squad: number, session: number, playerId?: number, enabled = true) {
    const account = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [attempt, setAttempt] = useState(0);
    const key = `${account}:${squad}:${session}:${playerId ?? ''}:${attempt}`;
    const [state, setState] = useState<{ key: string; value?: SessionOccurrence; error?: string } | null>(null);
    useEffect(() => {
        if (!enabled) return;
        const abort = new AbortController();
        void fetchSessionOccurrence(squad, session, playerId, abort.signal)
            .then(value => { if (!abort.signal.aborted) setState({ key, value }); })
            .catch(error => { if (!abort.signal.aborted) setState({ key, error: extractApiErrorMessage(error, 'The current session could not load.') }); });
        return () => abort.abort();
    }, [key, squad, session, playerId, enabled]);
    const current = state?.key === key ? state : null;
    return { value: current?.value, error: current?.error, loading: enabled && !current, reload: () => setAttempt(n => n + 1) };
}
