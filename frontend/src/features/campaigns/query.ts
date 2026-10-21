import { ct } from '../store/copy';
import { CAMPAIGN_CATEGORIES, campaignCategory, type CampaignSort } from './api';

/** A fundraising search, kept whole in the address so refresh, sharing and Back return to the same results. */
export interface FundraisingQuery { query: string; category: string; state: 'ACTIVE' | 'ENDED' | 'ALL'; clubId: number | undefined; country: string; city: string; sort: CampaignSort; page: number }
export const FUNDRAISING_KEYS = ['query', 'category', 'state', 'clubId', 'country', 'city', 'sort', 'page'] as const;
export const PAGE_SIZE = 24;
export const SORTS: Array<{ value: CampaignSort; label: string }> = [
    { value: 'RELEVANCE', label: 'Relevance' }, { value: 'CLOSEST', label: 'Closest to goal' }, { value: 'NEWEST', label: 'Newest' }, { value: 'ENDING', label: 'Ending soon' }, { value: 'RAISED', label: 'Most raised' },
];
export const STATES: Array<{ value: FundraisingQuery['state']; label: string }> = [{ value: 'ACTIVE', label: 'Open now' }, { value: 'ENDED', label: 'Ended' }, { value: 'ALL', label: 'All' }];

export function readFundraising(params: URLSearchParams, fixedClubId?: number): FundraisingQuery {
    const clubParam = Number(params.get('clubId')), state = params.get('state'), sort = params.get('sort');
    return {
        query: (params.get('query') ?? params.get('q') ?? '').slice(0, 100), category: CAMPAIGN_CATEGORIES.some(c => c.value === params.get('category')) ? params.get('category')! : '',
        state: state === 'ENDED' || state === 'ALL' ? state : 'ACTIVE', clubId: fixedClubId ?? (Number.isSafeInteger(clubParam) && clubParam > 0 ? clubParam : undefined),
        country: params.get('country') ?? '', city: params.get('city') ?? '', sort: SORTS.some(s => s.value === sort) ? sort as CampaignSort : 'RELEVANCE',
        page: Math.min(1_000_000, Math.max(0, Math.floor(Number(params.get("page")) || 0))),
    };
}
export function fundraisingSearch(query: Partial<FundraisingQuery>): URLSearchParams {
    const params = new URLSearchParams();
    for (const key of ['query', 'category', 'country', 'city'] as const) if (query[key]) params.set(key, String(query[key]));
    if (query.state && query.state !== 'ACTIVE') params.set('state', query.state);
    if (query.clubId) params.set('clubId', String(query.clubId));
    if (query.sort && query.sort !== 'RELEVANCE') params.set('sort', query.sort);
    if (query.page) params.set("page", String(query.page));
    return params;
}
const withSearch = (path: string, params: URLSearchParams) => { const search = params.toString(); return search ? `${path}?${search}` : path; };
export const fundraisingPath = (query: Partial<FundraisingQuery> = {}) => withSearch('/campaigns/all', fundraisingSearch(query));
export const clubFundraisingPath = (clubId: number, query: Partial<FundraisingQuery> = {}) => withSearch(`/clubs/${clubId}/campaigns`, fundraisingSearch({ ...query, clubId: undefined }));

export function fundraisingHeading(query: FundraisingQuery, clubName?: string | null): { title: string; hint?: string } {
    if (query.clubId) return { title: clubName ? ct("{v0} fundraising", { v0: clubName }) : ct("Club fundraising"), hint: query.category ? campaignCategory(query.category) : undefined };
    if (query.category) return { title: campaignCategory(query.category), hint: query.state === 'ENDED' ? ct("Ended fundraisers") : ct("Open fundraisers from clubs on GrassKickZ") };
    if (query.query) return { title: ct("Results for “{v0}”", { v0: query.query }) };
    return { title: query.state === 'ENDED' ? ct("Ended fundraisers") : query.state === 'ALL' ? ct("All fundraisers") : ct("Open fundraisers"), hint: ct("Projects from clubs on GrassKickZ, backed by their supporters") };
}
export interface ActiveFilter { key: keyof FundraisingQuery; label: string }
export function activeFilters(query: FundraisingQuery, fixedClub: boolean): ActiveFilter[] {
    const list: ActiveFilter[] = [];
    if (query.category) list.push({ key: 'category', label: campaignCategory(query.category) });
    if (query.state !== 'ACTIVE') list.push({ key: 'state', label: ct(STATES.find(s => s.value === query.state)!.label) });
    if (query.clubId && !fixedClub) list.push({ key: 'clubId', label: ct("One club") });
    if (query.city) list.push({ key: 'city', label: query.city }); else if (query.country) list.push({ key: 'country', label: query.country });
    return list;
}
export function withoutFilter(query: FundraisingQuery, key: keyof FundraisingQuery): FundraisingQuery {
    const next = { ...query, page: 0 };
    if (key === 'state') next.state = 'ACTIVE';
    else if (key === 'country') { next.country = ''; next.city = ''; }
    else if (key === 'clubId') next.clubId = undefined;
    else if (key === 'sort') next.sort = 'RELEVANCE';
    else if (key === 'page') next.page = 0;
    else next[key] = '';
    return next;
}
