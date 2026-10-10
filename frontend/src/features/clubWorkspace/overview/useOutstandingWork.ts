import { useEffect, useState } from 'react';
import { get, type OperationRecord } from '../../clubOperations/api';
import { extractApiErrorMessage } from '../../../utils/apiError';

/** Club records whose deadlines or reviews are coming up, optionally for some squads only. */
export function useOutstandingWork(club: number | null, squads: number[] | null) {
    const scope = squads === null ? 'all' : squads.join(',');
    const [revision, setRevision] = useState(0);
    const key = `${club}:${scope}:${revision}`;
    const [result, setResult] = useState<{ key: string; rows: OperationRecord[]; error: string } | null>(null);
    useEffect(() => {
        if (club === null) return;
        const controller = new AbortController();
        const ids = scope === 'all' ? [null] : scope.split(',').filter(Boolean);
        void Promise.all(ids.map(id => get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?module=HOME${id ? `&squad=${id}` : ''}`, controller.signal)))
            .then(lists => {
                if (controller.signal.aborted) return;
                const unique = new Map(lists.flat().map(row => [row.id, row]));
                setResult({ key, rows: [...unique.values()].sort((a, b) => (a.attentionDate ?? a.due_on ?? '9999').localeCompare(b.attentionDate ?? b.due_on ?? '9999')), error: '' });
            })
            .catch(error => { if (!controller.signal.aborted) setResult({ key, rows: [], error: extractApiErrorMessage(error, 'Could not load outstanding work.') }); });
        return () => controller.abort();
    }, [club, scope, key]);
    const current = result?.key === key ? result : null;
    return { rows: current?.rows ?? [], loading: club !== null && !current, error: current?.error ?? '', retry: () => setRevision(value => value + 1) };
}

