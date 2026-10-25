import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether an element has come on screen (or close to it): a picture in a long grid is fetched only then. Once near,
 * it stays loaded. Where IntersectionObserver is missing, everything counts as near.
 */
export function useNearView(ref: RefObject<Element | null>, margin = '300px') {
    const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        const element = ref.current;
        if (near || !element) return;
        const observer = new IntersectionObserver(entries => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            setNear(true);
            observer.disconnect();
        }, { rootMargin: margin });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, margin, near]);
    return near;
}
