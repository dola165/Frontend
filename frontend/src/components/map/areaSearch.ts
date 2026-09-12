export interface MapBounds { west: number; south: number; east: number; north: number }
export type SearchCoverage = 'radius' | 'area' | 'region';
// A region search uses the existing geographic API over the whole globe,
// intersected with its required country/city predicates. The start only orders distances.
export const REGION_BOUNDS: MapBounds = { west: -180, south: -90, east: 180, north: 90 };
export function coverageBounds(coverage: SearchCoverage, area: MapBounds | null) {
    return coverage === 'region' ? REGION_BOUNDS : coverage === 'area' ? area ?? undefined : undefined;
}
export function coverageLabel(coverage: SearchCoverage, radius: number, region: string) {
    return coverage === 'area' ? 'Searched map area' : coverage === 'region' ? `All of ${region}` : `Within ${radius} km`;
}
export function containsPoint(bounds: MapBounds, latitude: number, longitude: number) {
    const lng = ((longitude + 180) % 360 + 360) % 360 - 180;
    return latitude >= bounds.south && latitude <= bounds.north && (bounds.west <= bounds.east
        ? lng >= bounds.west && lng <= bounds.east : lng >= bounds.west || lng <= bounds.east);
}
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replaceAll('ß', 'ss').trim();
/** Stable whole-name / prefix / token ranking for local suggestions and best-fit ordering. */
export function searchRank(title: string, query: string) {
    const text = normalizeSearch(title); const q = normalizeSearch(query);
    if (!q) return 0;
    if (text === q) return 100;
    if (text.startsWith(q)) return 80;
    const tokens = q.split(/\s+/);
    return tokens.every(token => text.includes(token)) ? 50 : tokens.filter(token => text.includes(token)).length * 5;
}
