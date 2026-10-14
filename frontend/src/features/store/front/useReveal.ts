import { useEffect, useRef } from 'react';

/**
 * Sections of a landing page come in as they scroll into view: everything marked `data-reveal` under the returned
 * element gets `data-shown` once it has been seen, and the stylesheet eases it in. Shown at once without
 * IntersectionObserver or under reduced motion.
 */
export function useReveal<T extends HTMLElement>() {
    const root = useRef<T>(null);
    useEffect(() => {
        const element = root.current;
        if (!element) return;
        const show = (target: HTMLElement) => target.setAttribute('data-shown', '');
        const pending = () => [...element.querySelectorAll<HTMLElement>('[data-reveal]:not([data-shown])')];
        if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            pending().forEach(show);
            if (typeof MutationObserver === 'undefined') return;
            const all = new MutationObserver(() => pending().forEach(show));
            all.observe(element, { childList: true, subtree: true });
            return () => all.disconnect();
        }
        const seen = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { show(entry.target as HTMLElement); seen.unobserve(entry.target); } }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
        const watched = new WeakSet<HTMLElement>();
        const inView = (target: HTMLElement) => { const box = target.getBoundingClientRect(); return box.bottom > 0 && box.top < window.innerHeight * 0.9; };
        // What is already on screen shows at once; the observer takes the rest as the page scrolls.
        const watch = () => { for (const target of pending()) { if (inView(target)) show(target); else if (!watched.has(target)) { watched.add(target); seen.observe(target); } } };
        watch();
        const added = new MutationObserver(watch);
        added.observe(element, { childList: true, subtree: true });
        return () => { seen.disconnect(); added.disconnect(); };
    }, []);
    return root;
}
