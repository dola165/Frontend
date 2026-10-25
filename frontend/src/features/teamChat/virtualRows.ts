import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** How far beyond the visible part a message stays drawn, so scrolling never shows a blank. */
const MARGIN = '1200px 0px';

const same = (a: ReadonlySet<number>, b: ReadonlySet<number>) => a.size === b.size && [...a].every(id => b.has(id));

/**
 * Which messages are drawn: only those near the visible part of the list. A message far away is kept as an empty
 * block of its own measured height, so the scroll position, the scrollbar and "jump to a message" stay exact, and
 * its pictures are let go (they load again when it comes back). Without IntersectionObserver (tests, old browsers)
 * everything is drawn.
 */
export function useVirtualRows(root: RefObject<HTMLElement | null>) {
    const heights = useRef(new Map<number, number>());
    const away = useRef(new Set<number>());
    const elements = useRef(new Map<Element, number>());
    const observers = useRef<{ near: IntersectionObserver; size: ResizeObserver } | null>(null);
    const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());

    // Hidden = far away and already measured (a block of the right height can take its place).
    const publish = useCallback(() => setHidden(current => {
        const next = new Set([...away.current].filter(id => heights.current.has(id)));
        return same(next, current) ? current : next;
    }), []);

    useEffect(() => {
        const element = root.current;
        if (!element || typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined') return;
        const size = new ResizeObserver(entries => {
            for (const entry of entries) {
                const id = elements.current.get(entry.target);
                const target = entry.target as HTMLElement;
                if (id === undefined || target.dataset.placeholder !== undefined) continue;
                heights.current.set(id, target.offsetHeight);
            }
            publish();
        });
        const near = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const id = elements.current.get(entry.target);
                if (id === undefined) continue;
                if (entry.isIntersecting) away.current.delete(id); else away.current.add(id);
            }
            publish();
        }, { root: element, rootMargin: MARGIN });
        observers.current = { near, size };
        for (const target of elements.current.keys()) { near.observe(target); size.observe(target); }
        return () => { near.disconnect(); size.disconnect(); observers.current = null; };
    }, [root, publish]);

    const watch = useCallback((id: number, element: Element) => {
        elements.current.set(element, id);
        observers.current?.near.observe(element);
        observers.current?.size.observe(element);
        return () => {
            elements.current.delete(element);
            observers.current?.near.unobserve(element);
            observers.current?.size.unobserve(element);
        };
    }, []);

    return { hidden, watch, height: (id: number) => heights.current.get(id) ?? 0 };
}
export type VirtualRows = ReturnType<typeof useVirtualRows>;

