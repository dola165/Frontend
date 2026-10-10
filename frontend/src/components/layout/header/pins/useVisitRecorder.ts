import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { NavigationCapabilities } from '../../../../context/navigationCapabilities';
import { describeRoute, readPageTitle } from './describeRoute';
import { nameVisit, recordVisit } from './pinStore';

/** Counts page visits on this device so the pins menu can suggest pages the person keeps returning to. */
export function useVisitRecorder(userId: number | undefined, capabilities: NavigationCapabilities | undefined, myClubPath: string | null) {
    const { pathname, search } = useLocation();
    useEffect(() => {
        if (!userId) return;
        const page = describeRoute(pathname, search, { capabilities, userId, myClubPath });
        if (!page.pinnable) return;
        recordVisit(userId, page.path, page.icon, page.label);
        if (page.label) return;
        // Lazy pages render their title after loading; name the visit once it is on screen.
        const timer = window.setTimeout(() => {
            const title = readPageTitle();
            if (title) nameVisit(userId, page.path, title);
        }, 1500);
        return () => window.clearTimeout(timer);
    }, [userId, pathname, search, capabilities, myClubPath]);
}
