import { createContext, useContext, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { JoiningChild } from '../../joining-contract/types';
import { useWorldArea } from '../useWorldArea';

/**
 * World's club tab opened as Parent Hub's club finder (step 5): the same source, list, map and filters, with what this
 * job needs added (the ways in on each club, a draggable "You", distance and days). Present only inside the pop-up.
 */
export interface Finder {
    /** The family's children (the one the finder is for is World's `player`). */ family: JoiningChild[];
    /** Something changed for the family (a first visit booked): Parent Hub reloads behind the pop-up. */ changed: () => void;
}
export const FinderContext = createContext<Finder | null>(null);
export const useFinder = () => useContext(FinderContext);

/** The history state of the link that opens the pop-up ("Find a club near you"), so ✕ goes back over that entry. */
export const FINDER_OPENED = { finder: 'pushed' } as const;

/** Everything the finder keeps in the address; all of it goes when the pop-up closes. */
export const FINDER_PARAMS = ['find', 'group', 'q', 'sort', 'shown', 'selected', 'map', 'panel', 'type', 'gender', 'fee', 'open', 'joinPolicy', 'age', 'ageGroup', 'country', 'city', 'km', 'day', 'from', 'way', 'near'];

// The device's position, asked for once and kept in this page only: never stored, never in the address (`from=device`).
let device: { lat: number; lng: number } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const deviceSpot = () => device;
export function rememberDevice(spot: { lat: number; lng: number } | null) { device = spot; listeners.forEach(listener => listener()); }

/** A place in the address ("41.715,44.827"), when it is one. */
export function spotOf(value: string | null) {
    const [lat, lng] = (value ?? '').split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

/**
 * Where the finder measures from ("You"): the place "You" was dragged to (`from=lat,lng`), the device's position after
 * "Use my location" (`from=device`), else the town given at sign-up (World's area). Null while none is known.
 */
export function useFinderCentre() {
    const [params] = useSearchParams();
    const { area } = useWorldArea();
    const spot = useSyncExternalStore(subscribe, deviceSpot, deviceSpot);
    const from = params.get('from');
    if (from === 'device' && spot) return { ...spot, source: 'device' as const };
    const chosen = spotOf(from);
    if (chosen) return { ...chosen, source: 'chosen' as const };
    return area.centre ? { lat: area.centre.lat, lng: area.centre.lng, source: 'town' as const, town: area.city } : null;
}
