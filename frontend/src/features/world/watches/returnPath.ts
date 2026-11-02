import { notificationId } from '../../../utils/notificationDestinations';
import type { SearchWatch } from './api';

/** Rebuild from the authorized, effective API criteria, never later browser memory or stale URL filters. */
export function searchReturnPath(watch: Pick<SearchWatch, 'query' | 'returnPath' | 'childId'>): string | null {
    const raw = watch.returnPath;
    if (!/^\/(world(\/(clubs|opportunities|tournaments))?|parent)(\?|$)/.test(raw)
        || Array.from(raw).some(char => char === '#' || char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
    const original = new URL(raw, 'https://world.invalid');
    const filters = watch.query.filters;
    const kind = watch.query.kind;
    const parent = kind === 'CLUBS' && original.pathname === '/parent';
    const path = parent ? '/parent' : kind === 'CLUBS' ? '/world/clubs' : kind === 'TOURNAMENTS' ? '/world/tournaments' : '/world/opportunities';
    const params = new URLSearchParams();
    params.set('defaults', 'none');
    if (parent) params.set('find', 'club');
    else params.set('tab', kind === 'CLUBS' ? 'clubs' : kind === 'TOURNAMENTS' ? 'all' : kind === 'GROUPS' ? 'groups' : 'trials');
    const player = notificationId(watch.childId) ?? notificationId(original.searchParams.get('player'));
    params.set('player', player ?? 'anyone');
    const squad = !player && notificationId(original.searchParams.get('for'));
    if (squad) params.set('for', squad);
    params.set('near', original.searchParams.get('near') || 'anywhere');
    const put = (from: string, to = from) => (filters[from] ?? []).forEach(value => params.append(to, value));
    const first = (key: string) => filters[key]?.[0];
    put(kind === 'CLUBS' ? 'search' : 'q', 'q');
    put('birthYear');
    if (kind === 'CLUBS') {
        ['type', 'country', 'city', 'joinPolicy', 'ageGroup', 'gender', 'age', 'day', 'km'].forEach(key => put(key));
        if (first('feeMin') || first('feeMax')) params.set('fee', `${first('feeMin') ?? ''}-${first('feeMax') ?? ''}`);
        if (first('lat') && first('lng')) params.set('around', `${first('lat')},${first('lng')}`);
    } else if (kind === 'GROUPS') {
        ['country', 'city', 'gender', 'method', 'beginner', 'includeWaitlist'].forEach(key => put(key));
        put('clubId', 'club'); put('organizationId', 'organization');
        if (first('acceptingOnly') === 'false') params.set('all', 'true');
    } else if (kind === 'TRIALS') {
        ['location', 'clubId', 'from', 'to', 'countryCode'].forEach(key => put(key));
        const status = first('status') ?? 'OPEN';
        params.set('status', status === 'OPEN' ? 'OPEN' : 'ALL');
        if (status !== 'OPEN' && status !== 'ALL') params.set('closed', status);
        params.set('forMe', 'false');
    } else {
        ['family', 'structure', 'ageGroup', 'discipline', 'sideSize', 'scope', 'status', 'city', 'from', 'to', 'currency', 'maxFee', 'country', 'countryCode', 'playingLevel', 'eligibilityCategory', 'openPlaces', 'registration', 'minFee', 'feeBasis', 'radiusKm'].forEach(key => put(key));
        if (first('hostKind') && first('hostId')) params.set('host', `${first('hostKind')}:${first('hostId')}`);
        if (first('latitude') && first('longitude')) params.set('around', `${first('latitude')},${first('longitude')}`);
    }
    // Sorting and an opened result are presentation state; private criteria above remain authoritative.
    for (const key of ['sort', 'selected']) if (original.searchParams.get(key)) params.set(key, original.searchParams.get(key)!);
    return `${path}?${params}`;
}
