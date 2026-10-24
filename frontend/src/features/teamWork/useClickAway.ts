import { useEffect, type RefObject } from 'react';

/** Closes a menu on a click outside it or on Escape. */
export function useClickAway(open: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
    useEffect(() => {
        if (!open) return;
        const handle = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) close(); };
        document.addEventListener('mousedown', handle); document.addEventListener('keydown', handle);
        return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handle); };
    }, [open, box, close]);
}
