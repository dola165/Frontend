import { useCallback, useEffect, useState } from 'react';
import { fetchBestMatches, searchTeam, type BestMatches, type SearchGroup, type SearchResults } from './api';

/** Typing pauses this long before a search goes out; a newer search cancels the one before. */
export const SEARCH_DELAY = 200;
/** The words stay the same this long before the best matches are asked for (a paid call, only for vague searches). */
export const BEST_DELAY = 700;
const MORE = 10;

/** Results, with the words (and the deleted-chats switch) they were found for. */
type Shown = { query: string; deleted: boolean; results: SearchResults };
type Found = { query: string; deleted: boolean; status: 'loading' | 'ready' | 'error'; shown: Shown | null };
export type BestState = { query: string; status: 'asking' | 'ready' | 'failed'; answer: BestMatches | null };

const key = (kind: string, id: number) => `${kind}:${id}`;

/**
 * Team work search as someone types: the free results first, then, for a vague search only, the best matches.
 * Results of older words are kept on screen until the new ones arrive, and said to be stale (`stale`), also when the
 * new search failed: only results for the words now typed are `fresh`. `deleted`: also the person's chats in Recently
 * deleted (their results come after the live ones; the best matches never include them).
 */
export function useTeamSearch(query: string, deleted = false) {
    const term = query.trim();
    const [found, setFound] = useState<Found>({ query: '', deleted: false, status: 'ready', shown: null });
    const [best, setBest] = useState<BestState | null>(null);
    const [loadingMore, setLoadingMore] = useState<SearchGroup | null>(null);

    useEffect(() => {
        if (!term) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setFound(current => ({ ...current, query: term, deleted, status: 'loading' }));
            searchTeam(term, controller.signal, undefined, deleted)
                .then(results => { if (!controller.signal.aborted) setFound({ query: term, deleted, status: 'ready', shown: { query: term, deleted, results } }); })
                .catch(() => { if (!controller.signal.aborted) setFound(current => ({ ...current, query: term, deleted, status: 'error' })); });
        }, SEARCH_DELAY);
        return () => { controller.abort(); window.clearTimeout(timer); };
    }, [term, deleted]);

    const stale = !found.shown || found.shown.query !== term || found.shown.deleted !== deleted;
    const ask = !stale && found.status === 'ready' && found.shown?.results.askBest === true;
    useEffect(() => {
        if (!ask) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setBest({ query: term, status: 'asking', answer: null });
            fetchBestMatches(term, controller.signal)
                .then(answer => { if (!controller.signal.aborted) setBest({ query: term, status: 'ready', answer }); })
                .catch(() => { if (!controller.signal.aborted) setBest({ query: term, status: 'failed', answer: null }); });
        }, BEST_DELAY);
        return () => { controller.abort(); window.clearTimeout(timer); };
    }, [ask, term]);

    /** Ten more of one group. */
    const loadMore = useCallback(async (group: SearchGroup) => {
        const shown = found.shown;
        const current = shown?.results.groups.find(candidate => candidate.group === group);
        if (!shown || !current || shown.query !== term || shown.deleted !== deleted) return;
        setLoadingMore(group);
        try {
            const page = await searchTeam(term, undefined, { group, offset: current.hits.length, limit: MORE }, deleted);
            const next = page.groups.find(candidate => candidate.group === group);
            setFound(state => {
                const now = state.shown;
                if (!now || now.query !== term || now.deleted !== deleted || !next) return state;
                return { ...state, shown: { ...now, results: { ...now.results, groups: now.results.groups.map(candidate => {
                    if (candidate.group !== group) return candidate;
                    const seen = new Set(candidate.hits.map(hit => key(hit.kind, hit.id)));
                    return { ...candidate, hits: [...candidate.hits, ...next.hits.filter(hit => !seen.has(key(hit.kind, hit.id)))], more: next.more };
                }) } } };
            });
        } catch { /* the button stays; trying again is the person's call */ }
        finally { setLoadingMore(null); }
    }, [found, term, deleted]);

    if (!term) return { status: 'idle' as const, results: null, stale: false, fresh: false, best: null, loadingMore, loadMore };
    const asked = found.query === term && found.deleted === deleted;
    const status = asked ? found.status : 'loading' as const;
    return {
        status,
        results: found.shown?.results ?? null,
        stale,
        fresh: !stale && status === 'ready',
        best: best?.query === term ? best : null,
        loadingMore,
        loadMore,
    };
}
