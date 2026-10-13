import type { Participant } from '../../admissions/types';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { distanceKm } from '../../../components/map/walkingGraph';
import { fetchClubDirectory } from '../api';
import { ClubRow } from '../cards/ClubRow';
import { first, type DirectoryQuery, type DirectorySource } from '../directory/types';
import { wt } from '../copy';
import { clubTypeLabel, distanceLabel } from '../format';
import { ageOn } from '../players';
import { JOIN_POLICY_FILTER } from './clubFilters';

const PAGE = 12;
/** The kinds of club a person thinks in, each standing for the club types the directory knows. */
const KINDS: Record<string, string[]> = { ACADEMY: ['ACADEMY'], SCHOOL: ['SCHOOL'], COMMUNITY: ['GRASSROOTS', 'AMATEUR'], PRO: ['PROFESSIONAL', 'SEMI_PROFESSIONAL'], OTHER: ['OTHER'] };
/** "Taking new players": clubs with open trials or open to applications. */
const TAKING = ['OPEN_TRIAL', 'APPLICATION_REQUIRED'];

/** The club types a query asks for: kinds become their types, and a type from an older link stays as it is. */
export const clubTypes = (query: DirectoryQuery) => [...new Set((query.values.type ?? []).flatMap(value => KINDS[value] ?? [value]))];
/** How to join: the detailed choice when made, otherwise "Taking new players". */
const joinPolicies = (query: DirectoryQuery) => query.values.joinPolicy?.length ? query.values.joinPolicy : first(query, 'open') === 'true' ? TAKING : [];

/** A child as a list names them: first name and age, "Nino (9)". */
export function childLabel(child?: Participant) {
    if (!child) return undefined;
    const name = child.name.split(' ')[0], age = ageOn(child.dateOfBirth);
    return age != null ? `${name} (${age})` : name;
}

/**
 * Clubs near the World area: academies, schools, community and pro clubs. For a parent searching for a child
 * (chosen in the World bar), only clubs with a programme for the child's age are asked for, and each card shows
 * what fits. On the map each club is its own pin.
 */
export function clubsSource({ child, centre }: { child?: Participant; centre?: { lat: number; lng: number } | null } = {}): DirectorySource<ClubProfile> {
    const distance = (club: ClubProfile) => centre && club.latitude != null && club.longitude != null ? distanceKm([centre.lng, centre.lat], [club.longitude, club.latitude]) : undefined;
    return {
        id: 'clubs',
        label: 'Clubs',
        noun: ['club', 'clubs'],
        searchLabel: 'Search clubs',
        searchPlaceholder: 'Search clubs by name or area',
        layout: 'rows',
        pageSize: PAGE,
        area: true,
        version: String(child?.id ?? ''),
        forWhom: childLabel(child),
        filters: [
            { kind: 'choice', key: 'type', label: 'Kind of club', primary: true, multi: true, options: [
                { value: 'ACADEMY', label: 'Academies' }, { value: 'SCHOOL', label: 'Football schools' }, { value: 'COMMUNITY', label: 'Community clubs' }, { value: 'PRO', label: 'Pro clubs' },
            ] },
            { kind: 'toggle', key: 'open', label: 'Taking new players', primary: true },
            { ...JOIN_POLICY_FILTER, primary: false },
        ],
        sorts: [{ value: 'MEMBER_COUNT', label: 'Most members' }, { value: 'NAME', label: 'Name A–Z' }, { value: 'NEWEST', label: 'Newest' }],
        defaults: ({ role }): Record<string, string[]> => role === 'player' ? { open: ['true'] }
            : role === 'academy-director' || role === 'analyst' || role === 'agent' ? { type: ['ACADEMY'] } : {},
        async load(query, page, { signal, area }) {
            const params = new URLSearchParams();
            clubTypes(query).forEach(value => params.append('type', value));
            joinPolicies(query).forEach(value => params.append('joinPolicy', value));
            if (query.q) params.set('search', query.q);
            if (area?.city) params.set('city', area.city);
            // Backend needed: `age` keeps clubs with a published programme for that age.
            const age = ageOn(child?.dateOfBirth);
            if (age != null) params.set('age', String(age));
            if (query.sort && query.sort !== 'NEWEST') params.set('sort', query.sort);
            params.set('page', String(page));
            params.set('size', String(PAGE));
            const result = await fetchClubDirectory(params, signal);
            return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
        },
        key: club => String(club.id),
        Item: ({ item }) => <ClubRow club={item} distanceKm={distance(item)} />,
        line: club => {
            const km = distance(club);
            return {
                title: club.name, to: `/clubs/${club.id}`, action: wt('Open club'), crest: { src: club.logoUrl, name: club.name },
                detail: [wt(clubTypeLabel(club.type)), club.cityName].filter(Boolean).join(' · '),
                ...(club.relationshipState === 'ACTIVE' || club.isMember ? { fact: wt('Member'), factTone: 'accent' as const } : km != null ? { fact: distanceLabel(km) } : {}),
            };
        },
        // Directory records may carry no coordinates; then the map search places the club by its id.
        placeKinds: ['CLUB'],
        place: (club, places) => {
            const known = club.latitude != null && club.longitude != null ? { lat: club.latitude, lng: club.longitude } : places.club(club.id);
            return known ? { lat: known.lat, lng: known.lng, tone: 'club', noun: ['club', 'clubs'], label: club.name, meta: [wt(clubTypeLabel(club.type)), club.cityName].filter(Boolean).join(' · '), to: `/clubs/${club.id}` } : null;
        },
        empty: { title: 'No clubs listed yet', body: 'Clubs appear here when they publish their profile.' },
    };
}
