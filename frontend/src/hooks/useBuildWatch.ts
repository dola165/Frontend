import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { announceBuild, BUILD_CHECK_MS, checkBuild, reloadForBuild, runningBuild, staleBuild } from '../utils/buildVersion';

/**
 * Keeps an open tab on the build the site serves: it asks when the tab comes back into view or regains focus (at most
 * every few minutes) and learns from a newer tab starting. Once out of date it reloads on the next navigation, or at
 * once while signed out, so an old tab never keeps working against a newer release.
 */
export function useBuildWatch(signedOut: boolean) {
    const location = useLocation();
    const [stale, setStale] = useState(false);

    useEffect(() => {
        if (!runningBuild()) return;
        announceBuild();
        const check = () => { if (document.visibilityState === 'visible') void checkBuild().then(setStale); };
        const learn = (event: StorageEvent) => { if (event.key === 'gk-build') setStale(staleBuild()); };
        const timer = window.setInterval(check, BUILD_CHECK_MS);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        window.addEventListener('storage', learn);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', check);
            document.removeEventListener('visibilitychange', check);
            window.removeEventListener('storage', learn);
        };
    }, []);

    // The next navigation loads the new build instead of the page asked for in the old one.
    const shown = useRef(location.key);
    useEffect(() => {
        if (shown.current === location.key) return;
        shown.current = location.key;
        if (staleBuild()) reloadForBuild();
    }, [location.key]);

    useEffect(() => { if (signedOut && stale) reloadForBuild(); }, [signedOut, stale]);
}
