import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const storageKey = (key: string) => `gk-world-scroll:${key}`;
const save = (key: string) => {
    try { sessionStorage.setItem(storageKey(key), String(Math.round(window.scrollY))); } catch { /* Scroll memory is a convenience. */ }
};

/**
 * Remembers how far down a directory the person was, per history entry, and returns there on
 * Back or Forward once the results (with every page that was shown) have loaded again.
 */
export function useRestoredScroll(ready: boolean) {
    const { key } = useLocation();
    const navigation = useNavigationType();
    const restored = useRef(false);
    useEffect(() => {
        // A new entry for the same list (more pages shown, a filter) starts where the page is now.
        if (restored.current) save(key);
        // Until the list is back, scrolling is the page settling (or the browser clamping), not the person.
        // Saving happens as the person scrolls: by the time a page change could be noticed here, the next
        // page has already replaced this one and moved the scroll.
        // A scroll after the address moved on is the next page replacing this one, not the person.
        const onScroll = () => {
            const entry = (window.history.state as { key?: string } | null)?.key;
            if (restored.current && (entry === undefined || entry === key)) save(key);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [key]);
    useEffect(() => {
        if (!ready || restored.current) return;
        restored.current = true;
        if (navigation !== 'POP') return;
        let top = 0;
        try { top = Number(sessionStorage.getItem(storageKey(key))) || 0; } catch { /* Nothing to restore. */ }
        if (top > 0) window.scrollTo({ top });
    }, [ready, navigation, key]);
}
