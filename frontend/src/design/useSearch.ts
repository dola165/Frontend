import { useEffect, useRef, useState } from 'react';

/** Debounced search: runs `fetcher` for queries of at least `minChars`, aborting stale requests. */
export function useSearch<T>(query: string, fetcher: (query: string, signal: AbortSignal) => Promise<T[]>, minChars = 2, delay = 200) {
    const [state, setState] = useState<{ query: string; status: 'loading' | 'ready' | 'error'; items: T[] }>({ query: '', status: 'ready', items: [] });
    const latest = useRef(fetcher);
    useEffect(() => { latest.current = fetcher; });
    const term = query.trim();
    useEffect(() => {
        if (term.length < minChars) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setState(current => ({ query: term, status: 'loading', items: current.items }));
            latest.current(term, controller.signal)
                .then(items => { if (!controller.signal.aborted) setState({ query: term, status: 'ready', items }); })
                .catch(() => { if (!controller.signal.aborted) setState({ query: term, status: 'error', items: [] }); });
        }, delay);
        return () => { controller.abort(); window.clearTimeout(timer); };
    }, [term, minChars, delay]);
    if (term.length < minChars) return { status: 'idle' as const, items: [] as T[] };
    return state.query === term ? { status: state.status, items: state.items } : { status: 'loading' as const, items: state.items };
}
