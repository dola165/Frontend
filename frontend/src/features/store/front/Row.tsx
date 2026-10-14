import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A row that scrolls sideways with a round arrow at each edge, as Fanatics' rows do: a press glides one screen
 * of tiles further, the wheel and touch still work, and an arrow fades when its side has nothing more.
 *
 * With `drift` the row also idles sideways on its own, very slowly, that way: the items are laid twice so the drift
 * wraps without a seam. Pressing an arrow, hovering, touching or focusing a tile stops the drift; it resumes a few
 * seconds after the person lets go. Nothing drifts for people who ask for reduced motion.
 */
export function Row({ children, label, wide, busy, drift, speed = 14 }: { children: ReactNode; label: string; wide?: boolean; busy?: boolean; drift?: 'left' | 'right'; /** Pixels per second of idle drift. */ speed?: number }) {
    const list = useRef<HTMLUListElement>(null);
    const [ends, setEnds] = useState({ start: true, end: true });
    const [held, setHeld] = useState(false);
    const resumeAt = useRef(0);
    const items = Children.toArray(children);
    // A drifting row needs two copies to wrap; few items are laid more times so each half is wider than the screen.
    const copies = drift ? Math.max(1, Math.ceil(7 / Math.max(1, items.length))) : 1;
    useEffect(() => {
        const element = list.current;
        if (!element) return;
        const measure = () => setEnds({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
        measure();
        element.addEventListener('scroll', measure, { passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(element);
        return () => { element.removeEventListener('scroll', measure); observer?.disconnect(); };
    }, [children]);
    useEffect(() => {
        const element = list.current;
        if (!drift || !element || held || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        let frame = 0, last = performance.now();
        if (drift === 'right' && element.scrollLeft === 0) element.scrollLeft = Math.round(element.scrollWidth / 2);
        // The browser keeps whole pixels, and a slow drift moves less than one per frame: the position is kept here,
        // in fractions, and written rounded. A scroll by hand (the wheel, a touch, an arrow) is picked up from the element.
        let position = element.scrollLeft, written = element.scrollLeft;
        const step = (now: number) => {
            const seconds = Math.min(0.05, (now - last) / 1000); last = now;
            if (now >= resumeAt.current) {
                if (Math.abs(element.scrollLeft - written) > 1) position = element.scrollLeft;
                const half = element.scrollWidth / 2;
                position += (drift === 'left' ? 1 : -1) * speed * seconds;
                if (position >= half) position -= half; else if (position < 0) position += half;
                written = Math.round(position);
                if (written !== element.scrollLeft) element.scrollLeft = written;
            }
            frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [drift, held, speed, children]);
    const glide = (direction: 1 | -1) => { resumeAt.current = performance.now() + 4000; list.current?.scrollBy({ left: direction * list.current.clientWidth * 0.85, behavior: 'smooth' }); };
    const rest = () => { resumeAt.current = performance.now() + 3000; setHeld(false); };
    return (
        <div className="gk-store-rail" data-drift={drift} data-start={ends.start || undefined} data-end={ends.end || undefined}
            onMouseEnter={drift ? () => setHeld(true) : undefined} onMouseLeave={drift ? rest : undefined} onFocus={drift ? () => setHeld(true) : undefined} onBlur={drift ? rest : undefined} onTouchStart={drift ? () => setHeld(true) : undefined} onTouchEnd={drift ? rest : undefined}>
            <ul ref={list} className={`gk-store-row${wide ? ' gk-store-row--wide' : ''}`} aria-label={label} aria-busy={busy || undefined}>
                {Array.from({ length: copies * (drift ? 2 : 1) }, (_, copy) => items.map((item, i) => copy === 0 ? item : <li key={`${copy}-${i}`} aria-hidden="true">{(item as { props: { children: ReactNode } }).props.children}</li>)).flat()}
            </ul>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--prev" aria-label={`${label}: previous`} disabled={!drift && ends.start} onClick={() => glide(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--next" aria-label={`${label}: next`} disabled={!drift && ends.end} onClick={() => glide(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
    );
}
