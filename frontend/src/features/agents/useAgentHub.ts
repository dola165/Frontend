import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAgentDashboard, fetchClubApproachSummary, fetchMyEngagements, fetchMyInterests, fetchRepresentationAttention } from './api';
import type { AgentDashboardData, AgentEngagement, AgentInterest } from './domain';
import type { AuthSessionId } from '../../utils/authStorage';

/** The Agent Hub's independent sections: one failing never hides another, and a missing one is unknown, never empty. */
export interface AgentHubData {
    dashboard: AgentDashboardData | null;
    interests: AgentInterest[] | null;
    engagements: AgentEngagement[] | null;
    representation: number | null;
    approaches: { active: number; pending: number } | null;
}
export type AgentHubSection = keyof AgentHubData;
export const HUB_SECTIONS: AgentHubSection[] = ['dashboard', 'interests', 'engagements', 'representation', 'approaches'];

const EMPTY: AgentHubData = { dashboard: null, interests: null, engagements: null, representation: null, approaches: null };
type Config = { signal?: AbortSignal; _authSessionId: AuthSessionId };
const fetchers: { [K in AgentHubSection]: (config: Config) => Promise<AgentHubData[K]> } = {
    dashboard: fetchAgentDashboard,
    interests: fetchMyInterests,
    engagements: config => fetchMyEngagements(undefined, config),
    representation: fetchRepresentationAttention,
    approaches: fetchClubApproachSummary,
};
// Access taken away (or the record gone): what was shown before must not stay on screen.
const revoked = (reason: unknown) => [401, 403, 404].includes((reason as { response?: { status?: number } })?.response?.status ?? 0);

/**
 * Loads the hub's sections side by side and keeps each one's outcome. A background refresh that fails keeps what
 * was loaded (marked stale) unless access was refused; a section can be retried on its own.
 */
export function useAgentHub(sessionId: AuthSessionId) {
    const [data, setData] = useState<AgentHubData>(EMPTY);
    const [failed, setFailed] = useState<AgentHubSection[]>([]);
    const [retrying, setRetrying] = useState<AgentHubSection[]>([]);
    const [loading, setLoading] = useState(true);
    const activeRef = useRef(true), requestRef = useRef(0), inFlightRef = useRef(false);

    useEffect(() => {
        activeRef.current = true;
        return () => { activeRef.current = false; requestRef.current += 1; };
    }, []);

    const load = useCallback(async (signal?: AbortSignal, background = false) => {
        if (background && inFlightRef.current) return;
        inFlightRef.current = true;
        const request = ++requestRef.current;
        if (!background) { setData(EMPTY); setFailed([]); setLoading(true); }
        const config = { signal, _authSessionId: sessionId };
        const results = await Promise.allSettled(HUB_SECTIONS.map(section => fetchers[section](config)));
        if (request === requestRef.current) inFlightRef.current = false;
        if (!activeRef.current || signal?.aborted || request !== requestRef.current) return;
        setData(previous => {
            const next: Record<string, unknown> = { ...(background ? previous : EMPTY) };
            results.forEach((result, index) => {
                const section = HUB_SECTIONS[index];
                if (result.status === 'fulfilled') next[section] = result.value;
                else if (revoked(result.reason)) next[section] = null;
            });
            return next as unknown as AgentHubData;
        });
        const failures = HUB_SECTIONS.filter((_, index) => results[index].status === 'rejected');
        failures.forEach(section => console.error(`Agent hub: ${section} could not load`, (results[HUB_SECTIONS.indexOf(section)] as PromiseRejectedResult).reason));
        setFailed(failures);
        setLoading(false);
    }, [sessionId]);

    const retry = useCallback((section: AgentHubSection) => {
        setRetrying(list => [...list, section]);
        const request = requestRef.current;
        void fetchers[section]({ _authSessionId: sessionId })
            .then(value => {
                if (!activeRef.current || request !== requestRef.current) return;
                setData(previous => ({ ...previous, [section]: value }));
                setFailed(list => list.filter(item => item !== section));
            })
            .catch(reason => {
                if (activeRef.current && request === requestRef.current && revoked(reason)) setData(previous => ({ ...previous, [section]: null }));
            })
            .finally(() => { if (activeRef.current) setRetrying(list => list.filter(item => item !== section)); });
    }, [sessionId]);

    return { data, failed, retrying, loading, load, retry };
}
