import { Children, type ReactNode } from 'react';

/**
 * A row that drifts sideways on its own, as a landing page's showcase does: the items are laid twice in one track that
 * slides by half its width and starts again, so the drift never ends. `direction` sets which way; the row pauses under
 * the pointer and under keyboard focus, and stands still for people who ask for reduced motion.
 */
export function Marquee({ children, direction, label, speed = 48 }: { children: ReactNode; direction: 'left' | 'right'; label: string; /** Pixels per second, roughly. */ speed?: number }) {
    const items = Children.toArray(children);
    if (!items.length) return null;
    // Each half must be wider than the screen, so few items are laid several times per half.
    const copies = Math.max(1, Math.ceil(7 / items.length));
    const half = Array.from({ length: copies }, (_, c) => items.map((item, i) => <li key={`${c}-${i}`} aria-hidden={c > 0 || undefined}>{item}</li>)).flat();
    const seconds = Math.round((items.length * copies * 300) / speed);
    return (
        <div className="gk-marquee" data-direction={direction}>
            <ul className="gk-marquee__track" aria-label={label} style={{ animationDuration: `${seconds}s` }}>
                {half}
                {half.map((item, i) => <li key={`again-${i}`} aria-hidden="true">{(item as { props: { children: ReactNode } }).props.children}</li>)}
            </ul>
        </div>
    );
}
