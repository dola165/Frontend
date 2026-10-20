import { ages, formats, levels, type Match } from '../../../matchExchange/api';
import { fetchMatchListings } from '../../api';
import { first, nearbyPoint, type DirectorySource } from '../../directory/types';
import { sentence } from '../../format';

/** Age groups as filter options: codes such as U12 as they are, the rest in words. */
export const AGE_OPTIONS = ages.map(value => ({ value, label: /^U\d+$/.test(value) ? value : sentence(value) }));
const FORMAT_OPTIONS = Object.entries(formats).filter(([key]) => key !== 'OTHER').map(([value, label]) => ({ value, label }));

/** The filters open matches and arrangements share. */
export const exchangeFilters = [
    { kind: 'choice', key: 'format', label: 'Format', primary: true, allLabel: 'Any format', options: FORMAT_OPTIONS },
    { kind: 'nearby', key: 'around', label: 'Near me', km: 50 },
    { kind: 'choice', key: 'ageGroup', label: 'Age group', allLabel: 'Any age group', options: AGE_OPTIONS },
    { kind: 'choice', key: 'level', label: 'Level', allLabel: 'Any level', options: levels.map(value => ({ value, label: sentence(value) })) },
    { kind: 'choice', key: 'venuePreference', label: 'Ground', allLabel: 'Home or away', options: [{ value: 'HOME', label: 'They host' }, { value: 'AWAY', label: 'They travel' }] },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'Until' },
] satisfies DirectorySource<Match>['filters'];

/** One page of open matches, or of my arrangements (`mine`); `country` keeps open matches to the person's own country. */
export async function loadListings(mine: boolean, query: Parameters<DirectorySource<Match>['load']>[0], page: number, signal: AbortSignal, country?: string | null) {
    const params = new URLSearchParams();
    for (const key of ['format', 'ageGroup', 'level', 'venuePreference', 'from', 'to']) if (first(query, key)) params.set(key, first(query, key));
    const around = nearbyPoint(query, 'around');
    if (around) { params.set('lat', String(around.lat)); params.set('lng', String(around.lng)); params.set('radiusKm', '50'); }
    if (query.q) params.set('q', query.q);
    if (mine) params.set('mine', 'true');
    if (country) params.set('country', country);
    if (page) params.set('page', String(page));
    const result = await fetchMatchListings(params, signal);
    const size = result.pageSize ?? 24;
    return { items: result.items, total: result.total, hasMore: (page + 1) * size < result.total };
}
