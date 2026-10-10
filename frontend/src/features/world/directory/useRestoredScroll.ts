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
        let frame = 0;
        const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => save(key)); };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); save(key); };
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
