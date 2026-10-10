import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useWorldData } from '../useWorldData';
import type { WorldMapPoint } from '../map/WorldMap';
import type { AnySource, DirectoryQuery, DirectoryView } from './types';

interface Loaded { key: string; attempt: number; items: unknown[]; total: number | null; hasMore: boolean; page: number; error: string }

/**
 * Loads one directory source for the current query: the first page on every query change,
 * further pages on request. Results of an older query are never shown as current.
 */
export function useDirectoryData(source: AnySource, query: DirectoryQuery, view: DirectoryView, gated: boolean) {
    const { sessionId, status } = useAuth();
    const authenticated = status === 'authenticated';
    const key = gated || status === 'bootstrapping' ? null : `${source.id}|${source.version ?? ''}|${sessionId}|${JSON.stringify(query)}`;
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<Loaded>();
    const [more, setMore] = useState<{ key: string; busy: boolean; error: string }>();
    const moreController = useRef<AbortController | null>(null);
    const loadPage = useEffectEvent((page: number, signal: AbortSignal) => source.load(query, page, { signal, sessionId, authenticated }));

    useEffect(() => {
        if (!key) return;
        const controller = new AbortController();
        moreController.current?.abort();
        void loadPage(0, controller.signal)
            .then(page => { if (!controller.signal.aborted) setLoaded({ key, attempt, items: page.items, total: page.total, hasMore: page.hasMore, page: 0, error: '' }); })
            .catch(cause => { if (!controller.signal.aborted) setLoaded({ key, attempt, items: [], total: null, hasMore: false, page: 0, error: extractApiErrorMessage(cause, `${source.label} could not load.`) }); });
        return () => controller.abort();
    }, [key, attempt, source.label]);

    const current = loaded && loaded.key === key && loaded.attempt === attempt ? loaded : undefined;
    const loadMore = () => {
        if (!current || !key || (more?.key === key && more.busy)) return;
        const controller = new AbortController();
        moreController.current = controller;
        setMore({ key, busy: true, error: '' });
        void source.load(query, current.page + 1, { signal: controller.signal, sessionId, authenticated })
            .then(page => {
                if (controller.signal.aborted) return;
                setLoaded(previous => previous && previous.key === key ? { ...previous, items: [...previous.items, ...page.items], hasMore: page.hasMore, total: page.total ?? previous.total, page: previous.page + 1 } : previous);
                setMore({ key, busy: false, error: '' });
            })
            .catch(cause => { if (!controller.signal.aborted) setMore({ key, busy: false, error: extractApiErrorMessage(cause, 'More results could not load.') }); });
    };

    const wantsPoints = view !== 'list' && Boolean(source.loadPoints) && key !== null;
    const coords = useWorldData(wantsPoints ? `points|${source.id}|${JSON.stringify(query)}` : null,
        signal => source.loadPoints!(query, { signal, sessionId, authenticated }));
    const points: WorldMapPoint[] = source.point && current
        ? current.items.map(item => source.point!(item, coords.data?.get(source.key(item)))).filter((point): point is WorldMapPoint => Boolean(point))
        : [];

    return {
        items: current?.items ?? [],
        total: current?.total ?? null,
        hasMore: current?.hasMore ?? false,
        loading: key !== null && !current,
        error: current?.error ?? '',
        retry: () => setAttempt(value => value + 1),
        loadMore,
        loadingMore: more?.key === key && more.busy,
        moreError: more?.key === key ? more.error : '',
        points,
        pointsLoading: wantsPoints && coords.loading,
    };
}
