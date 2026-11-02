import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../utils/authStorage';
import { fetchFacilityProject, fetchProjectFacilitySource, type FacilityProjectEntry, type ProjectFacilitySource } from './facilityProjectApi';

// Do not keep last-known source facts visible during a new authority check or after its failure.
function useFacilityRead<T>(identity: string, read: (signal: AbortSignal) => Promise<T>) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId, getAuthSessionId);
    const owner = `${session}:${identity}`;
    const [round, setRound] = useState(0);
    const [state, setState] = useState<{ owner: string; data: T | null; loading: boolean; failed: boolean }>({ owner, data: null, loading: true, failed: false });
    const reload = useCallback(() => { setState({ owner, data: null, loading: true, failed: false }); setRound(n => n + 1); }, [owner]);
    useEffect(() => {
        const controller = new AbortController();
        setState({ owner, data: null, loading: true, failed: false });
        read(controller.signal).then(data => {
            if (!controller.signal.aborted && isCurrentAuthSession(session)) setState({ owner, data, loading: false, failed: false });
        }).catch(() => {
            if (!controller.signal.aborted && isCurrentAuthSession(session)) setState({ owner, data: null, loading: false, failed: true });
        });
        return () => controller.abort();
        // The identity names the read; callbacks are recreated with that identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [owner, round]);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible') reload(); };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [reload]);
    return { ...(state.owner === owner ? state : { data: null, loading: true, failed: false }), reload };
}
export const useFacilityProject = (club: number, task: number) => useFacilityRead<FacilityProjectEntry>(
    `entry:${club}:${task}`, signal => fetchFacilityProject(club, task, signal));
export const useProjectFacilitySource = (club: number, project: number, version: number) => useFacilityRead<ProjectFacilitySource | null>(
    `source:${club}:${project}:${version}`, signal => fetchProjectFacilitySource(club, project, signal));
