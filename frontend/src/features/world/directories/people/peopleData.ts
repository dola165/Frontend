import { geocodePlace } from '../../../../api/map';
import { fetchPeople, type PeopleParams, type PersonRole, type PersonSummary } from '../../api';
import { shared } from '../../cache';
import { wt } from '../../copy';
import type { DirectoryPage, DirectoryQuery, LoadContext } from '../../directory/types';

export const PAGE = 24;
export interface Centre { lat: number; lng: number }
/** A person as People lists them: the summary, and the centre of their city when they are counted there (no club). */
export type PersonItem = PersonSummary & { centre?: Centre | null };

/** The centre of a city by its name, or null when it is not known: nothing is ever placed at a guessed city. */
export const cityCentre = (city: string): Promise<Centre | null> => shared(`city:${city.trim().toLowerCase()}`,
    () => geocodePlace(city.trim(), { type: 'CITY' }).then(([match]) => match ? { lat: match.latitude, lng: match.longitude } : null).catch(() => null), 600_000);

/** The first city someone names for where they work ("Tbilisi and Rustavi" → "Tbilisi"). */
export const firstCity = (area: string | null | undefined) => area?.split(/,|;|\/|&|·| and | და /i)[0]?.trim() || null;

/** People without a club are counted at their city, so the centres of those cities are looked up with the page. */
async function withCentres(items: PersonSummary[]): Promise<PersonItem[]> {
    const cities = [...new Set(items.filter(person => person.clubId == null && person.city).map(person => person.city!))];
    const centres = new Map(await Promise.all(cities.map(async city => [city, await cityCentre(city)] as const)));
    return items.map(person => person.clubId == null && person.city ? { ...person, centre: centres.get(person.city) ?? null } : person);
}

/** Filters only the people directory can answer: a name search cannot. */
const ANSWERED_BY_DIRECTORY = ['job', 'service', 'licence', 'club', 'position', 'open', 'age'];
export const asksDirectory = (query: DirectoryQuery) => ANSWERED_BY_DIRECTORY.some(key => (query.values[key] ?? []).length > 0);
const NEEDS_DIRECTORY = 'Filtering people is not available yet. Clear the filters to search by name.';

/**
 * One People view's page: the people in `roles`, narrowed by its filters, the nearest to the World area first.
 * Without the people directory on the server (`searchOnly`), only a name search is possible; a link that carries a
 * filter says so instead of ignoring it. `onSearchOnly` reports the first answer that shows the directory is missing.
 */
export async function loadPeople({ roles, params, query, page, context, searchOnly, onSearchOnly }: {
    roles: PersonRole[]; params: PeopleParams; query: DirectoryQuery; page: number; context: LoadContext;
    searchOnly: boolean; onSearchOnly?: () => void;
}): Promise<DirectoryPage<PersonItem>> {
    const unavailable = { items: [], total: null, hasMore: false, notice: wt(NEEDS_DIRECTORY) };
    if (searchOnly && asksDirectory(query)) return unavailable;
    // Distances are measured from the World area's centre; with it known, the nearest come first unless another order is asked for.
    const centre = context.area?.centre;
    const result = await fetchPeople({ ...params, role: roles, q: query.q || undefined, country: context.country ?? undefined, lat: centre?.lat, lng: centre?.lng, sort: query.sort || (centre ? 'NEAREST' : undefined), page, size: PAGE },
        context.sessionId, context.signal);
    if (result.searchOnly && !searchOnly) {
        onSearchOnly?.();
        if (asksDirectory(query)) return unavailable;
    }
    return { items: await withCentres(result.items), total: result.total, hasMore: result.hasMore };
}

/** How many people a view has, for its tab (unknown without the people directory). */
export const countPeople = (roles: PersonRole[]) => async (context: LoadContext) =>
    (await fetchPeople({ role: roles, country: context.country ?? undefined, page: 0, size: 1 }, context.sessionId, context.signal)).total;

