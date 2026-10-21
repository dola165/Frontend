import { useSyncExternalStore } from 'react';

const list = (query: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/** Whether a media query matches now, kept current as the window changes. `fallback` is for rendering without one. */
export function useMediaQuery(query: string, fallback = false) {
    return useSyncExternalStore(
        change => { const media = list(query); media?.addEventListener('change', change); return () => media?.removeEventListener('change', change); },
        () => list(query)?.matches ?? fallback,
        () => fallback,
    );
}
