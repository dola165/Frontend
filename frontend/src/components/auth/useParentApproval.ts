import { useCallback, useEffect, useState } from 'react';
import { fetchParentApproval, type ParentApprovalStatus } from '../../api/parentApproval';
import { appLocale } from '../../utils/formatting';

/** A day as people say it ("26 November"); the server sends a full time or a date. */
export const dayOf = (iso: string) => new Date(iso.length > 10 ? iso : `${iso}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long' });

/**
 * Where a 13 to 15-year-old's account stands while it waits for a parent, as the server has it, read again whenever
 * the page comes back into view (the parent may just have opened the "Add my parent" link). The waiting page and the
 * banner for older accounts use it.
 */
export function useParentApproval() {
    const [request, setRequest] = useState<ParentApprovalStatus | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const load = useCallback((signal?: AbortSignal) => fetchParentApproval(signal)
        .then(found => { setRequest(found); setLoadFailed(false); })
        .catch(() => { if (!signal?.aborted) setLoadFailed(true); }), []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        const again = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', again);
        return () => { controller.abort(); document.removeEventListener('visibilitychange', again); };
    }, [load]);
    const retry = () => { setLoadFailed(false); void load(); };
    return { request, loadFailed, retry, reload: () => void load() };
}
export type ParentApprovalFlow = ReturnType<typeof useParentApproval>;
