import { loadPlaces } from '../directory/places';
import { useWorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';

/**
 * Clubs' crests by id, from the same club lookup the map uses (one request, shared, also with the map folded).
 * Unknown clubs get their initials (`Crest`). Backend needed: logos on match rows.
 */
export function useClubCrests() {
    const { area } = useWorldArea();
    const centre = area.centre;
    const clubs = useWorldData(centre ? `crests|${centre.lat},${centre.lng}` : null, () => loadPlaces(['CLUB'], centre!), undefined, { keep: true });
    const places = clubs.data?.places;
    return (clubId: number | null | undefined) => places?.club(clubId)?.logoUrl ?? null;
}
