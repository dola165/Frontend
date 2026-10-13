import { useSearchParams } from 'react-router-dom';
import { fetchClubLocationOptions } from '../discovery/api';
import { geocodePlace } from '../../api/map';
import { fetchClubProfile } from './api';
import { shared, detached } from './cache';
import { useWorldData } from './useWorldData';
import { useWorldSession } from './worldSession';

/** Tbilisi is the launch market and the map's own default centre. */
const DEFAULT_AREA = { city: 'Tbilisi', lat: 41.7151, lng: 44.8271 };
/** `near=anywhere`: the person asked for every city. */
export const ANYWHERE = 'anywhere';

export interface WorldArea {
    city: string;
    /** Why this area was chosen, shown beside the picker. */
    source: 'chosen' | 'club' | 'default';
    /** Centre for distance searches; null until the city has been located. */
    centre: { lat: number; lng: number } | null;
    /** False while the person's club city is still being looked up. */
    ready: boolean;
    /**
     * The person chose every city. Lists are then not narrowed by place; `city` and `centre` stay the person's
     * own area, so a map still has somewhere to start.
     */
    anywhere: boolean;
}

/**
 * The area World is centred on: the city chosen in the URL (`near`), otherwise the person's club city,
 * otherwise Tbilisi. Nothing asks for device location on page load. Every World piece can call this: the
 * lookups are shared, so the bar, the page and the map ask once between them.
 */
export function useWorldArea() {
    const { membership } = useWorldSession();
    const [params, setParams] = useSearchParams();
    const near = params.get('near')?.trim() || '';
    const anywhere = near.toLowerCase() === ANYWHERE;
    const chosen = anywhere ? '' : near;
    const clubId = membership?.clubId ? Number(membership.clubId) : null;
    const clubCity = useWorldData(!chosen && clubId ? `club-city:${clubId}` : null,
        () => shared(`club-city:${clubId}`, () => fetchClubProfile(clubId!, detached()).then(club => club.cityName || null).catch(() => null), 600_000));
    const city = chosen || clubCity.data || DEFAULT_AREA.city;
    const ready = Boolean(chosen) || (membership !== undefined && !clubCity.loading);
    const located = useWorldData(ready ? `centre:${city.toLowerCase()}` : null, () => shared(`centre:${city.toLowerCase()}`, async () => {
        if (city.toLowerCase() === DEFAULT_AREA.city.toLowerCase()) return DEFAULT_AREA;
        const [match] = await geocodePlace(city, { type: 'CITY' });
        return match ? { lat: match.latitude, lng: match.longitude } : DEFAULT_AREA;
    }, 600_000));
    const centre = located.data ?? (located.error ? DEFAULT_AREA : null);
    const area: WorldArea = { city, source: chosen ? 'chosen' : clubCity.data ? 'club' : 'default', centre, ready, anywhere };

    /** A city, `ANYWHERE`, or '' to go back to the person's own area. A new area ends the choice of one result. */
    const setCity = (next: string) => setParams(current => {
        const copy = new URLSearchParams(current);
        if (next) copy.set('near', next); else copy.delete('near');
        copy.delete('selected');
        return copy;
    }, { replace: true, preventScrollReset: true });
    return { area, setCity };
}

/** Every club's country and city, asked for once and shared by the area picker and the club filters. */
export function useClubLocations() {
    return useWorldData('world-cities', () => shared('world-cities', () => fetchClubLocationOptions(), 600_000)).data;
}

/** Cities that have clubs, for the area picker. */
export function useWorldCities() {
    const locations = useClubLocations();
    const names = [...new Set((locations ?? []).map(item => item.cityName?.split(',')[0].trim()).filter((name): name is string => Boolean(name)))];
    return names.sort((a, b) => a.localeCompare(b));
}
