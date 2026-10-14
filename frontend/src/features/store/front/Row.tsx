import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A row that scrolls sideways with a round arrow at each edge, as Fanatics' rows do: a press glides one screen
 * of tiles further, the wheel and touch still work, and an arrow fades when its side has nothing more.
 */
export function Row({ children, label, wide, busy }: { children: ReactNode; label: string; wide?: boolean; busy?: boolean }) {
    const list = useRef<HTMLUListElement>(null);
    const [ends, setEnds] = useState({ start: true, end: true });
    useEffect(() => {
        const element = list.current;
        if (!element) return;
        const measure = () => setEnds({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
        measure();
        element.addEventListener('scroll', measure, { passive: true });
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => { element.removeEventListener('scroll', measure); observer.disconnect(); };
    }, [children]);
    const glide = (direction: 1 | -1) => list.current?.scrollBy({ left: direction * list.current.clientWidth * 0.85, behavior: 'smooth' });
    return (
        <div className="gk-store-rail" data-start={ends.start || undefined} data-end={ends.end || undefined}>
            <ul ref={list} className={`gk-store-row${wide ? ' gk-store-row--wide' : ''}`} aria-label={label} aria-busy={busy || undefined}>{children}</ul>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--prev" aria-label={`${label}: previous`} disabled={ends.start} onClick={() => glide(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--next" aria-label={`${label}: next`} disabled={ends.end} onClick={() => glide(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
    );
}
