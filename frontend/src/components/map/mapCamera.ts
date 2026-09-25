import { distanceKm, type Coordinate } from './walkingGraph';

export type MapFocusTarget = { center: [number, number]; zoom?: number; bounds?: [Coordinate, Coordinate] };

/** Only an explicitly chosen location anchors selection; a browse-area center does not. */
export function mapSelectionTarget(destination: Coordinate, origin: Coordinate | null, currentZoom: number): MapFocusTarget {
    const target: MapFocusTarget = { center: [destination[1], destination[0]], zoom: Math.max(14, currentZoom) };
    if (!origin || distanceKm(origin, destination) >= 100) return target;

    // Use the nearest world copy so nearby points across the date line stay nearby.
    const longitude = destination[0] + 360 * Math.round((origin[0] - destination[0]) / 360);
    return { ...target, bounds: [
        [Math.min(origin[0], longitude), Math.min(origin[1], destination[1])],
        [Math.max(origin[0], longitude), Math.max(origin[1], destination[1])]
    ] };
}

/** Padding is relative to the map canvas inside the native bars, never the full screen. */
export function mapCameraPadding(width: number, height: number, sheetHeight = 0) {
    const top = Math.min(80, height * .15);
    const bottom = Math.min(Math.max(24, sheetHeight + 16), Math.max(0, height - top - 100));
    const side = Math.min(32, width * .08);
    return { top, bottom, left: side, right: side };
}
