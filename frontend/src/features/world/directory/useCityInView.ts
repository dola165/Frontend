import { fetchNearbyMap } from '../../../api/map';
import type { MapBounds } from '../../../components/map/areaSearch';
import { shared } from '../cache';
import { useWorldCities, type WorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';

const detached = () => new AbortController().signal;
const round = (value: number) => value.toFixed(2);

/** The city most places in a map view belong to, by the clubs and venues in it; null when there are none. */
export function cityOf(cities: (string | null | undefined)[]) {
    const counts = new Map<string, number>();
    for (const city of cities) if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/**
 * After the person moves the map over another city, that city, so a list that searches by city can offer to
 * search there ("Search Rustavi"). Only cities World knows, and never the one already searched.
 */
export function useCityInView(view: MapBounds | null, area: WorldArea) {
    const known = useWorldCities();
    const key = view ? `${round(view.west)},${round(view.south)},${round(view.east)},${round(view.north)}` : null;
    const found = useWorldData(key ? `city-in-view:${key}` : null, () => shared(`city-in-view:${key}`, () => fetchNearbyMap({
        lat: (view!.south + view!.north) / 2, lng: (view!.west + view!.east) / 2, bounds: view!, type: ['CLUB', 'STADIUM'], size: 40,
    }, detached()).then(page => cityOf(page.content.map(marker => marker.cityName)))));
    const city = found.data ? known.find(name => name.toLowerCase() === found.data!.toLowerCase()) : undefined;
    return city && (area.anywhere || city.toLowerCase() !== area.city.toLowerCase()) ? city : null;
}
