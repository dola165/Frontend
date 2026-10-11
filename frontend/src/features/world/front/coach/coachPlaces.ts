import { distanceKm } from '../../../../components/map/walkingGraph';
import { fetchAvailability, fetchVenues, type Pitch, type Venue } from '../../../venues/api';
import { isoDay } from '../../format';
import { useWorldData } from '../../useWorldData';
import type { WorldArea } from '../../useWorldArea';
import { freeSlots, type SlotChip } from './slots';

/** Players a side of this format puts on the pitch: "7_A_SIDE" → 7, futsal → 5. */
export const pitchSide = (format: string) => format === 'FUTSAL' ? 5 : Number(format.split('_')[0]) || 11;

export interface VenueSlots { venue: Venue; km: number | null; pitches: Pitch[]; slots: SlotChip[]; timeZone: string }

/**
 * Free slots at the venues nearest the area, for the squads' size: a pitch fits when it is at most one size
 * smaller than the smallest side in focus (a 9-a-side squad can train on a 7-a-side pitch). Indoor keeps only
 * covered pitches. Venues whose availability does not load are left out rather than shown as full.
 */
export function usePitchSlots(area: WorldArea, { indoor = false, minutes, smallestSide, window, venues = 4, wait = false }: {
    /** Hold the request until the squads are known. */ wait?: boolean; indoor?: boolean; minutes: number; smallestSide: number; window?: { from: string; to: string }; venues?: number;
}) {
    const key = area.ready && !wait ? `pitch-slots:${area.city}:${indoor}:${minutes}:${smallestSide}:${window?.from ?? ''}:${isoDay(0)}` : null;
    return useWorldData<VenueSlots[]>(key, async signal => {
        const found = (await fetchVenues({ city: area.city, ...(indoor ? { covered: true } : {}) }, signal)).content;
        const centre = area.centre;
        const near = found.map(venue => ({ venue, km: centre && venue.latitude != null && venue.longitude != null ? distanceKm([centre.lng, centre.lat], [venue.longitude, venue.latitude]) : null }))
            .map(entry => ({ ...entry, pitches: entry.venue.pitches.filter(pitch => pitch.active && (!indoor || pitch.covered) && pitchSide(pitch.format) >= Math.min(smallestSide, 11) - 2) }))
            .filter(entry => entry.pitches.length)
            .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)).slice(0, venues);
        const loaded = await Promise.allSettled(near.map(entry => fetchAvailability(entry.venue.id, isoDay(0), minutes, 7, signal)));
        return near.flatMap((entry, index) => {
            const result = loaded[index];
            if (result.status !== 'fulfilled') return [];
            const fits = new Set(entry.pitches.map(pitch => pitch.id));
            return [{ ...entry, slots: freeSlots(result.value, { window, keep: id => fits.has(id) }), timeZone: result.value.timezone }];
        });
    });
}
