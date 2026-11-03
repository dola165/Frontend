import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api';

export interface SquadNoticeLine { squadId: number; notice: api.NoticeLine }

/**
 * The Notify lines of these squads, newest first (M12): every line with who has seen it for the squads' coaches and
 * staff, the lines sent to the viewer for anyone else. A squad that fails to load leaves the others in view and sets
 * `error`. It loads again when the window comes back into focus, and on `refresh` (after a Notify is sent).
 */
export function useNoticeLines(squadIds: number[], revision = 0) {
    const key = squadIds.join(',');
    const [local, setLocal] = useState(0);
    const [state, setState] = useState<{ key: string; lines: SquadNoticeLine[]; error: boolean } | null>(null);
    const current = `${key}:${revision}:${local}`;
    useEffect(() => {
        const ids = key ? key.split(',').map(Number) : [];
        const abort = new AbortController();
        const load = () => void Promise.allSettled(ids.map(async squadId => (await api.noticeLines(squadId, abort.signal)).map(notice => ({ squadId, notice }))))
            .then(results => {
                if (abort.signal.aborted) return;
                const lines = results.flatMap(r => r.status === 'fulfilled' ? r.value : []).sort((a, b) => Date.parse(b.notice.createdAt) - Date.parse(a.notice.createdAt));
                setState({ key: current, lines, error: results.some(r => r.status === 'rejected') });
            });
        load();
        const again = () => { if (!document.hidden) load(); };
        window.addEventListener('focus', again);
        return () => { abort.abort(); window.removeEventListener('focus', again); };
    }, [key, current]);
    const refresh = useCallback(() => setLocal(n => n + 1), []);
    const ready = state?.key === current || (state != null && state.key.startsWith(`${key}:`));
    return { lines: ready ? state!.lines : [], loading: !ready, error: ready && state!.error, refresh };
}

/**
 * Tells the server the viewer saw these lines on screen, once per line; the server marks only lines sent to them. A
 * failure is quiet; the next view tries again.
 */
export function useMarkSeen(lines: SquadNoticeLine[]) {
    const sent = useRef(new Set<number>());
    const wanted = lines.filter(l => !l.notice.seenByMe && !sent.current.has(l.notice.id));
    const key = wanted.map(l => l.notice.id).join(',');
    useEffect(() => {
        if (!key) return;
        const bySquad = new Map<number, number[]>();
        for (const l of wanted) { sent.current.add(l.notice.id); bySquad.set(l.squadId, [...(bySquad.get(l.squadId) ?? []), l.notice.id]); }
        for (const [squadId, ids] of bySquad) api.markNoticesSeen(squadId, ids).catch(() => ids.forEach(id => sent.current.delete(id)));
        // `key` names exactly the lines in `wanted`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
}
