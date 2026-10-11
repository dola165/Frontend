import type { MapPageResult } from '../../../../api/map';
import { fixtureDay, fixtureTime } from '../../format';
import type { WorldData } from '../../useWorldData';
import type { WorldArea } from '../../useWorldArea';

/** What every field is given by the page. Beside the map (`side`) it has room for more rows. */
export interface FieldProps { area: WorldArea; markers: WorldData<MapPageResult>; side?: boolean }

/** Rows a field lists: more beside the map, where it scrolls, than in the page below. */
export const rowsFor = (side?: boolean) => side ? 10 : 5;

/** "Tomorrow 11:00". */
export const when = (value?: string | null, zone?: string | null) => value ? `${fixtureDay(value, zone ?? undefined)} ${fixtureTime(value, zone ?? undefined)}` : '';

/** The first of each key, in order. */
export const unique = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map(item => [key(item), item])).values()];
