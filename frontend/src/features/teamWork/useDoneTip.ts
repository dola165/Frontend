import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';

/** How long a finger rests on a card before its "Done means" shows. */
const PRESS_MS = 450;

/**
 * "Done means" over a card or a row: shown on hover and on keyboard focus (CSS, on the holder), or after a long press
 * on a phone. The button that opens the task names it with aria-describedby, so a screen reader hears it too. The tap
 * that ends a long press does not open the task; any other touch, or five seconds, closes it again.
 */
export function useDoneTip() {
    const id = useId();
    const [pressed, setPressed] = useState(false);
    const timer = useRef(0);
    const held = useRef(false);
    useEffect(() => {
        if (!pressed) return;
        const close = () => setPressed(false);
        const later = window.setTimeout(close, 5000);
        document.addEventListener('touchstart', close, { passive: true });
        return () => { window.clearTimeout(later); document.removeEventListener('touchstart', close); };
    }, [pressed]);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const cancel = () => window.clearTimeout(timer.current);
    return {
        id,
        /** On the element that holds the button and the tip. */
        holder: { 'data-tip': pressed || undefined },
        /** On the button that opens the task. */
        trigger: {
            'aria-describedby': id,
            onTouchStart: () => { held.current = false; cancel(); timer.current = window.setTimeout(() => { held.current = true; setPressed(true); }, PRESS_MS); },
            onTouchEnd: cancel, onTouchMove: cancel, onTouchCancel: cancel,
            onContextMenu: (event: MouseEvent) => { if (held.current) event.preventDefault(); },
        },
        /** True once after a long press: that click shows the tip instead of opening the task. */
        swallow: () => { if (!held.current) return false; held.current = false; return true; },
    };
}
