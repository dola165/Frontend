export const venueMapLink = (id: number) => `/map?venue=${id}`;
export function linkedVenueId(search: string): number | null {
    const value = new URLSearchParams(search).get('venue');
    if (!value || !/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
