import { createContext } from 'react';
import type { MapPageResult } from '../../../../api/map';
import { fixtureDay, fixtureTime } from '../../format';
import type { WorldData } from '../../useWorldData';
import type { WorldArea } from '../../useWorldArea';
import type { WorldRole } from '../roles';

/** What every field is given by the page: the area, its map markers, and who the page is for. Beside the map (`side`) it has room for more rows. */
export interface FieldProps { area: WorldArea; markers: WorldData<MapPageResult>; role: WorldRole; side?: boolean }

/** Rows a field lists: more beside the map, where it scrolls, than in the page below. */
export const rowsFor = (side?: boolean) => side ? 10 : 5;

/** "Tomorrow 11:00". */
export const when = (value?: string | null, zone?: string | null) => value ? `${fixtureDay(value, zone ?? undefined)} ${fixtureTime(value, zone ?? undefined)}` : '';

/** The first of each key, in order. */
export const unique = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map(item => [key(item), item])).values()];

/** The field beside the map can be folded to its header so the whole map shows; the page owns whether it is. */
export const SideFold = createContext<{ folded: boolean; toggle: () => void } | null>(null);

/** Club crests from the map's club markers, by club id: clubs outside the map's area show their initials. */
export function crestsOf(markers: WorldData<MapPageResult>) {
    const crests = new Map((markers.data?.content ?? []).filter(marker => marker.entityType === 'CLUB').map(marker => [marker.clubId ?? marker.entityId, marker.logoUrl ?? null]));
    return (clubId: number | null | undefined) => clubId == null ? null : crests.get(clubId) ?? null;
}
