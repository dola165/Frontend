import { useSyncExternalStore } from 'react';

/**
 * The time every score line reads its state against (before kick-off, on now, owed), shared: one timer for every row on
 * screen, ticking every 30 seconds while something listens, so "On now" and "in 2 h" move on without a reload.
 */
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (!timer) {
        now = Date.now();
        timer = setInterval(() => { now = Date.now(); listeners.forEach(notify => notify()); }, 30_000);
    }
    return () => {
        listeners.delete(listener);
        if (!listeners.size && timer) { clearInterval(timer); timer = undefined; }
    };
}

export const useNow = () => useSyncExternalStore(subscribe, () => now, () => now);
