import { useEffect, useState, type RefObject } from 'react';
import type { MapBounds } from '../../../../components/map/areaSearch';

const TILE = 512;

/**
 * The area a map of this size shows around a centre at a zoom (Web Mercator, 512 px tiles as
 * MapLibre uses). Lets a search start before the map has finished loading.
 */
export function viewportBounds([lat, lng]: [number, number], zoom: number, width: number, height: number): MapBounds {
    const scale = TILE * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const sin = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const lngAt = (px: number) => (px / scale) * 360 - 180;
    const latAt = (py: number) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * py) / scale));
    return { west: lngAt(x - width / 2), east: lngAt(x + width / 2), north: latAt(y - height / 2), south: latAt(y + height / 2) };
}

/** The rendered size of an element, kept current as layouts change. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
    const [size, setSize] = useState<{ width: number; height: number } | null>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width && height) setSize(current => current && current.width === Math.round(width) && current.height === Math.round(height) ? current : { width: Math.round(width), height: Math.round(height) });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return size;
}
