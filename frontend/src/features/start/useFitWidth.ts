import { useEffect, useRef, useState } from 'react';

/**
 * Scales a page drawn `width` pixels wide down to its pane on a wide screen, so it shows as the website would; a phone
 * shows it at its own size. `ready` once the pane is on screen.
 */
export function useFitWidth(ready: boolean, width: number) {
    const pane = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const element = pane.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setScale(window.innerWidth <= 640 ? 1 : Math.min(1, entry.contentRect.width / width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, [ready, width]);
    return { pane, scale, style: scale < 1 ? { width, zoom: scale } : undefined };
}
