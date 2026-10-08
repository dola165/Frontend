import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';
import '../../styles/app-motion.css';

/** Retain an open panel and its focus/scroll lock until dismissal settles. */
export function usePanelMotion(onClose: () => void) {
    const [closing, setClosing] = useState(false);
    const requested = useRef(false), completed = useRef(false), callback = useRef(onClose);
    useEffect(() => { callback.current = onClose; }, [onClose]);
    const finish = useCallback(() => {
        if (completed.current) return;
        completed.current = true;
        callback.current();
    }, []);
    const close = useCallback(() => {
        if (requested.current) return;
        requested.current = true;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
        else setClosing(true);
    }, [finish]);
    useEffect(() => {
        if (!closing) return;
        // CSS can be disabled or an animation interrupted; dismissal must still complete.
        const timer = window.setTimeout(finish, 260);
        const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const change = () => { if (preference?.matches) finish(); };
        change();
        preference?.addEventListener?.('change', change);
        return () => { window.clearTimeout(timer); preference?.removeEventListener?.('change', change); };
    }, [closing, finish]);
    const onAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
        if (closing && event.target === event.currentTarget &&
            ['app-panel-exit', 'app-dialog-exit', 'app-popover-exit'].includes(event.animationName)) finish();
    };
    return { closing, close, onAnimationEnd };
}
