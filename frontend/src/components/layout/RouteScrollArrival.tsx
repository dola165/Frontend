import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Mount inside Suspense so a pending route cannot reset the page the person is still leaving. */
export function RouteScrollArrival({ family }: { family: string }) {
    const { pathname, hash } = useLocation();
    const navigation = useNavigationType();
    const arrived = useRef<string | null>(null);
    useLayoutEffect(() => {
        const changed = arrived.current !== pathname;
        arrived.current = pathname;
        // POP belongs to native history/feature restoration; World and anchors own their scroll.
        if (!changed || navigation === 'POP' || family === 'world' || hash) return;
        window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    }, [pathname, hash, navigation, family]);
    return null;
}
