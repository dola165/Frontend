import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { wt } from '../copy';
import { useWorldData } from '../useWorldData';
import type { WorldMapPoint } from '../map/WorldMap';
import type { AnySource, DirectoryPage, DirectoryQuery, DirectoryView, LoadContext } from './types';

interface Loaded { key: string; attempt: number; items: unknown[]; total: number | null; hasMore: boolean; page: number; error: string; notice: string }

/** Loads pages 0..count-1 one after another and joins them, so a list can come back as long as it was. */
export async function loadPages(source: AnySource, query: DirectoryQuery, count: number, context: LoadContext) {
    let result: DirectoryPage<unknown> = await source.load(query, 0, context);
    let page = 0;
    while (page + 1 < count && result.hasMore && !result.notice && !context.signal.aborted) {
        const next = await source.load(query, page + 1, context);
        result = { ...next, items: [...result.items, ...next.items], total: next.total ?? result.total };
        page += 1;
    }
    return { ...result, page };
}

/** A search with an end date before its start date cannot match anything; say so instead of asking. */
export const invalidRange = (source: AnySource, query: DirectoryQuery) => {
    const from = query.values.from?.[0], to = query.values.to?.[0];
    return source.filters.some(filter => filter.kind === 'date' && filter.key === 'from') && Boolean(from && to && from > to);
};

/**
 * Loads one directory source for the current query: the first `pages` pages on every query
 * change, further pages on request. Results of an older query are never shown as current.
 */
export function useDirectoryData(source: AnySource, query: DirectoryQuery, view: DirectoryView, gated: boolean, { pages = 1, onPages }: { pages?: number; onPages?: (count: number) => void } = {}) {
    const { sessionId, status } = useAuth();
    const authenticated = status === 'authenticated';
    const badRange = invalidRange(source, query);
    const key = gated || badRange || status === 'bootstrapping' ? null : `${source.id}|${source.version ?? ''}|${sessionId}|${JSON.stringify(query)}`;
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<Loaded>();
    const [more, setMore] = useState<{ key: string; busy: boolean; error: string }>();
    const moreController = useRef<AbortController | null>(null);
    // The number of pages to restore is read when a query loads, not tracked: showing more never reloads.
    const firstLoad = useEffectEvent((signal: AbortSignal) => loadPages(source, query, pages, { signal, sessionId, authenticated }));

    useEffect(() => {
        if (!key) return;
        const controller = new AbortController();
        moreController.current?.abort();
        void firstLoad(controller.signal)
            .then(result => { if (!controller.signal.aborted) setLoaded({ key, attempt, items: result.items, total: result.total, hasMore: result.hasMore, page: result.page, error: '', notice: result.notice ?? '' }); })
            .catch(cause => { if (!controller.signal.aborted) setLoaded({ key, attempt, items: [], total: null, hasMore: false, page: 0, error: extractApiErrorMessage(cause, wt('{label} could not load.', { label: wt(source.label) })), notice: '' }); });
        return () => controller.abort();
    }, [key, attempt, source.label]);

    // A live list reloads what is on screen in the background; a failed refresh keeps the last results.
    const refresh = useEffectEvent((signal: AbortSignal) => {
        if (!key || !loaded || loaded.key !== key || loaded.error || (more?.key === key && more.busy)) return;
        void loadPages(source, query, loaded.page + 1, { signal, sessionId, authenticated })
            .then(result => { if (!signal.aborted) setLoaded(previous => previous && previous.key === key ? { ...previous, items: result.items, total: result.total, hasMore: result.hasMore, page: result.page, notice: result.notice ?? '' } : previous); })
            .catch(() => undefined);
    });
    useEffect(() => {
        if (!key || !source.refreshMs) return;
        let controller: AbortController | null = null;
        const run = () => {
            if (document.visibilityState === 'hidden') return;
            controller?.abort();
            controller = new AbortController();
            refresh(controller.signal);
        };
        const timer = window.setInterval(run, source.refreshMs);
        window.addEventListener('focus', run);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', run); controller?.abort(); };
    }, [key, source.refreshMs]);

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
                onPages?.(current.page + 2);
            })
            .catch(cause => { if (!controller.signal.aborted) setMore({ key, busy: false, error: extractApiErrorMessage(cause, wt('More results could not load.')) }); });
    };

    const wantsPoints = view !== 'list' && Boolean(source.loadPoints) && key !== null;
    const pointsKey = source.pointsKey ? source.pointsKey(query) : JSON.stringify(query);
    const coords = useWorldData(wantsPoints ? `points|${source.id}|${source.version ?? ''}|${pointsKey}` : null,
        signal => source.loadPoints!(query, { signal, sessionId, authenticated }));
    const items = current?.items;
    // One array per set of results and positions, so the map does not refit on every render.
    const points = useMemo<WorldMapPoint[]>(() => source.point && items
        ? items.map(item => source.point!(item, coords.data?.get(source.key(item)))).filter((point): point is WorldMapPoint => Boolean(point))
        : [], [source, items, coords.data]);

    return {
        items: items ?? [],
        total: current?.total ?? null,
        hasMore: current?.hasMore ?? false,
        loading: key !== null && !current,
        error: current?.error ?? '',
        notice: badRange ? wt('The end date is before the start date. Change one of them to search.') : current?.notice ?? '',
        retry: () => setAttempt(value => value + 1),
        loadMore,
        loadingMore: more?.key === key && more.busy,
        moreError: more?.key === key ? more.error : '',
        points,
        pointsLoading: wantsPoints && coords.loading,
    };
}
export type DirectoryData = ReturnType<typeof useDirectoryData>;
