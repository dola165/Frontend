import { fetchMapDiscovery, type MapMarkerDto } from '../../../api/map';
import { shared, detached } from '../cache';

/** Kinds of place the World map search knows, by the ids the directories use. */
export type PlaceKind = 'CLUB' | 'STADIUM' | 'TRYOUT' | 'TOURNAMENT' | 'MATCH';
export interface Place { lat: number; lng: number; name: string; city: string | null; clubId: number | null; logoUrl: string | null }

/** Places by id: a club, a venue, a trial, a competition, or a match (by its schedule or listing id). */
export interface Places {
    club: (id: number | null | undefined) => Place | undefined;
    venue: (id: number | null | undefined) => Place | undefined;
    trial: (id: number | null | undefined) => Place | undefined;
    competition: (id: number | null | undefined) => Place | undefined;
    match: (id: number | null | undefined) => Place | undefined;
}

const none = () => undefined;
/** Nothing looked up (yet): results with their own coordinates are still placed. */
export const NO_PLACES: Places = { club: none, venue: none, trial: none, competition: none, match: none };

/** Indexes map markers by the ids directories use. A match is known by its schedule event id, else its own id. */
export function indexPlaces(markers: MapMarkerDto[]): Places {
    const byKind = new Map<string, Map<number, Place>>();
    for (const marker of markers) {
        const id = marker.entityType === 'CLUB' ? marker.clubId ?? marker.entityId : marker.entityType === 'MATCH' ? marker.scheduleEventId ?? marker.entityId : marker.entityId;
        const kind = byKind.get(marker.entityType) ?? new Map<number, Place>();
        kind.set(id, { lat: marker.latitude, lng: marker.longitude, name: marker.title, city: marker.cityName || null, clubId: marker.clubId ?? null, logoUrl: marker.logoUrl ?? null });
        byKind.set(marker.entityType, kind);
    }
    const lookup = (kind: PlaceKind) => (id: number | null | undefined) => id == null ? undefined : byKind.get(kind)?.get(id);
    return { club: lookup('CLUB'), venue: lookup('STADIUM'), trial: lookup('TRYOUT'), competition: lookup('TOURNAMENT'), match: lookup('MATCH') };
}

/** Far enough from the area's centre to cover the country: the lookup is about placing results, not narrowing them. */
const RADIUS_KM = 400;

/**
 * The places of these kinds around a centre, looked up once per kind for five minutes and shared by every tab.
 * `incomplete` says a kind failed to load or was cut short: results missing from it are not known to have no place,
 * so they are counted as not placed (never as placeless), and the lookup can be tried again.
 */
export async function loadPlaces(kinds: PlaceKind[], centre: { lat: number; lng: number }): Promise<{ places: Places; incomplete: boolean }> {
    const at = `${centre.lat.toFixed(2)},${centre.lng.toFixed(2)}`;
    const loaded = await Promise.allSettled(kinds.map(kind => shared(`places:${kind}:${at}`,
        () => fetchMapDiscovery({ lat: centre.lat, lng: centre.lng, radius: RADIUS_KM, type: [kind] }, detached()), 300_000)));
    const pages = loaded.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    return { places: indexPlaces(pages.flatMap(page => page.content)), incomplete: pages.length < kinds.length || pages.some(page => page.resultsLimited) };
}
