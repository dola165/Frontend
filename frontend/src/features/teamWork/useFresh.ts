import { useState } from 'react';

const NONE = new Set<string>();

/**
 * Which of these keys were not there the last time they changed: a row just added, or (with the status in its key)
 * just moved, so the page can mark it for a moment. Nothing is fresh on the first load, or while `keys` is null.
 */
export function useFresh(keys: string[] | null): Set<string> {
    const signature = keys?.join('|') ?? null;
    const [state, setState] = useState<{ signature: string | null; seen: Set<string> | null; fresh: Set<string> }>({ signature: null, seen: null, fresh: NONE });
    if (keys && signature !== state.signature) {
        const fresh = state.seen ? new Set(keys.filter(key => !state.seen!.has(key))) : NONE;
        setState({ signature, seen: new Set(keys), fresh });
        return fresh;
    }
    return state.fresh;
}
