import { ct } from '../store/copy';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorldArea } from '../world/useWorldArea';
import { useWorldData } from '../world/useWorldData';
import { fetchCampaigns } from './api';
import { FUNDRAISING_KEYS, fundraisingSearch, PAGE_SIZE, readFundraising, type FundraisingQuery } from './query';

/** The fundraising catalogue as the address describes it; every change is written back to the address. */
export function useFundraising(fixedClubId?: number, revision = 0) {
    const [params, setParams] = useSearchParams();
    const query = useMemo(() => readFundraising(params, fixedClubId), [params, fixedClubId]);
    const { area } = useWorldArea();
    const near = area.anywhere ? undefined : area.city;
    const key = `${JSON.stringify(query)}|${near ?? ''}|${revision}`;
    const result = useWorldData(key, signal => fetchCampaigns({
        page: query.page, size: PAGE_SIZE, clubId: query.clubId, query: query.query || undefined, category: query.category || undefined, state: query.state,
        country: query.country || undefined, city: query.city || undefined, sort: query.sort, near,
    }, signal), ct("Fundraisers could not load. Please try again."), { keep: true });
    const update = (next: FundraisingQuery) => setParams(current => {
        const copy = new URLSearchParams(current);
        for (const name of FUNDRAISING_KEYS) copy.delete(name);
        copy.delete('q');
        fundraisingSearch({ ...next, clubId: fixedClubId ? undefined : next.clubId }).forEach((value, name) => copy.set(name, value));
        return copy;
    }, { preventScrollReset: true });
    return { query, update, campaigns: result.data?.content ?? [], total: result.data?.totalElements ?? 0, loading: result.loading, error: result.error, retry: result.retry };
}
