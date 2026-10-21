import { useMemo } from 'react';
import { isGeorgian, plural, wt } from '../copy';
import { useWorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';
import { placePoints, type PlacedResults, type PinWords } from './mapPoints';
import { loadPlaces, NO_PLACES } from './places';
import type { AnySource } from './types';

const EMPTY: PlacedResults = { points: [], pinOf: new Map(), keysOf: new Map(), unplaced: 0 };
const WORDS: PinWords = { count: (n, noun) => plural(n, noun[0], noun[1]), more: (name, others) => wt('{name} and {count} more', { name, count: others }) };

/**
 * The pins for the results on screen, one to one with the list. Results without coordinates are placed through
 * the map search (their club, trial, competition or match), looked up only while the map is open. `incomplete`
 * says some of that lookup failed, so unplaced results may have a place after all.
 */
export function usePlacedPoints(source: AnySource, items: unknown[], open: boolean) {
    const { area } = useWorldArea();
    const kinds = source.placeKinds ?? [];
    const centre = area.centre;
    const lookup = useWorldData(open && source.place && kinds.length && centre ? `places|${kinds.join(',')}|${centre.lat},${centre.lng}` : null,
        () => loadPlaces(kinds, centre!));
    const places = lookup.data?.places;
    // Pin text is written in the current language (wt reads it), so it is worked out again when the language changes.
    const georgian = isGeorgian();
    const placed = useMemo(() => source.place
        ? placePoints(items, source.key, item => {
            const at = source.place!(item, places ?? NO_PLACES);
            // A pin that is the result itself opens it as its line does: the same words and the same place
            // ("See times" keeps the date searched). A pin several results share (a club, a city) keeps its own.
            if (!at || at.action || at.pin) return at;
            const line = source.line(item, places ?? NO_PLACES);
            return { ...at, action: line.action, to: line.to ?? at.to };
        }, WORDS)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the language is read inside wt(), not seen by the rule
        : EMPTY, [source, items, places, georgian]);
    // A pin says what its results have in common (a kick-off time), when the source says it.
    const points = useMemo(() => {
        if (!source.where) return placed.points;
        const byKey = new Map(items.map(item => [source.key(item), item]));
        return placed.points.map(point => {
            const chip = source.where!((placed.keysOf.get(point.id) ?? []).map(key => byKey.get(key)).filter(item => item !== undefined)).chip;
            return chip ? { ...point, chip } : point;
        });
    }, [source, items, placed]);
    return { ...placed, points, places: places ?? NO_PLACES, loading: lookup.loading, incomplete: Boolean(lookup.data?.incomplete || lookup.error), retry: lookup.retry };
}
