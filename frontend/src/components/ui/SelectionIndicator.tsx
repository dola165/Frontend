import { useLayoutEffect, useRef } from 'react';

/** A single travelling underline; semantic selected state stays on the controls. */
export function SelectionIndicator({ value, selector = '[aria-current="page"], [aria-pressed="true"], [aria-selected="true"]' }: { value: string; selector?: string }) {
    const indicator = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
        const element = indicator.current, rail = element?.parentElement;
        if (!element || !rail) return;
        const measure = () => {
            const active = rail.querySelector<HTMLElement>(selector);
            if (!active) { element.style.opacity = '0'; return; }
            const bounds = rail.getBoundingClientRect(), item = active.getBoundingClientRect();
            element.style.width = `${item.width}px`;
            element.style.transform = `translateX(${item.left - bounds.left + rail.scrollLeft - rail.clientLeft}px)`;
            element.style.opacity = '1';
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(rail);
        for (const child of rail.querySelectorAll<HTMLElement>('a, button')) observer.observe(child);
        return () => observer.disconnect();
    }, [value, selector]);
    return <span ref={indicator} aria-hidden="true" className="app-selection-indicator" />;
}
