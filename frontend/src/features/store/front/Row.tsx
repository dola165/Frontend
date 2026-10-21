import { ct, useCommerceCopy } from '../copy';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMediaQuery } from '../../world/useMediaQuery';

/**
 * A row that scrolls sideways with a round arrow at each edge, as Fanatics' rows do: a press glides one screen
 * of tiles further, the wheel and touch still work, and an arrow fades when its side has nothing more.
 */
export function Row({ children, label, wide, busy, drift, fundraisers }: { children: ReactNode; label: string; wide?: boolean; busy?: boolean; /** Four to a screen, for fundraisers. */ fundraisers?: boolean;
    /** The row idles sideways on its own, this way, very slowly; the arrows still drive it. Only with a mouse. */ drift?: 'left' | 'right' }) {
    useCommerceCopy();
    const coarse = useMediaQuery('(pointer: coarse)');
    const still = useMediaQuery('(prefers-reduced-motion: reduce)');
    if (drift && !coarse && !still) return <DriftRow label={label} wide={wide} busy={busy} direction={drift}>{children}</DriftRow>;
    return <ScrollRow label={label} wide={wide} busy={busy} fundraisers={fundraisers}>{children}</ScrollRow>;
}

function ScrollRow({ children, label, wide, busy, fundraisers }: { children: ReactNode; label: string; wide?: boolean; busy?: boolean; fundraisers?: boolean }) {
    useCommerceCopy();
    const list = useRef<HTMLUListElement>(null);
    const [ends, setEnds] = useState({ start: true, end: true });
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
    const glide = (direction: 1 | -1) => list.current?.scrollBy({ left: direction * list.current.clientWidth * 0.85, behavior: 'smooth' });
    return (
        <div className="gk-store-rail" data-start={ends.start || undefined} data-end={ends.end || undefined}>
            <ul ref={list} className={`gk-store-row${wide ? ' gk-store-row--wide' : ''}${fundraisers ? ' gk-store-row--four' : ''}`} aria-label={label} aria-busy={busy || undefined}>{children}</ul>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--prev" aria-label={ct("{v0}: previous", { v0: label })} disabled={ends.start} onClick={() => glide(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--next" aria-label={ct("{v0}: next", { v0: label })} disabled={ends.end} onClick={() => glide(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
    );
}

/**
 * The idling row: the items laid twice in one track that the compositor slides by half its width and starts again,
 * so the drift is smooth and never ends. Hovering pauses it. An arrow moves the same animation one screen along,
 * eased, so pressing and idling never fight. The copies are inert, so the keyboard meets each item once; focus
 * inside the row pauses it and brings the focused item into view.
 */
function DriftRow({ children, label, wide, busy, direction }: { children: ReactNode; label: string; wide?: boolean; busy?: boolean; direction: 'left' | 'right' }) {
    useCommerceCopy();
    const track = useRef<HTMLUListElement>(null);
    const items = Children.toArray(children);
    const copies = Math.max(1, Math.ceil(7 / Math.max(1, items.length)));
    const seconds = Math.max(40, Math.round(items.length * copies * 320 / 12));
    const half = Array.from({ length: copies }, (_, copy) => items.map((item, i) => copy === 0 ? item : <li key={`${copy}-${i}`} aria-hidden="true" inert>{(item as { props: { children: ReactNode } }).props.children}</li>)).flat();
    const again = half.map((item, i) => <li key={`again-${i}`} aria-hidden="true" inert>{(item as { props: { children: ReactNode } }).props.children}</li>);
    const animation = () => track.current?.getAnimations()[0];
    const hovered = useRef(false), focused = useRef(false);
    const resume = () => { if (!hovered.current && !focused.current) animation()?.play(); };
    /** Pause with focus inside, and slide the focused item to the row's start (the copies follow it). */
    const show = (target: EventTarget) => {
        focused.current = true;
        const element = track.current, run = animation(), item = target instanceof Element ? target.closest('li') : null;
        run?.pause();
        if (!element || !run || !item || item.parentElement !== element) return;
        const duration = seconds * 1000, loop = element.scrollWidth / 2, share = Math.max(0, item.offsetLeft - 24) / loop;
        run.currentTime = (direction === 'left' ? share : 1 - share) * duration % duration;
        // Focusing scrolls even a clipped row to the item; the animation places it instead.
        requestAnimationFrame(() => { if (element.parentElement) element.parentElement.scrollLeft = 0; });
    };
    const nudge = (sign: 1 | -1) => {
        const element = track.current, run = animation();
        if (!element || !run) return;
        const duration = seconds * 1000, width = element.scrollWidth / 2, screen = element.parentElement?.clientWidth ?? 800;
        // One screen of tiles is this much of the loop; the reversed loop (drifting right) walks the other way.
        const delta = (screen * 0.85 / width) * duration * sign * (direction === 'left' ? 1 : -1);
        const from = Number(run.currentTime ?? 0), start = performance.now(), length = 700;
        const ease = (t: number) => 1 - Math.pow(1 - t, 3);
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / length);
            run.currentTime = ((from + delta * ease(t)) % duration + duration) % duration;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    return (
        <div className="gk-store-rail" data-drift={direction} onMouseEnter={() => { hovered.current = true; animation()?.pause(); }} onMouseLeave={() => { hovered.current = false; resume(); }}
            onFocus={event => show(event.target)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { focused.current = false; resume(); } }}>
            <ul ref={track} className={`gk-store-row gk-store-row--drift${wide ? ' gk-store-row--wide' : ''}`} aria-label={label} aria-busy={busy || undefined} style={{ animationDuration: `${seconds}s`, animationDirection: direction === 'right' ? 'reverse' : 'normal' }}>
                {half}{again}
            </ul>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--prev" aria-label={ct("{v0}: previous", { v0: label })} onClick={() => nudge(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--next" aria-label={ct("{v0}: next", { v0: label })} onClick={() => nudge(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
    );
}
