import { useSearchParams } from 'react-router-dom';

/**
 * Reads and writes one tab id in the query string, falling back to the first allowed value.
 * `guard` lets open editors object before a switch unmounts them: it receives the switch and runs it when allowed.
 */
export function useUrlTab<T extends string>(param: string, allowed: readonly T[], fallback: T, guard?: (proceed: () => void) => void): [T, (id: T) => void] {
    const [params, setParams] = useSearchParams();
    const raw = params.get(param);
    const value = raw && (allowed as readonly string[]).includes(raw) ? raw as T : fallback;
    const set = (id: T) => {
        const go = () => setParams(previous => {
            const next = new URLSearchParams(previous);
            if (id === fallback) next.delete(param); else next.set(param, id);
            return next;
        }, { replace: false });
        if (guard && id !== value) guard(go); else go();
    };
    return [value, set];
}
