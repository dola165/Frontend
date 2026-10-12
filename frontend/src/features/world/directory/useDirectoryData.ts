import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { WORLD_CHANGED } from '../cache';
import { wt } from '../copy';
import { useWorldArea, type WorldArea } from '../useWorldArea';
import type { AnySource, DirectoryArea, DirectoryPage, DirectoryQuery, LoadContext } from './types';

/**
 * The area a source follows: none for sources that ignore it, a null city for "Anywhere". A list the area only orders
 * (`'nearest'`) keeps the person's own centre even for "Anywhere", so the nearest still come first.
 */
export const directoryArea = (source: AnySource, area: WorldArea): DirectoryArea | undefined =>
    source.area === 'nearest' ? { city: area.anywhere ? null : area.city, centre: area.centre }
        : source.area ? { city: area.anywhere ? null : area.city, centre: area.anywhere ? null : area.centre } : undefined;

/** One empty list for every source with no results yet, so the map does not refit on every render. */
const NO_ITEMS: unknown[] = [];

interface Loaded { key: string; attempt: number; items: unknown[]; total: number | null; hasMore: boolean; page: number; error: string; notice: string; /** When the list was last loaded or refreshed. */ checkedAt?: number }

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
export function useDirectoryData(source: AnySource, query: DirectoryQuery, gated: boolean, { pages = 1, onPages }: { pages?: number; onPages?: (count: number) => void } = {}) {
    const { sessionId, status } = useAuth();
    const authenticated = status === 'authenticated';
    const badRange = invalidRange(source, query);
    const { area: worldArea } = useWorldArea();
    // A list that follows the area waits until the person's area is known (and, to put the nearest first, located),
    // so it loads once, for the right place.
    const area = directoryArea(source, worldArea);
    const waiting = Boolean(source.area) && (!worldArea.ready || (source.area === 'nearest' && !worldArea.centre));
    const key = gated || badRange || waiting || status === 'bootstrapping' ? null
        : `${source.id}|${source.version ?? ''}|${sessionId}|${area ? `${area.city ?? 'anywhere'}@${area.centre ? `${area.centre.lat},${area.centre.lng}` : ''}` : ''}|${JSON.stringify(query)}`;
    const [attempt, setAttempt] = useState(0);
    const pagesRef = useRef(onPages);
    useEffect(() => { pagesRef.current = onPages; });
    const [loaded, setLoaded] = useState<Loaded>();
    const [more, setMore] = useState<{ key: string; busy: boolean; error: string }>();
    const moreController = useRef<AbortController | null>(null);
    // The number of pages to restore is read when a query loads, not tracked: showing more never reloads.
    const firstLoad = useEffectEvent((signal: AbortSignal) => loadPages(source, query, pages, { signal, sessionId, authenticated, area }));

    useEffect(() => {
        if (!key) return;
        const controller = new AbortController();
        moreController.current?.abort();
        void firstLoad(controller.signal)
            .then(result => { if (!controller.signal.aborted) setLoaded({ key, attempt, items: result.items, total: result.total, hasMore: result.hasMore, page: result.page, error: '', notice: result.notice ?? '', checkedAt: Date.now() }); })
            .catch(cause => { if (!controller.signal.aborted) setLoaded({ key, attempt, items: [], total: null, hasMore: false, page: 0, error: extractApiErrorMessage(cause, wt('{label} could not load.', { label: wt(source.label) })), notice: '' }); });
        return () => controller.abort();
    }, [key, attempt, source.label]);

    // A live list reloads what is on screen in the background; a failed refresh keeps the last results.
    const refresh = useEffectEvent((signal: AbortSignal) => {
        if (!key || !loaded || loaded.key !== key || loaded.error || (more?.key === key && more.busy)) return;
        void loadPages(source, query, loaded.page + 1, { signal, sessionId, authenticated, area })
            .then(result => { if (!signal.aborted) setLoaded(previous => previous && previous.key === key ? { ...previous, items: result.items, total: result.total, hasMore: result.hasMore, page: result.page, notice: result.notice ?? '', checkedAt: Date.now() } : previous); })
            .catch(() => undefined);
    });
    const every = typeof source.refreshMs === 'function' ? source.refreshMs(query) : source.refreshMs;
    useEffect(() => {
        if (!key) return;
        let controller: AbortController | null = null;
        const run = () => {
            if (document.visibilityState === 'hidden') return;
            controller?.abort();
            controller = new AbortController();
            refresh(controller.signal);
        };
        // Something changed elsewhere in World (a result confirmed in a drawer): every list reloads quietly.
        window.addEventListener(WORLD_CHANGED, run);
        const timer = every ? window.setInterval(run, every) : undefined;
        if (every) window.addEventListener('focus', run);
        return () => { window.clearInterval(timer); window.removeEventListener(WORLD_CHANGED, run); window.removeEventListener('focus', run); controller?.abort(); };
    }, [key, every]);

    const current = loaded && loaded.key === key && loaded.attempt === attempt ? loaded : undefined;
    const loadMore = () => {
        if (!current || !key || (more?.key === key && more.busy)) return;
        const controller = new AbortController();
        moreController.current = controller;
        setMore({ key, busy: true, error: '' });
        void source.load(query, current.page + 1, { signal: controller.signal, sessionId, authenticated, area })
            .then(page => {
                if (controller.signal.aborted) return;
                setLoaded(previous => previous && previous.key === key ? { ...previous, items: [...previous.items, ...page.items], hasMore: page.hasMore, total: page.total ?? previous.total, page: previous.page + 1 } : previous);
                setMore({ key, busy: false, error: '' });
                // The page count is written with the address as it is now: a choice made meanwhile stays.
                pagesRef.current?.(current.page + 2);
            })
            .catch(cause => { if (!controller.signal.aborted) setMore({ key, busy: false, error: extractApiErrorMessage(cause, wt('More results could not load.')) }); });
    };

    return {
        items: current?.items ?? NO_ITEMS,
        total: current?.total ?? null,
        hasMore: current?.hasMore ?? false,
        // Waiting for the person's area is loading too: an empty list then would say "none near Tbilisi" wrongly.
        loading: waiting || (key !== null && !current),
        error: current?.error ?? '',
        notice: badRange ? wt('The end date is before the start date. Change one of them to search.') : current?.notice ?? '',
        retry: () => setAttempt(value => value + 1),
        loadMore,
        loadingMore: more?.key === key && more.busy,
        moreError: more?.key === key ? more.error : '',
        /** When the list was last loaded or quietly refreshed. */
        checkedAt: current?.checkedAt,
        /** The area the results were narrowed to, once it is known, if the source is narrowed by area. */
        area: waiting ? undefined : area,
    };
}
export type DirectoryData = ReturnType<typeof useDirectoryData>;
