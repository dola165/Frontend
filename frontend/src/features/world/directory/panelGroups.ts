import type { WorldMapPoint } from '../map/WorldMap';
import type { ArrangedGroup } from './groups';

/** What a source says about the results at one pin: the place's name, one quiet detail ("10:30–15:00"), and its chip. */
export interface PinSummary { label?: string; detail?: string; chip?: string }

/**
 * The Browse area grouped by where: one group per pin, in the order its first result comes in the list, named after
 * the place (the source's name for it, else the pin's), with results that have no place in a last group. The list
 * below the map keeps its own groups (by when and what), so the two never repeat each other.
 */
export function pinGroups<T>(items: T[], key: (item: T) => string, placed: { points: WorldMapPoint[]; pinOf: Map<string, string> },
    where?: (items: T[]) => PinSummary): ArrangedGroup<T>[] {
    const byPin = new Map<string, T[]>();
    const loose: T[] = [];
    for (const item of items) {
        const pin = placed.pinOf.get(key(item));
        if (pin) byPin.set(pin, [...(byPin.get(pin) ?? []), item]); else loose.push(item);
    }
    const points = new Map(placed.points.map(point => [point.id, point]));
    const groups = [...byPin].map(([pin, rows]): ArrangedGroup<T> => {
        const summary = where?.(rows);
        return { group: { key: pin, label: summary?.label ?? points.get(pin)?.label ?? '', pin, detail: summary?.detail }, items: rows };
    });
    if (loose.length) groups.push({ group: { key: '~loose', label: 'Not on the map' }, items: loose });
    return groups;
}
