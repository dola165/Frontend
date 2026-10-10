import { useSearchParams, type NavigateOptions } from 'react-router-dom';

/**
 * The page's URL parameters seen through a prefix, so a tool opened inside another page (a drawer beside a
 * player) keeps its own search, filters, sort, page and open record in the URL without colliding with the
 * page's: with scope `tool`, `tool.q` reads as `q`. Without a scope it is the page's own parameters.
 * Returns the parameters, a setter, and the href of a changed copy (for links).
 */
export function useScopedSearchParams(scope?: string) {
    const [params, setParams] = useSearchParams();
    const prefix = scope ? `${scope}.` : '';
    const own = prefix ? new URLSearchParams([...params].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value])) : params;
    const merged = (next: URLSearchParams) => {
        if (!prefix) return next;
        const all = new URLSearchParams([...params].filter(([key]) => !key.startsWith(prefix)));
        next.forEach((value, key) => all.append(prefix + key, value));
        return all;
    };
    return [own, (next: URLSearchParams, options?: NavigateOptions) => setParams(merged(next), options), (next: URLSearchParams) => `?${merged(next)}`] as const;
}

/** A copy of the parameters without a scope: its key (`tool`) and everything under it (`tool.q`, `tool.record`). */
export function withoutScope(params: URLSearchParams, scope: string) {
    return new URLSearchParams([...params].filter(([key]) => key !== scope && !key.startsWith(`${scope}.`)));
}
