import { useCallback, useSyncExternalStore } from 'react';

/** Phones and narrow windows (the app's phone layout): one column at a time, with ways back. */
export const PHONE = '(max-width: 899px)';

/** Whether a media query matches now, following it as the window changes (false where matchMedia is missing). */
export function useMatches(query: string) {
    const subscribe = useCallback((listener: () => void) => {
        if (typeof window.matchMedia !== 'function') return () => undefined;
        const media = window.matchMedia(query);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);
    return useSyncExternalStore(subscribe, () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches, () => false);
}
