import { useCallback, useEffect, useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { OperationRecord } from '../clubOperations/api';
import { isFinished } from '../clubOperations/records/recordStatus';
import type { DeskTool } from './registry';
import { canReadScope } from './registry';
import { positiveId } from './api';
import type { ModuleScope } from './types';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

export type DeskWorkRecord = Pick<OperationRecord, 'id' | 'club_id' | 'module' | 'title' | 'status' | 'squad_id' | 'due_on' | 'expired'>;

/** Soonest due first; undated work after it, in the server's order. */
const byDue = (a: DeskWorkRecord, b: DeskWorkRecord) => (a.due_on ?? '￿').localeCompare(b.due_on ?? '￿');

/** What waits on the job: the open source records of its listed tools, soonest due first, at most five. */
export function useDeskWaiting(club: number, actor: number, session: AuthSessionId, tools: DeskTool[], context: URLSearchParams) {
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ key: string; rows: DeskWorkRecord[]; failure: { cause: unknown } | null }>();
    const narrowing = new URLSearchParams();
    for (const name of ['squad', 'session', 'person']) if (context.has(name)) narrowing.set(name, context.get(name)!);
    const narrowingString = narrowing.toString(), scopesString = JSON.stringify(tools.map(tool => tool.scope));
    const key = JSON.stringify([club, actor, session, narrowingString, scopesString, revision]);
    const refresh = useCallback(() => setRevision(value => value + 1), []);
    useEffect(() => {
        const controller = new AbortController(), scopes: ModuleScope[] = JSON.parse(scopesString);
        const load = async () => {
            assertCurrentAuthSession(session);
            const config = { signal: controller.signal, _authSessionId: session } satisfies AuthSessionRequestConfig;
            const lists = await Promise.all(scopes.map(async scope => {
                const query = new URLSearchParams({ module: scope.module, state: 'open', mine: 'false', page: '0' });
                new URLSearchParams(narrowingString).forEach((value, name) => query.set(name, value));
                const { data } = await apiClient.get<DeskWorkRecord[]>(`/clubs/${club}/workspace-roles/work?${query}`, config);
                assertCurrentAuthSession(session);
                if (!Array.isArray(data) || data.some(row => !row || !positiveId(row.id) || row.club_id !== club || row.module !== scope.module || typeof row.title !== 'string' || typeof row.status !== 'string' || !(row.squad_id === null ? scope.globalRead : positiveId(row.squad_id) && canReadScope(scope, row.squad_id)))) throw new Error('Could not confirm these source records.');
                return data;
            }));
            const rows = lists.flat().filter(row => !isFinished(row.status)).sort(byDue).slice(0, 5);
            if (!controller.signal.aborted) setResult({ key, rows, failure: null });
        };
        void load().catch(error => {
            if (!controller.signal.aborted && isCurrentAuthSession(session)) setResult({ key, rows: [], failure: { cause: error } });
        });
        return () => controller.abort();
    }, [club, actor, session, narrowingString, scopesString, key]);
    const current = result?.key === key && isCurrentAuthSession(session) ? result : null;
    return { rows: current?.rows ?? [], loading: !current, error: current?.failure ? extractApiErrorMessage(current.failure.cause, copy('Could not load what is waiting.', 'მომლოდინე საქმეები ვერ ჩაიტვირთა.')) : '', refresh };
}
