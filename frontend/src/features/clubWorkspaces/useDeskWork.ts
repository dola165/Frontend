import { useCallback, useEffect, useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { OperationRecord } from '../clubOperations/api';
import type { DeskTool } from './registry';
import { canReadScope } from './registry';
import { positiveId } from './api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

export type DeskWorkRecord = Pick<OperationRecord, 'id' | 'club_id' | 'module' | 'title' | 'status' | 'squad_id' | 'due_on'>;

export function useDeskWork(club: number, actor: number, session: AuthSessionId, tool: DeskTool, context: URLSearchParams) {
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ key: string; rows: DeskWorkRecord[]; failure: { cause: unknown } | null }>();
    const query = new URLSearchParams({ module: tool.module, state: 'open', mine: 'false', page: '0' });
    for (const name of ['squad', 'session', 'person']) if (context.has(name)) query.set(name, context.get(name)!);
    const queryString = query.toString(), scopeString = JSON.stringify(tool.scope);
    const key = JSON.stringify([club, actor, session, queryString, scopeString, revision]);
    const refresh = useCallback(() => setRevision(value => value + 1), []);
    useEffect(() => {
        const controller = new AbortController(), moduleScope: DeskTool['scope'] = JSON.parse(scopeString);
        const load = async () => {
            assertCurrentAuthSession(session);
            const config = { signal: controller.signal, _authSessionId: session } satisfies AuthSessionRequestConfig;
            const { data } = await apiClient.get<DeskWorkRecord[]>(`/clubs/${club}/workspace-roles/work?${queryString}`, config);
            assertCurrentAuthSession(session);
            if (!Array.isArray(data) || data.some(row => !row || !positiveId(row.id) || row.club_id !== club || row.module !== moduleScope.module || typeof row.title !== 'string' || typeof row.status !== 'string' || !(row.squad_id === null ? moduleScope.globalRead : positiveId(row.squad_id) && canReadScope(moduleScope, row.squad_id)))) throw new Error('Could not confirm these source records.');
            if (!controller.signal.aborted) setResult({ key, rows: data, failure: null });
        };
        void load().catch(error => {
            if (!controller.signal.aborted && isCurrentAuthSession(session)) setResult({ key, rows: [], failure: { cause: error } });
        });
        return () => controller.abort();
    }, [club, actor, session, queryString, scopeString, key]);
    const current = result?.key === key && isCurrentAuthSession(session) ? result : null;
    return { rows: current?.rows ?? [], loading: !current, error: current?.failure ? extractApiErrorMessage(current.failure.cause, copy('Could not load current work.', 'მიმდინარე საქმეები ვერ ჩაიტვირთა.')) : '', refresh };
}
