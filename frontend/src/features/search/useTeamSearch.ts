import { useCallback, useEffect, useState } from 'react';
import { fetchBestMatches, searchTeam, type BestMatches, type SearchGroup, type SearchResults } from './api';

/** Typing pauses this long before a search goes out; a newer search cancels the one before. */
export const SEARCH_DELAY = 200;
/** The words stay the same this long before the best matches are asked for (a paid call, only for vague searches). */
export const BEST_DELAY = 700;
const MORE = 10;

type Found = { query: string; status: 'loading' | 'ready' | 'error'; results: SearchResults | null };
export type BestState = { query: string; status: 'asking' | 'ready' | 'failed'; answer: BestMatches | null };

const key = (kind: string, id: number) => `${kind}:${id}`;

/**
 * Team work search as someone types: the free results first, then, for a vague search only, the best matches.
 * Results of an older search are kept on screen (marked as such) until the new ones arrive.
 */
export function useTeamSearch(query: string) {
    const term = query.trim();
    const [found, setFound] = useState<Found>({ query: '', status: 'ready', results: null });
    const [best, setBest] = useState<BestState | null>(null);
    const [loadingMore, setLoadingMore] = useState<SearchGroup | null>(null);

    useEffect(() => {
        if (!term) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setFound(current => ({ query: term, status: 'loading', results: current.results }));
            searchTeam(term, controller.signal)
                .then(results => { if (!controller.signal.aborted) setFound({ query: term, status: 'ready', results }); })
                .catch(() => { if (!controller.signal.aborted) setFound(current => ({ query: term, status: 'error', results: current.results })); });
        }, SEARCH_DELAY);
        return () => { controller.abort(); window.clearTimeout(timer); };
    }, [term]);

    const ask = found.status === 'ready' && found.query === term && found.results?.askBest === true;
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
        const current = found.results?.groups.find(candidate => candidate.group === group);
        if (!current || found.query !== term) return;
        setLoadingMore(group);
        try {
            const page = await searchTeam(term, undefined, { group, offset: current.hits.length, limit: MORE });
            const next = page.groups.find(candidate => candidate.group === group);
            setFound(state => {
                if (state.query !== term || !state.results || !next) return state;
                return { ...state, results: { ...state.results, groups: state.results.groups.map(candidate => {
                    if (candidate.group !== group) return candidate;
                    const seen = new Set(candidate.hits.map(hit => key(hit.kind, hit.id)));
                    return { ...candidate, hits: [...candidate.hits, ...next.hits.filter(hit => !seen.has(key(hit.kind, hit.id)))], more: next.more };
                }) } };
            });
        } catch { /* the button stays; trying again is the person's call */ }
        finally { setLoadingMore(null); }
    }, [found, term]);

    if (!term) return { status: 'idle' as const, results: null, stale: false, best: null, loadingMore, loadMore };
    const stale = found.query !== term;
    return {
        status: stale ? 'loading' as const : found.status,
        results: found.results,
        stale,
        best: best?.query === term ? best : null,
        loadingMore,
        loadMore,
    };
}
