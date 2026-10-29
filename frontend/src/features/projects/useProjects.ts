import { useCallback, useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { fetchMyProjects, fetchProjectById, fetchProjects, type MyProjects, type ProjectBoard, type ProjectDetail } from './api';

/** One read with its loading and failure kept apart, and a way to replace it with a fresher answer. */
export interface Loaded<T> { data: T | null; loading: boolean; error: string; notFound: boolean; reload: () => void; put: (next: T) => void }

function useLoaded<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Loaded<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(key !== null);
    const [error, setError] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [round, setRound] = useState(0);
    useEffect(() => {
        if (key === null) { setLoading(false); return; }
        const controller = new AbortController();
        setLoading(true); setError(''); setNotFound(false);
        load(controller.signal).then(answer => { if (!controller.signal.aborted) setData(answer); })
            .catch(failure => {
                if (controller.signal.aborted) return;
                const status = (failure as { response?: { status?: number } })?.response?.status;
                if (status === 404) { setNotFound(true); setData(null); } else setError(extractApiErrorMessage(failure, 'This could not load.'));
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
        // The key names the read; `load` changes with it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, round]);
    const reload = useCallback(() => setRound(value => value + 1), []);
    return { data, loading, error, notFound, reload, put: setData };
}

/** The clubs where the person has projects or may start one. */
export const useMyProjects = (enabled = true) => useLoaded<MyProjects[]>(enabled ? 'mine' : null, fetchMyProjects);
/** One club's Projects page. */
export const useBoard = (clubId: number | null) => useLoaded<ProjectBoard>(clubId ? `board:${clubId}` : null, signal => fetchProjects(clubId!, signal));
/** One project, by its id alone. */
export const useProject = (id: number | null) => useLoaded<ProjectDetail>(id ? `project:${id}` : null, signal => fetchProjectById(id!, signal));
