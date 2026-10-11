import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { isReturn } from '../history';

/** The first entry of a page load has the key "default" whichever page it is, so it is told apart by its address. */
const entryOf = (key: string, address: string) => key === 'default' ? `default:${address}` : key;
const storageKey = (entry: string) => `gk-world-scroll:${entry}`;
const save = (entry: string) => {
    try { sessionStorage.setItem(storageKey(entry), String(Math.round(window.scrollY))); } catch { /* Scroll memory is a convenience. */ }
};

/**
 * Remembers how far down a directory the person was, per history entry, and returns there on
 * Back or Forward once the results (with every page that was shown) have loaded again. A page
 * opened from its address starts at the top: its load is not a return.
 */
export function useRestoredScroll(ready: boolean) {
    const { key, pathname, search } = useLocation();
    const entry = entryOf(key, pathname + search);
    const navigation = useNavigationType();
    const restored = useRef(false);
    useEffect(() => {
        // A new entry for the same list (more pages shown, a filter) starts where the page is now.
        if (restored.current) save(entry);
        // Until the list is back, scrolling is the page settling (or the browser clamping), not the person.
        // Saving happens as the person scrolls: by the time a page change could be noticed here, the next
        // page has already replaced this one and moved the scroll.
        // A scroll after the address moved on is the next page replacing this one, not the person.
        const onScroll = () => {
            const current = (window.history.state as { key?: string } | null)?.key ?? 'default';
            if (restored.current && current === key) save(entry);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [key, entry]);
    useEffect(() => {
        if (!ready || restored.current) return;
        restored.current = true;
        if (!isReturn(navigation)) return;
        let top = 0;
        try { top = Number(sessionStorage.getItem(storageKey(entry))) || 0; } catch { /* Nothing to restore. */ }
        if (top > 0) window.scrollTo({ top });
    }, [ready, navigation, entry]);
}
