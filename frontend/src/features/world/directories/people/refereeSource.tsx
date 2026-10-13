import { Flag } from 'lucide-react';
import { apiClient, type AuthSessionRequestConfig } from '../../../../api/axiosConfig';
import { distanceKm } from '../../../../components/map/walkingGraph';
import { get as exchangeGet, type Match, type Referee } from '../../../matchExchange/api';
import { fetchReferees } from '../../api';
import { shared } from '../../cache';
import { wt } from '../../copy';
import type { ResultGroup } from '../../directory/groups';
import { first, type BrowseLine, type DirectorySource, type FilterDef, type Placement } from '../../directory/types';
import { listingDetail } from '../../front/coach/coachMatches';
import { cityCentre, firstCity } from './peopleData';
import { kmLabel } from './personData';
import { RefereeResult } from './RefereeResult';
import { peekOf } from '../../peek/usePeek';
import { formatsOf, matchName, SHORT, shortFormat, terms, type RefereeItem } from './refereeData';

const PAGE = 24;
const matchId = (value: string) => /^[1-9]\d*$/.test(value) ? Number(value) : null;

/** Referees a squad's club has appointed (squad staff only: anyone else sees none). */
const clubReferees = (sessionId: AuthSessionRequestConfig['_authSessionId'], squadId: number) => shared(`club-referees:${sessionId}:${squadId}`,
    () => apiClient.get<Referee[]>(`/referees/club-squad/${squadId}`, { _authSessionId: sessionId } as AuthSessionRequestConfig).then(response => response.data).catch(() => [] as Referee[]), 300_000);

const filters: FilterDef[] = [
    { kind: 'scope', key: 'match', label: 'One match', name: (value, signal) => matchId(value)
        ? exchangeGet<Match>(`/match-exchange/${matchId(value)}`, undefined, signal).then(matchName).catch(() => null) : Promise.resolve(null) },
    { kind: 'choice', key: 'format', label: 'Format', allLabel: 'Any format', primary: true, when: query => !first(query, 'match'),
        options: Object.keys(SHORT).map(value => ({ value, label: SHORT[value] })) },
    { kind: 'toggle', key: 'volunteer', label: 'Volunteers', primary: true },
    { kind: 'toggle', key: 'free', label: 'Free at kick-off', primary: true, when: query => Boolean(first(query, 'match')) },
];

const BENCH: Record<NonNullable<RefereeItem['bench']>, ResultGroup> = {
    club: { key: 'club', label: 'Your club’s referees', rank: 0 },
    reach: { key: 'reach', label: 'Reach your ground', rank: 1 },
    far: { key: 'far', label: 'Further away', rank: 2 },
    unknown: { key: 'unknown', label: 'Distance not known', rank: 3 },
};
const ALL: ResultGroup = { key: 'all', label: 'Referees' };
const cityPin = (city: string) => `area:${city.trim().toLowerCase()}`;

/** A referee as one line of the Browse area: their formats, how far or where, and their terms. */
function refereeLine({ referee, city, km }: RefereeItem): BrowseLine {
    const where = [city, kmLabel(km, true)].filter(Boolean).join(' · ');
    return { title: referee.full_name, crest: { name: referee.full_name, round: true }, to: `/referees/${referee.user_id}`, action: wt('Open profile'), peek: peekOf('person', referee.user_id),
        detail: [formatsOf(referee).map(shortFormat).join(' · '), where].filter(Boolean).join(' · '), fact: terms(referee),
        factTone: referee.accepts_volunteer ? 'accent' : undefined };
}

/**
 * Referees you book, the nearest to the World area first (they are counted at the first city they state). With a
 * match chosen (from the Dugout), the list is that match's format, distances are from its ground, its referees are on
 * a bench (your club's, those whose stated area reaches the ground, the rest), and "Free at kick-off" asks who marked
 * that time free. The chosen one shows their stated area.
 */
export const refereeSource: DirectorySource<RefereeItem> = {
    id: 'referees', label: 'Referees', noun: ['referee', 'referees'], icon: Flag, subtitle: 'Book a referee for your match',
    searchLabel: 'Search referees', searchPlaceholder: 'Name, area or language', pageSize: PAGE, area: 'nearest',
    signInReason: 'Profiles of coaches, players, referees and specialists are visible to signed-in members.',
    filters,
    sorts: [{ value: 'NEAREST', label: 'Nearest' }, { value: 'FEE', label: 'Volunteers, then lowest fee' }, { value: 'NAME', label: 'Name A–Z' }],
    count: async ({ signal }) => (await fetchReferees({ page: 0 }, signal)).total,
    async load(query, page, { signal, sessionId, area }) {
        const id = matchId(first(query, 'match'));
        const match = id ? await listingDetail(sessionId, id) : undefined;
        const free = match && first(query, 'free') === 'true';
        const result = await fetchReferees({ q: query.q || undefined, format: match?.format ?? (first(query, 'format') || undefined), volunteer: first(query, 'volunteer') || undefined,
            from: free ? match.starts_at_iso : undefined, to: free ? match.ends_at_iso : undefined, page }, signal);
        const squad = match && (match.referee_responsibility === 'OPPONENT' ? match.target_squad_id : match.squad_id);
        const ours = new Set((squad ? await clubReferees(sessionId, squad) : []).map(referee => referee.user_id));
        const cities = [...new Set(result.items.map(referee => firstCity(referee.service_area)).filter((city): city is string => Boolean(city)))];
        const centres = new Map(await Promise.all(cities.map(async city => [city, await cityCentre(city)] as const)));
        // Distances are from the match's ground when one is chosen, else from the World area's centre.
        const ground = match ? (match.location_lat != null && match.location_lng != null ? [match.location_lng, match.location_lat] as [number, number] : null)
            : area?.centre ? [area.centre.lng, area.centre.lat] as [number, number] : null;
        const items = result.items.map((referee): RefereeItem => {
            const city = firstCity(referee.service_area), centre = city ? centres.get(city) ?? null : null;
            const km = ground && centre ? distanceKm(ground, [centre.lng, centre.lat]) : undefined;
            if (!match) return { referee, city, centre, km };
            return { referee, city, centre, match, km, bench: ours.has(referee.user_id) ? 'club' : km == null ? 'unknown' : km <= referee.travel_km ? 'reach' : 'far' };
        });
        // Within the page (the server sorts by name): the nearest first, or volunteers first and then the lower fee.
        const fee = (item: RefereeItem) => item.referee.accepts_volunteer ? -1 : item.referee.accepts_paid ? item.referee.fee : Infinity;
        if (query.sort === 'FEE') items.sort((a, b) => fee(a) - fee(b) || (a.km ?? Infinity) - (b.km ?? Infinity));
        else if (query.sort !== 'NAME') items.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || fee(a) - fee(b));
        const size = result.pageSize ?? PAGE;
        return { items, total: result.total, hasMore: (page + 1) * size < result.total };
    },
    key: item => String(item.referee.user_id),
    Item: RefereeResult,
    line: refereeLine,
    place: ({ city, centre }): Placement | null => city && centre ? { lat: centre.lat, lng: centre.lng, tone: 'person', pin: cityPin(city), approximate: 'area', label: city, noun: ['referee', 'referees'] } : null,
    reach: ({ referee, centre }) => centre && referee.travel_km > 0
        ? { lat: centre.lat, lng: centre.lng, km: referee.travel_km, label: wt('{name}: up to {km} km, as stated', { name: referee.full_name, km: referee.travel_km }) } : null,
    // Only a chosen match puts referees on a bench; otherwise the list is one list, the nearest first.
    groups: { of: item => item.bench ? BENCH[item.bench] : ALL },
    empty: { title: 'No referees listed yet', body: 'Referees appear here when they publish a referee profile.' },
};
