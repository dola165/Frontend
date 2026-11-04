import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';

/**
 * What the families of a squad's children chose to tell its coaches, by player. Empty for anyone else: the server refuses
 * them, and a coach with nothing from a family sees nothing here.
 */
export function useCoachNotes(squadIds: number[]): Record<number, string> {
    const [notes, setNotes] = useState<Record<number, string>>({});
    const key = squadIds.join(',');
    useEffect(() => {
        const abort = new AbortController();
        const ids = key ? key.split(',') : [];
        Promise.all(ids.map(id => Promise.resolve(apiClient.get<{ notes: Record<string, string> }>(`/family/squads/${id}/coach-notes`, { signal: abort.signal }))
            .then(response => response?.data?.notes ?? {}).catch(() => ({} as Record<string, string>))))
            .then(found => { if (!abort.signal.aborted) setNotes(Object.assign({}, ...found)); });
        return () => abort.abort();
    }, [key]);
    return notes;
}
