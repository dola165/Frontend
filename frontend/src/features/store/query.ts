import type { StoreSort } from './api';
import { categoryLabel, collectionLabel, CURRENCIES, SORTS } from './labels';

/**
 * What a catalogue search is, kept whole in the address so refresh, sharing, a product's "back" and the club page's
 * tabs all return to the same results. The club's store fixes `clubId` from its route instead.
 */
export interface CatalogueQuery {
    query: string; category: string; collection: string; seller: '' | 'grasskickz' | 'clubs'; clubId: number | undefined;
    country: string; city: string; variant: string; minPrice: string; maxPrice: string; currency: string; sort: StoreSort; page: number;
}
/** The address keys the catalogue owns; the club page clears them when its tab changes. */
export const CATALOGUE_KEYS = ['query', 'category', 'collection', 'seller', 'clubId', 'country', 'city', 'variant', 'minPrice', 'maxPrice', 'currency', 'sort', 'page'] as const;
export const PAGE_SIZE = 24;

const sortOf = (value: string | null): StoreSort | null => SORTS.some(sort => sort.value === value) ? value as StoreSort : null;
const number = (value: string | null) => value && Number.isFinite(Number(value)) ? value : '';

export function readCatalogue(params: URLSearchParams, fixedClubId?: number): CatalogueQuery {
    const seller = params.get('seller');
    const clubParam = Number(params.get('clubId'));
    const clubId = fixedClubId ?? (Number.isSafeInteger(clubParam) && clubParam > 0 ? clubParam : undefined);
    const query: Omit<CatalogueQuery, 'sort'> = {
        query: (params.get('query') ?? params.get('q') ?? '').slice(0, 100), category: params.get('category') ?? '', collection: params.get('collection') ?? '',
        seller: clubId ? '' : seller === 'grasskickz' || seller === 'clubs' ? seller : '', clubId,
        country: params.get('country') ?? '', city: params.get('city') ?? '', variant: (params.get('variant') ?? '').slice(0, 40),
        minPrice: number(params.get('minPrice')), maxPrice: number(params.get('maxPrice')),
        currency: CURRENCIES.includes(params.get('currency') ?? '') ? params.get('currency')! : 'GEL',
        page: Math.min(1_000_000, Math.max(0, Math.floor(Number(params.get('page')) || 0))),
    };
    return { ...query, sort: sortOf(params.get('sort')) ?? 'RELEVANCE' };
}

/** The address for a search: only what differs from the empty search is written. */
export function catalogueSearch(query: Partial<CatalogueQuery>): URLSearchParams {
    const params = new URLSearchParams();
    for (const key of ['query', 'category', 'collection', 'seller', 'country', 'city', 'variant', 'minPrice', 'maxPrice'] as const) if (query[key]) params.set(key, String(query[key]));
    if (query.clubId) params.set('clubId', String(query.clubId));
    if (query.currency && query.currency !== 'GEL') params.set('currency', query.currency);
    if (query.sort && query.sort !== 'RELEVANCE') params.set('sort', query.sort);
    if (query.page) params.set('page', String(query.page));
    return params;
}
const withSearch = (path: string, params: URLSearchParams) => { const search = params.toString(); return search ? `${path}?${search}` : path; };
/** The global catalogue (`/store/all`). */
export const cataloguePath = (query: Partial<CatalogueQuery> = {}) => withSearch('/store/all', catalogueSearch(query));
/** A club's store: its own page, fixed to the club. */
export const clubStorePath = (clubId: number, query: Partial<CatalogueQuery> = {}) => withSearch(`/clubs/${clubId}/store`, catalogueSearch({ ...query, clubId: undefined }));

/** What the catalogue is called for this search: the thing the person chose, and whose it is. */
export function catalogueHeading(query: CatalogueQuery, clubName?: string | null): { title: string; hint?: string } {
    const own = query.seller === 'grasskickz';
    if (query.clubId) return { title: clubName ? `${clubName} store` : 'Club store', hint: query.category ? categoryLabel(query.category) : undefined };
    if (query.collection && collectionLabel(query.collection)) return { title: collectionLabel(query.collection)!, hint: own ? 'GrassKickZ equipment' : undefined };
    if (query.category) return { title: categoryLabel(query.category), hint: own ? 'Sold by GrassKickZ' : query.seller === 'clubs' ? 'From club stores' : undefined };
    if (own) return { title: 'GrassKickZ equipment', hint: 'Sold by GrassKickZ' };
    if (query.seller === 'clubs') return { title: 'Club stores', hint: 'Kit, tickets and more from clubs on GrassKickZ' };
    if (query.query) return { title: `Results for “${query.query}”` };
    return { title: 'All products', hint: 'GrassKickZ equipment and every club store' };
}

export interface ActiveFilter { key: keyof CatalogueQuery; label: string }
/** The filters the search holds, each removable on its own. The search words stay in the search box. */
export function activeFilters(query: CatalogueQuery, fixedClub: boolean): ActiveFilter[] {
    const list: ActiveFilter[] = [];
    if (query.seller === 'grasskickz') list.push({ key: 'seller', label: 'Sold by GrassKickZ' });
    if (query.seller === 'clubs') list.push({ key: 'seller', label: 'Club stores' });
    if (query.clubId && !fixedClub) list.push({ key: 'clubId', label: 'One club' });
    if (query.collection && collectionLabel(query.collection)) list.push({ key: 'collection', label: collectionLabel(query.collection)! });
    if (query.category) list.push({ key: 'category', label: categoryLabel(query.category) });
    if (query.city) list.push({ key: 'city', label: query.city }); else if (query.country) list.push({ key: 'country', label: query.country });
    if (query.variant) list.push({ key: 'variant', label: `Size ${query.variant}` });
    if (query.minPrice || query.maxPrice) list.push({ key: 'minPrice', label: query.minPrice && query.maxPrice ? `${query.minPrice}–${query.maxPrice} ${query.currency}` : query.minPrice ? `From ${query.minPrice} ${query.currency}` : `Up to ${query.maxPrice} ${query.currency}` });
    if (query.currency !== 'GEL') list.push({ key: 'currency', label: query.currency });
    return list;
}
/** The search without one filter (a price range goes as a whole, a country takes its city with it). */
export function withoutFilter(query: CatalogueQuery, key: keyof CatalogueQuery): CatalogueQuery {
    const next = { ...query, page: 0 };
    if (key === 'minPrice' || key === 'maxPrice') { next.minPrice = ''; next.maxPrice = ''; }
    else if (key === 'country') { next.country = ''; next.city = ''; }
    else if (key === 'clubId') next.clubId = undefined;
    else if (key === 'currency') next.currency = 'GEL';
    else if (key === 'seller') next.seller = '';
    else if (key === 'sort') next.sort = 'RELEVANCE';
    else if (key === 'page') next.page = 0;
    else next[key] = '';
    return next;
}
