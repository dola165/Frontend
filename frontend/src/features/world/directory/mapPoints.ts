import type { Approximate, WorldMapPoint, WorldMapTone } from '../map/WorldMap';
import type { Placement } from './types';

export interface PlacedResults {
    points: WorldMapPoint[];
    /** Each placed result's pin, by result key (several results can share one pin). */ pinOf: Map<string, string>;
    /** The results at each pin, by pin id, in list order. */ keysOf: Map<string, string[]>;
    /** Results on screen that have no known place: they stay in the list and are counted. */ unplaced: number;
}

/** The words a grouped pin needs, in the current language. */
export interface PinWords { count: (n: number, noun: [string, string]) => string; more: (name: string, others: number) => string }

/** One spot on the map: results there would otherwise be stacked pins nobody can reach. */
const spot = (at: Placement) => `at:${at.lat.toFixed(4)},${at.lng.toFixed(4)}`;

/**
 * Turns results into pins, one per place. Results at one place (a shared `pin`, such as their club, or the same
 * spot) become one pin with a count. A pin for a shared place is named after the place; results that only share
 * a spot keep their names ("Riverside Academy and 1 more"). A pin is approximate only when all its results are, and a pin
 * holding several kinds of result (a club's match and its training) is "mixed" and lists them.
 */
export function placePoints<T>(items: T[], key: (item: T) => string, place: (item: T) => Placement | null, words: PinWords): PlacedResults {
    const pins = new Map<string, { at: Placement; keys: string[]; labels: string[]; approximate?: Approximate; tones: Set<WorldMapTone> }>();
    const pinOf = new Map<string, string>();
    let unplaced = 0;
    for (const item of items) {
        const at = place(item);
        if (!at) { unplaced += 1; continue; }
        const id = at.pin ?? spot(at);
        const pin = pins.get(id);
        if (pin) { pin.keys.push(key(item)); if (!pin.labels.includes(at.label)) pin.labels.push(at.label); pin.approximate = pin.approximate && at.approximate ? pin.approximate : undefined; pin.tones.add(at.tone); }
        else pins.set(id, { at, keys: [key(item)], labels: [at.label], approximate: at.approximate, tones: new Set([at.tone]) });
        pinOf.set(key(item), id);
    }
    const points = [...pins].map(([id, { at, keys, labels, approximate, tones }]): WorldMapPoint => {
        const grouped = keys.length > 1 || Boolean(at.pin);
        const label = at.pin || labels.length === 1 ? at.label : words.more(labels[0], labels.length - 1);
        const kinds = [...tones];
        const to = keys.length > 1 && !at.pin ? undefined : at.to;
        return { id, lat: at.lat, lng: at.lng, tone: kinds.length > 1 ? 'mixed' : at.tone, ...(kinds.length > 1 ? { tones: kinds } : {}), label, to, action: to ? at.action : undefined, approximate, ...(at.crest ? { crest: at.crest } : {}),
            ...(grouped ? { count: keys.length, meta: at.noun ? words.count(keys.length, at.noun) : at.meta } : { meta: at.meta }) };
    });
    const keysOf = new Map([...pins].map(([id, pin]) => [id, pin.keys]));
    return { points, pinOf, keysOf, unplaced };
}
