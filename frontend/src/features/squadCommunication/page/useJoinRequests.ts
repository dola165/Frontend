import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';

/** The children waiting for the coach's yes; `null` until the first answer, so an empty list is a real "nobody". */
export function useJoinRequests(space: api.SquadOverview) {
    const [items, setItems] = useState<api.SquadJoinRequest[] | null>(null), [failed, setFailed] = useState(false), [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!space.can_manage) return;
        const abort = new AbortController();
        void api.joinRequests(space.id, abort.signal).then(rows => { if (!abort.signal.aborted) { setItems(rows); setFailed(false); } }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
        return () => abort.abort();
    }, [space.id, space.can_manage, revision]);
    return { items, failed, refresh: useCallback(() => setRevision(n => n + 1), []) };
}

export type JoinRequests = ReturnType<typeof useJoinRequests>;
