import { useSyncExternalStore } from 'react';

const KEY = 'gk-world-filters';
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) === 'top' ? 'top' : 'side'; } catch { return 'side'; } };
const subscribe = (notify: () => void) => {
    listeners.add(notify);
    window.addEventListener('storage', notify);
    return () => { listeners.delete(notify); window.removeEventListener('storage', notify); };
};

/**
 * Where a World page keeps its search, kinds and filters: in a column on the map's left, the map filling the screen
 * (the Map tab's way, and the default everywhere), or in a header row above the map with the list below. The choice
 * is this browser's, remembered for every tab and visit.
 */
export function useWorldLayout() {
    const placement = useSyncExternalStore(subscribe, read, () => 'side' as const);
    const toggle = () => {
        try { localStorage.setItem(KEY, placement === 'side' ? 'top' : 'side'); } catch { /* remembered for this page only */ }
        listeners.forEach(notify => notify());
    };
    return { side: placement === 'side', toggle };
}
