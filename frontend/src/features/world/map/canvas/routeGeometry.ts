/** One numbered stop of a journey as the map draws it. */
export interface RouteStop {
    id: string; label: string; title: string; latitude: number | null; longitude: number | null; kind: 'meet' | 'stop' | 'match' | 'return' | 'place';
    /** Travel between two places: without a place of its own the leg runs through it. */
    bridge?: boolean;
}
type Located = RouteStop & { latitude: number; longitude: number };
const located = (stop: RouteStop | null): stop is Located => Boolean(stop && stop.latitude != null && stop.longitude != null);

/**
 * Straight legs between consecutive stops, never road directions. A stop without a place
 * breaks the line rather than inventing where it is, except travel: the leg runs from the
 * stop before it to the one after and is active while the travel is selected. Legs take
 * the short way round, also across the date line.
 */
export function routeLegs(stops: RouteStop[], selectedId: string | null) {
    const features: { type: 'Feature'; properties: { active: boolean }; geometry: { type: 'LineString'; coordinates: number[][] } }[] = [];
    let from: Located | null = null, between: string[] = [];
    for (const stop of stops) {
        if (!located(stop)) {
            if (stop.bridge) between.push(stop.id); else { from = null; between = []; }
            continue;
        }
        const a = from, passed = between;
        from = stop; between = [];
        if (!a || (a.latitude === stop.latitude && a.longitude === stop.longitude)) continue;
        const end = a.longitude + ((stop.longitude - a.longitude + 540) % 360 - 180);
        const active = selectedId != null && (stop.id === selectedId || a.id === selectedId || passed.includes(selectedId));
        features.push({ type: 'Feature', properties: { active }, geometry: { type: 'LineString', coordinates: [[a.longitude, a.latitude], [end, stop.latitude]] } });
    }
    return { type: 'FeatureCollection' as const, features };
}

/** Stops at the same place share one marker. */
export function routeGroups(stops: RouteStop[]): Located[][] {
    const groups = new Map<string, Located[]>();
    for (const stop of stops) {
        if (!located(stop)) continue;
        const key = `${stop.latitude.toFixed(5)},${stop.longitude.toFixed(5)}`;
        groups.set(key, [...(groups.get(key) ?? []), stop]);
    }
    return [...groups.values()];
}

/** "1·2·6" for a place visited three times; long runs keep the first two and the last. */
export const groupLabel = (group: RouteStop[]) => group.length > 4
    ? `${group[0].label}·${group[1].label}…${group.at(-1)!.label}`
    : group.map(stop => stop.label).join('·');
