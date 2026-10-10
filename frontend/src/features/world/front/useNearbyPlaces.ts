import { fetchNearbyMap } from '../../../api/map';
import { useWorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';

/** Clubs and venues within 25 km of the area's centre, shared by the map block and the nearby clubs. */
export function useNearbyPlaces(area: WorldArea) {
    return useWorldData(area.centre ? `around:${area.city}:${area.centre.lat}:${area.centre.lng}` : null,
        signal => fetchNearbyMap({ lat: area.centre!.lat, lng: area.centre!.lng, radius: 25, type: ['CLUB', 'STADIUM'], size: 100 }, signal));
}
