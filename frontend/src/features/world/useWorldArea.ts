import { useSearchParams } from 'react-router-dom';
import { fetchClubLocationOptions } from '../discovery/api';
import { geocodePlace } from '../../api/map';
import { fetchClubProfile } from './api';
import { useWorldData } from './useWorldData';
import { useWorldSession } from './worldSession';

/** Tbilisi is the launch market and the map's own default centre. */
const DEFAULT_AREA = { city: 'Tbilisi', lat: 41.7151, lng: 44.8271 };

export interface WorldArea {
    city: string;
    /** Why this area was chosen, shown beside the picker. */
    source: 'chosen' | 'club' | 'default';
    /** Centre for distance searches; null until the city has been located. */
    centre: { lat: number; lng: number } | null;
    /** False while the person's club city is still being looked up. */
    ready: boolean;
}

/**
 * The area World is centred on: the city chosen in the URL (`near`), otherwise the
 * person's club city, otherwise Tbilisi. Nothing asks for device location on page load.
 */
export function useWorldArea() {
    const { membership } = useWorldSession();
    const [params, setParams] = useSearchParams();
    const chosen = params.get('near')?.trim() || '';
    const clubId = membership?.clubId ? Number(membership.clubId) : null;
    const clubCity = useWorldData(!chosen && clubId ? `club-city:${clubId}` : null,
        signal => fetchClubProfile(clubId!, signal).then(club => club.cityName || null).catch(() => null));
    const city = chosen || clubCity.data || DEFAULT_AREA.city;
    const ready = Boolean(chosen) || (membership !== undefined && !clubCity.loading);
    const located = useWorldData(ready ? `centre:${city.toLowerCase()}` : null, async () => {
        if (city.toLowerCase() === DEFAULT_AREA.city.toLowerCase()) return DEFAULT_AREA;
        const [match] = await geocodePlace(city, { type: 'CITY' });
        return match ? { lat: match.latitude, lng: match.longitude } : DEFAULT_AREA;
    });
    const centre = located.data ?? (located.error ? DEFAULT_AREA : null);
    const area: WorldArea = { city, source: chosen ? 'chosen' : clubCity.data ? 'club' : 'default', centre, ready };

    const setCity = (next: string) => setParams(current => {
        const copy = new URLSearchParams(current);
        if (next) copy.set('near', next); else copy.delete('near');
        return copy;
    }, { replace: true, preventScrollReset: true });
    return { area, setCity };
}

/** Cities that have clubs, for the area picker. */
export function useWorldCities() {
    const cities = useWorldData('world-cities', () => fetchClubLocationOptions());
    const names = [...new Set((cities.data ?? []).map(item => item.cityName?.split(',')[0].trim()).filter((name): name is string => Boolean(name)))];
    return names.sort((a, b) => a.localeCompare(b));
}
