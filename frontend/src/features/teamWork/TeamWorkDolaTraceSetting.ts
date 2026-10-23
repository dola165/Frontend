import { useCallback, useState } from 'react';

const KEY = 'gk.teamWork.dolaTrace';

/** Whether this viewer asked to see how Dola understood each reply. Off by default; remembered in this browser only. */
export function useDolaTraceSetting(): [boolean, (on: boolean) => void] {
    const [on, setOn] = useState(() => {
        try { return window.localStorage.getItem(KEY) === 'on'; } catch { return false; }
    });
    const change = useCallback((next: boolean) => {
        setOn(next);
        try { if (next) window.localStorage.setItem(KEY, 'on'); else window.localStorage.removeItem(KEY); } catch { /* the setting just isn't remembered */ }
    }, []);
    return [on, change];
}
