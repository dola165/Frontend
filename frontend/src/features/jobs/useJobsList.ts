import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorldArea } from '../world/useWorldArea';
import { useWorldData } from '../world/useWorldData';
import { fetchJobs } from './api';
import { JOBS_KEYS, jobsSearch, PAGE_SIZE, readJobs, type JobsSearch } from './query';

/** The jobs catalogue as the address describes it; every change is written back to the address. `job` (the listing open beside the list) never reloads the list. */
export function useJobsList(fixedClubId?: number, revision = 0) {
    const [params, setParams] = useSearchParams();
    const query = useMemo(() => readJobs(params, fixedClubId), [params, fixedClubId]);
    const { area } = useWorldArea();
    const near = area.anywhere ? undefined : area.city;
    const key = `${JSON.stringify({ ...query, job: undefined })}|${near ?? ''}|${revision}`;
    const result = useWorldData(key, signal => fetchJobs({
        page: query.page, size: PAGE_SIZE, query: query.query || undefined, direction: query.direction || 'ALL', category: query.category || undefined, terms: query.terms || undefined, hours: query.hours || undefined,
        poster: query.poster || undefined, country: query.country || undefined, city: query.city || undefined, posted: query.posted || undefined, clubId: query.clubId, sort: query.sort, near,
    }, signal), 'Listings could not load. Please try again.', { keep: true });
    const update = (next: JobsSearch, replace = false) => setParams(current => {
        const copy = new URLSearchParams(current);
        for (const name of JOBS_KEYS) copy.delete(name);
        copy.delete('q');
        jobsSearch({ ...next, clubId: fixedClubId ? undefined : next.clubId }).forEach((value, name) => copy.set(name, value));
        return copy;
    }, { replace, preventScrollReset: true });
    return { query, update, jobs: result.data?.content ?? [], total: result.data?.totalElements ?? 0, loading: result.loading, error: result.error, retry: result.retry };
}
