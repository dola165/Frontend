import { useCallback, useEffect, useState } from 'react';
import { onAccessRefresh } from '../../hooks/accessRefresh';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getJobWorkspaces } from './api';
import type { JobWorkspaceManifest } from './types';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

export function useJobWorkspaces(club: number, actor: number, session: AuthSessionId) {
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ scope: string; key: string; data: JobWorkspaceManifest | null; failure: { cause: unknown } | null }>();
    const scope = JSON.stringify([club, actor, session]);
    const key = JSON.stringify([club, actor, session, revision]);
    const refresh = useCallback(() => setRevision(value => value + 1), []);
    useEffect(() => onAccessRefresh(refresh), [refresh]);
    useEffect(() => {
        const controller = new AbortController();
        void getJobWorkspaces(club, actor, session, controller.signal)
            .then(data => { if (!controller.signal.aborted && isCurrentAuthSession(session)) setResult({ scope, key, data, failure: null }); })
            .catch(error => {
                if (controller.signal.aborted || !isCurrentAuthSession(session)) return;
                const status = (error as { response?: { status?: number } } | null)?.response?.status;
                setResult(previous => ({ scope, key, failure: { cause: error },
                    data: previous?.scope === scope && ![401, 403, 404].includes(status ?? 0) ? previous.data : null }));
            });
        return () => controller.abort();
    }, [club, actor, session, scope, key]);
    // Revision freshness gates the UI; it does not own the mounted editor. Identity and confirmed access do.
    const current = result?.scope === scope && isCurrentAuthSession(session) ? result : null;
    const data = current?.data ?? null, pending = current?.key !== key;
    return { data, loading: pending && !data, revalidating: pending && Boolean(data),
        error: !pending && current?.failure ? extractApiErrorMessage(current.failure.cause, copy('Could not load your club workspaces.', 'კლუბში თქვენი სამუშაო სივრცეები ვერ ჩაიტვირთა.')) : '', refresh };
}
