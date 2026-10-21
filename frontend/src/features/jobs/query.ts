import { ct } from '../store/copy';
import { CATEGORIES, categoryLabel, HOURS, hoursLabel, TERMS, termsLabel, type JobDirection, type JobSort } from './api';

/** A jobs search, whole in the address; `job` is the listing open beside the list. */
export interface JobsSearch { query: string; direction: '' | JobDirection; category: string; terms: string; hours: string; poster: '' | 'clubs' | 'people'; country: string; city: string; posted: '' | '7D' | '30D'; clubId: number | undefined; sort: JobSort; page: number; job: number | undefined }
export const JOBS_KEYS = ['query', 'direction', 'category', 'terms', 'hours', 'poster', 'country', 'city', 'posted', 'clubId', 'sort', 'page', 'job'] as const;
export const PAGE_SIZE = 24;
export const SORTS: Array<{ value: JobSort; label: string }> = [{ value: 'RELEVANCE', label: 'Relevance' }, { value: 'NEWEST', label: 'Newest' }, { value: 'NEAREST', label: 'Nearest' }];

export function readJobs(params: URLSearchParams, fixedClubId?: number): JobsSearch {
    const clubParam = Number(params.get('clubId')), jobParam = Number(params.get("job")), direction = params.get('direction'), poster = params.get('poster'), posted = params.get('posted'), sort = params.get('sort');
    return {
        query: (params.get('query') ?? params.get('q') ?? '').slice(0, 100), direction: direction === 'HIRING' || direction === 'OFFERING' ? direction : '',
        category: CATEGORIES.some(c => c.value === params.get('category')) ? params.get('category')! : '', terms: TERMS.some(t => t.value === params.get('terms')) ? params.get('terms')! : '',
        hours: HOURS.some(h => h.value === params.get('hours')) ? params.get('hours')! : '', poster: poster === 'clubs' || poster === 'people' ? poster : '',
        country: params.get('country') ?? '', city: params.get('city') ?? '', posted: posted === '7D' || posted === '30D' ? posted : '',
        clubId: fixedClubId ?? (Number.isSafeInteger(clubParam) && clubParam > 0 ? clubParam : undefined), sort: SORTS.some(s => s.value === sort) ? sort as JobSort : 'RELEVANCE',
        page: Math.min(1_000_000, Math.max(0, Math.floor(Number(params.get("page")) || 0))), job: Number.isSafeInteger(jobParam) && jobParam > 0 ? jobParam : undefined,
    };
}
export function jobsSearch(query: Partial<JobsSearch>): URLSearchParams {
    const params = new URLSearchParams();
    for (const key of ['query', 'direction', 'category', 'terms', 'hours', 'poster', 'country', 'city', 'posted'] as const) if (query[key]) params.set(key, String(query[key]));
    if (query.clubId) params.set('clubId', String(query.clubId));
    if (query.sort && query.sort !== 'RELEVANCE') params.set('sort', query.sort);
    if (query.page) params.set("page", String(query.page));
    if (query.job) params.set("job", String(query.job));
    return params;
}
const withSearch = (path: string, params: URLSearchParams) => { const search = params.toString(); return search ? `${path}?${search}` : path; };
export const jobsPath = (query: Partial<JobsSearch> = {}) => withSearch('/jobs/all', jobsSearch(query));
export const clubJobsPath = (clubId: number, query: Partial<JobsSearch> = {}) => withSearch(`/clubs/${clubId}/jobs`, jobsSearch({ ...query, clubId: undefined }));
/** The same search on World's map (its Jobs tab reads `q`, `category`, `engagement`, `city`). */
export const worldJobsPath = (query: JobsSearch) => {
    const params = new URLSearchParams({ tab: "jobs" });
    if (query.query) params.set('q', query.query);
    if (query.category) params.set('category', query.category);
    if (query.terms) params.set('engagement', query.terms);
    if (query.city) params.set('city', query.city);
    if (query.posted) params.set('posted', query.posted);
    return `/world/opportunities?${params}`;
};

export function jobsHeading(query: JobsSearch, clubName?: string | null): { title: string; hint?: string } {
    const people = query.direction === 'OFFERING';
    if (query.clubId) return { title: clubName ? ct("{v0} jobs", { v0: clubName }) : ct("Club jobs"), hint: query.category ? categoryLabel(query.category) : ct("Jobs and volunteering at the club") };
    if (query.category) return { title: people ? ct("{v0}: people available", { v0: categoryLabel(query.category) }) : categoryLabel(query.category), hint: people ? ct("Coaches, referees and specialists offering their time") : query.terms === 'VOLUNTEER' ? ct("Volunteer roles") : ct("Open jobs from clubs and people") };
    if (people) return { title: ct("People available"), hint: ct("Coaches, referees and specialists offering their time") };
    if (query.poster === 'people') return { title: ct("Posted by people"), hint: ct("Parents and players looking for a coach, a trainer or help") };
    if (query.terms === 'VOLUNTEER') return { title: ct("Volunteering"), hint: ct("Give a few hours to a club near you") };
    if (query.query) return { title: ct("Results for “{v0}”", { v0: query.query }) };
    return { title: ct("All jobs"), hint: ct("Open jobs and volunteering from clubs and people on GrassKickZ") };
}
export interface ActiveFilter { key: keyof JobsSearch; label: string }
export function activeFilters(query: JobsSearch, fixedClub: boolean): ActiveFilter[] {
    const list: ActiveFilter[] = [];
    if (query.direction === 'OFFERING') list.push({ key: 'direction', label: ct("People available") });
    if (query.direction === 'HIRING') list.push({ key: 'direction', label: ct("Jobs only") });
    if (query.category) list.push({ key: 'category', label: categoryLabel(query.category) });
    if (query.terms && termsLabel(query.terms)) list.push({ key: 'terms', label: termsLabel(query.terms)! });
    if (query.hours && hoursLabel(query.hours)) list.push({ key: 'hours', label: hoursLabel(query.hours)! });
    if (query.poster) list.push({ key: 'poster', label: query.poster === 'clubs' ? ct("Posted by clubs") : ct("Posted by people") });
    if (query.clubId && !fixedClub) list.push({ key: 'clubId', label: ct("One club") });
    if (query.city) list.push({ key: 'city', label: query.city }); else if (query.country) list.push({ key: 'country', label: query.country });
    if (query.posted) list.push({ key: 'posted', label: query.posted === '7D' ? ct("Past 7 days") : ct("Past 30 days") });
    return list;
}
export function withoutFilter(query: JobsSearch, key: keyof JobsSearch): JobsSearch {
    const next = { ...query, page: 0, job: undefined };
    if (key === 'country') { next.country = ''; next.city = ''; }
    else if (key === 'clubId' || key === 'job') next[key] = undefined;
    else if (key === 'sort') next.sort = 'RELEVANCE';
    else if (key === 'page') next.page = 0;
    else next[key] = '' as never;
    return next;
}
