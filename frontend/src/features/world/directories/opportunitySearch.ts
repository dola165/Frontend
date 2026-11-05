import type { DiscoveryQuery, Participant } from '../../admissions/types';
import { first, type DirectoryQuery, type LoadContext } from '../directory/types';

export function trialSearch(query: DirectoryQuery, { area, country, authenticated }: Pick<LoadContext, 'area' | 'country' | 'authenticated'>) {
    const clubId = first(query, 'clubId') || undefined;
    const location = first(query, 'location') || area?.city || undefined;
    const birthYear = first(query, 'birthYear') || undefined;
    return { q: query.q, location, status: first(query, 'status') === 'ALL' ? first(query, 'closed') || 'ALL' : 'OPEN', clubId,
        from: first(query, 'from') || undefined, to: first(query, 'to') || undefined, birthYear,
        countryCode: first(query, 'countryCode') || (country && !clubId && !location ? country : undefined),
        forMe: !birthYear && authenticated && first(query, 'forMe') === 'true' ? 'true' : undefined };
}
export function groupSearch(query: DirectoryQuery, participant: Participant | undefined, { area, country }: Pick<LoadContext, 'area' | 'country'>): DiscoveryQuery {
    const typed = first(query, 'birthYear');
    const born = typed || participant?.dateOfBirth?.slice(0, 4);
    const id = (key: string) => Number(first(query, key)) > 0 ? Number(first(query, key)) : undefined;
    return { q: query.q || undefined, acceptingOnly: first(query, 'all') !== 'true', includeWaitlist: first(query, 'includeWaitlist') === 'true',
        beginner: first(query, 'beginner') === 'true' ? true : undefined,
        gender: (first(query, 'gender') || participant?.gender || undefined) as DiscoveryQuery['gender'],
        method: (first(query, 'method') || undefined) as DiscoveryQuery['method'],
        clubId: id('club'), organizationId: id('organization'), birthYear: born ? Number(born) : undefined,
        city: query.values.city?.length ? query.values.city : area?.city ? [area.city] : undefined,
        country: query.values.country?.length ? query.values.country : country && !id('club') && !id('organization') ? [country] : undefined };
}
export function publicParams(values: object) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
        if (value == null) continue;
        (Array.isArray(value) ? value : [value]).forEach(item => params.append(key, String(item)));
    }
    return params;
}
