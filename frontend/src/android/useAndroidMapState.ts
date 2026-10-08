import { useEffect, useState } from 'react';
import { isAndroidApp } from './bridge';

/** Account-isolated app origin. Keep discovery context when the native tab is recreated. */
export function useAndroidMapState<T>(name: string, initial: T) {
    const key = `android.map.v1.${name}`;
    const [value, setValue] = useState<T>(() => {
        if (!isAndroidApp) return initial;
        try {
            const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
            if (stored === null || (initial !== null && (typeof stored !== typeof initial || Array.isArray(stored) !== Array.isArray(initial)))) return initial;
            return stored as T;
        } catch { return initial; }
    });
    useEffect(() => {
        if (isAndroidApp) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage full: the current map remains usable. */ } }
    }, [key, value]);
    return [value, setValue] as const;
}
