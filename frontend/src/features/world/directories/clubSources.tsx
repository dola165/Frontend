import { CreateLink } from '../../pages/create/CreateLink';
import { pt } from '../../pages/copy';
import type { Participant } from '../../admissions/types';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import type { ClubLocationItem } from '../../../components/discovery/clubLocationTypes';
import { distanceKm } from '../../../components/map/walkingGraph';
import { fetchClubDirectory } from '../api';
import { ClubRow } from '../cards/ClubRow';
import { first, rangeOf, type DirectoryQuery, type DirectorySource, type FilterOption } from '../directory/types';
import { wt } from '../copy';
import { clubTypeLabel, distanceLabel } from '../format';
import { ageOn } from '../players';
import { JOIN_POLICY_FILTER } from './clubFilters';
import { AGE_OPTIONS } from './matches/listings';

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

/** The countries and cities clubs are in, each once, in alphabetical order, as choices. */
export function placeOptions(locations: ClubLocationItem[] = []): { countries: FilterOption[]; cities: FilterOption[] } {
    const names = (pick: (item: ClubLocationItem) => string | null | undefined) =>
        [...new Set(locations.map(item => pick(item)?.split(',')[0].trim()).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name }));
    return { countries: names(item => item.countryName), cities: names(item => item.cityName) };
}

/**
 * Clubs near the World area: academies, schools, community and pro clubs. For a parent searching for a child
 * (chosen in the World bar), only clubs with a programme for the child's age are asked for, and each card shows
 * what fits. On the map each club is its own pin. `locations` (every club's country and city) fill the place choices.
 */
export function clubsSource({ child, centre, locations }: { child?: Participant; centre?: { lat: number; lng: number } | null; locations?: ClubLocationItem[] } = {}): DirectorySource<ClubProfile> {
    const distance = (club: ClubProfile) => centre && club.latitude != null && club.longitude != null ? distanceKm([centre.lng, centre.lat], [club.longitude, club.latitude]) : undefined;
    const places = placeOptions(locations);
    return {
        id: 'clubs',
        label: 'Clubs',
        noun: ['club', 'clubs'],
        searchLabel: 'Search clubs',
        searchPlaceholder: 'Search clubs by name or area',
        pageSize: PAGE,
        area: true,
        version: String(child?.id ?? ''),
        forWhom: childLabel(child),
        // The list is narrowed to the chosen child's age: its heading says so ("Clubs for Nino (8)").
        heading: child ? () => wt('Clubs for {name}', { name: childLabel(child)! }) : undefined,
        filters: [
            { kind: 'choice', key: 'type', label: 'Club type', primary: true, multi: true, options: [
                { value: 'ACADEMY', label: 'Academies' }, { value: 'SCHOOL', label: 'Football schools' }, { value: 'COMMUNITY', label: 'Community clubs' }, { value: 'PRO', label: 'Pro clubs' },
            ] },
            // Where, who for and what it costs, in the order a parent asks; the backend takes them as named here.
            { kind: 'choice', key: 'country', label: 'Country', primary: true, allLabel: 'Any country', options: places.countries },
            { kind: 'choice', key: 'city', label: 'City', primary: true, allLabel: 'Any city', options: places.cities },
            { kind: 'choice', key: 'ageGroup', label: 'Age group', primary: true, allLabel: 'Any age group', options: AGE_OPTIONS },
            { kind: 'choice', key: 'gender', label: 'Gender', primary: true, allLabel: 'Everyone', options: [{ value: 'MALE', label: 'Boys and men' }, { value: 'FEMALE', label: 'Girls and women' }, { value: 'MIXED', label: 'Mixed' }] },
            { kind: 'range', key: 'fee', label: 'Training fee', primary: true, unit: 'GEL / month' },
            { kind: 'toggle', key: 'open', label: 'Taking new players', primary: true },
            // Every club filter is on its own line: nothing behind More filters.
            JOIN_POLICY_FILTER,
        ],
        sorts: [{ value: 'MEMBER_COUNT', label: 'Most members' }, { value: 'NAME', label: 'Name A–Z' }, { value: 'NEWEST', label: 'Newest' }],
        defaults: ({ role }): Record<string, string[]> => role === 'player' ? { open: ['true'] }
            : role === 'academy-director' || role === 'analyst' || role === 'agent' ? { type: ['ACADEMY'] } : {},
        async load(query, page, { signal, area }) {
            const params = new URLSearchParams();
            clubTypes(query).forEach(value => params.append('type', value));
            joinPolicies(query).forEach(value => params.append('joinPolicy', value));
            if (query.q) params.set('search', query.q);
            // A city chosen in the filters is searched instead of the World area's.
            const city = first(query, 'city') || area?.city;
            if (city) params.set('city', city);
            for (const key of ['country', 'ageGroup', 'gender']) if (first(query, key)) params.set(key, first(query, key));
            const [feeMin, feeMax] = rangeOf(first(query, 'fee'));
            if (feeMin) params.set('feeMin', feeMin);
            if (feeMax) params.set('feeMax', feeMax);
            // The server matches age and price against the same current published programme.
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
        empty: { title: 'No clubs listed yet', body: 'Clubs appear here when they publish their profile.', action: <CreateLink kind="CLUB" from="world-clubs" size="sm">{pt('Is your club missing? Add it')}</CreateLink> },
    };
}
