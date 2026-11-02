import { CreateLink } from '../../pages/create/CreateLink';
import { pt } from '../../pages/copy';
import type { Participant } from '../../admissions/types';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import type { ClubLocationItem } from '../../../components/discovery/clubLocationTypes';
import { distanceKm } from '../../../components/map/walkingGraph';
import { fetchClubDirectory, fetchFollowedClubs } from '../api';
import { ClubRow } from '../cards/ClubRow';
import { first, nearbyPoint, rangeOf, type DirectoryArea, type DirectoryQuery, type DirectorySource, type FilterOption } from '../directory/types';
import { wt } from '../copy';
import { clubTypeLabel, distanceLabel } from '../format';
import { ageOn } from '../players';
import { JOIN_POLICY_FILTER } from './clubFilters';
import { AGE_OPTIONS } from './matches/listings';
import { FinderNamedGroup } from '../finder/FinderNamedGroup';
import { searchSpec } from '../watches/api';
import { FinderYou } from '../finder/FinderYou';

export function clubSearchParams(query: DirectoryQuery, { child, centre, finder = false, area }: { child?: Participant; centre?: { lat: number; lng: number } | null; finder?: boolean; area?: DirectoryArea } = {}) {
    const params = new URLSearchParams();
    clubTypes(query).forEach(value => params.append('type', value));
    joinPolicies(query).forEach(value => params.append('joinPolicy', value));
    if (query.q) params.set('search', query.q);
    // Near the person: the clubs within the distance, nearest first; then no city narrows it. "Nearest first" with
    // any distance sends the place alone, only to order the list (the finder's default). Otherwise a city chosen in
    // the filters is searched instead of the World area's.
    const km = first(query, 'km');
    const nearest = query.sort === 'NEAREST' || (!query.sort && finder);
    const point = nearbyPoint(query, 'around') || (!query.values.city?.length ? centre : null);
    if (point && (km || nearest || first(query, 'around'))) { params.set('lat', point.lat.toFixed(5)); params.set('lng', point.lng.toFixed(5)); if (km) params.set('km', km); }
    const cities = query.values.city?.length ? query.values.city : !finder && !(point && km) && area?.city ? [area.city] : [];
    cities.forEach(city => params.append('city', city));
    (query.values.day ?? []).forEach(day => params.append('day', day));
    (query.values.country ?? []).forEach(value => params.append('country', value));
    for (const key of ['ageGroup', 'gender']) if (first(query, key)) params.set(key, first(query, key));
    const [feeMin, feeMax] = rangeOf(first(query, 'fee'));
    if (feeMin) params.set('feeMin', feeMin);
    if (feeMax) params.set('feeMax', feeMax);
    // The server matches age and price against the same current published programme.
    const age = typedAge(query);
    const born = first(query, 'birthYear') || (!first(query, 'ageGroup') ? child?.dateOfBirth?.slice(0, 4) : undefined);
    if (age != null) params.set('age', String(age));
    else if (born) params.set('birthYear', born);
    // Nearest first is only for a list measured from a place.
    if (query.sort && query.sort !== 'NEWEST' && (query.sort !== 'NEAREST' || params.has('lat'))) params.set('sort', query.sort);
    else if (!query.sort && params.has('lat')) params.set('sort', 'NEAREST');
    return params;
}

const PAGE = 12;
/** The kinds of club a person thinks in, each standing for the club types the directory knows. */
const KINDS: Record<string, string[]> = { ACADEMY: ['ACADEMY'], SCHOOL: ['SCHOOL'], COMMUNITY: ['GRASSROOTS', 'AMATEUR'], PRO: ['PROFESSIONAL', 'SEMI_PROFESSIONAL'], OTHER: ['OTHER'] };
/** A player's age typed into the address (the welcome's landing, a shared link): a whole number from 3 to 99. */
const typedAge = (query: DirectoryQuery) => { const age = Number(first(query, 'age')); return Number.isInteger(age) && age >= 3 && age <= 99 ? age : undefined; };
/** "Taking new players": clubs with open trials or open to applications. */
const TAKING = ['OPEN_TRIAL', 'APPLICATION_REQUIRED'];
/** How far from the person a club may be, and the weekdays a squad trains on (the backend's MON…SUN). */
const DISTANCES = ['2', '5', '10', '25'];
const WEEKDAYS: [string, string][] = [['MON', 'Mon'], ['TUE', 'Tue'], ['WED', 'Wed'], ['THU', 'Thu'], ['FRI', 'Fri'], ['SAT', 'Sat'], ['SUN', 'Sun']];
/** A child's gender as the clubs that take them: boys' or girls' squads, and mixed ones. */
export const childGender = (gender?: 'MALE' | 'FEMALE' | null) => gender === 'MALE' ? 'MALE,MIXED' : gender === 'FEMALE' ? 'FEMALE,MIXED' : undefined;

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
export function clubsSource({ child, centre, locations, following = false, finder = false }: { following?: boolean; child?: Participant; centre?: { lat: number; lng: number } | null; locations?: ClubLocationItem[];
    /** Parent Hub's club finder: near the person rather than a city, the ways in on each club. */ finder?: boolean } = {}): DirectorySource<ClubProfile> {
    const distance = (club: ClubProfile) => centre && club.latitude != null && club.longitude != null ? distanceKm([centre.lng, centre.lat], [club.longitude, club.latitude]) : undefined;
    const places = placeOptions(locations);
    return {
        id: 'clubs',
        forContext: !following,
        watch: following ? undefined : (query, { area }) => searchSpec('CLUBS', clubSearchParams(query, { child, centre, finder, area })),
        label: following ? 'Clubs you follow' : 'Clubs',
        noun: ['club', 'clubs'],
        searchLabel: 'Search clubs',
        searchPlaceholder: 'Search clubs by name or area',
        pageSize: PAGE,
        area: !following,
        signInReason: following ? 'Sign in to see clubs you follow.' : undefined,
        version: `${following}:${child?.id ?? ''}:${finder}:${centre ? `${centre.lat.toFixed(3)},${centre.lng.toFixed(3)}` : ''}`,
        forWhom: following ? undefined : childLabel(child),
        // The list is narrowed to the chosen child's age: its heading says so ("Clubs for Nino (8)"; in Parent Hub's pop-up,
        // whose title already gives the birth year, just "Clubs for Nino", never a number that reads as a count).
        heading: !following && child ? () => wt('Clubs for {name}', { name: finder ? child.name.split(' ')[0] : childLabel(child)! }) : undefined,
        filters: following ? [] : [
            { kind: 'choice', key: 'type', label: 'Club type', primary: true, multi: true, options: [
                { value: 'ACADEMY', label: 'Academies' }, { value: 'SCHOOL', label: 'Football schools' }, { value: 'COMMUNITY', label: 'Community clubs' }, { value: 'PRO', label: 'Pro clubs' },
            ] },
            // Where, who for and what it costs, in the order a parent asks; the backend takes them as named here.
            // The finder searches near the person, so a country or city never narrows it.
            { kind: 'choice', key: 'country', label: 'Country', primary: true, allLabel: 'Any country', options: places.countries, when: () => !finder },
            { kind: 'scope', key: 'city', label: 'City' },
            { kind: 'scope', key: 'around', label: 'Near the place chosen' },
            // A chosen child's birth date already says which programmes fit.
            child ? { kind: 'scope', key: 'ageGroup', label: 'Age group' } : { kind: 'choice', key: 'ageGroup', label: 'Age group', primary: true, allLabel: 'Any age group', options: AGE_OPTIONS },
            // A player's age without a child chosen in the World bar (the welcome lands here with it): clubs whose
            // programme takes that age, as the welcome listed them. A removable chip; a chosen child wins.
            child ? { kind: 'scope', key: 'age', label: 'Player’s age' } : { kind: 'text', key: 'age', label: 'Player’s age', placeholder: 'For example 9', inputMode: 'numeric', primary: true },
            { kind: 'choice', key: 'gender', label: 'Gender', primary: true, allLabel: 'Everyone', options: [
                ...(child ? [{ value: 'MALE,MIXED', label: 'Boys and mixed' }, { value: 'FEMALE,MIXED', label: 'Girls and mixed' }] : []),
                { value: 'MALE', label: 'Boys and men' }, { value: 'FEMALE', label: 'Girls and women' }, { value: 'MIXED', label: 'Mixed' }] },
            // Distance from the person (the town they gave, "You" on the map, or their device) and the days a squad trains.
            { kind: 'choice', key: 'km', label: 'Distance', primary: true, allLabel: 'Any distance', options: DISTANCES.map(km => ({ value: km, label: `${km} km` })), when: query => Boolean(centre || nearbyPoint(query, 'around')) },
            { kind: 'choice', key: 'day', label: 'Training days', primary: true, multi: true, allLabel: 'Any day', options: WEEKDAYS.map(([value, label]) => ({ value, label })) },
            { kind: 'range', key: 'fee', label: 'Training fee', primary: true, unit: 'GEL / month' },
            { kind: 'toggle', key: 'open', label: 'Taking new players', primary: true },
            // Every club filter is on its own line: nothing behind More filters.
            JOIN_POLICY_FILTER,
        ],
        // The finder lists the nearest first; World keeps its own order and offers nearest first beside it.
        sorts: [...(finder && centre ? [{ value: 'NEAREST', label: 'Nearest first' }] : []), { value: 'MEMBER_COUNT', label: 'Most members' }, { value: 'NAME', label: 'Name A–Z' }, { value: 'NEWEST', label: 'Newest' },
            ...(!finder && centre ? [{ value: 'NEAREST', label: 'Nearest first' }] : [])],
        defaults: ({ role }): Record<string, string[]> => following ? {} : finder ? { km: ['10'], ...(childGender(child?.gender) ? { gender: [childGender(child?.gender)!] } : {}) } : role === 'player' ? { open: ['true'] }
            : role === 'academy-director' || role === 'analyst' || role === 'agent' ? { type: ['ACADEMY'] } : {},
        async load(query, page, { signal, area }) {
            if (following) {
                const clubs = await fetchFollowedClubs(signal);
                const q = query.q.trim().toLocaleLowerCase();
                const matched = clubs.filter(club => !q || `${club.name} ${club.cityName ?? ''} ${club.countryName ?? ''}`.toLocaleLowerCase().includes(q));
                matched.sort((a, b) => query.sort === 'MEMBER_COUNT' ? (b.memberCount ?? 0) - (a.memberCount ?? 0) : a.name.localeCompare(b.name));
                return { items: matched.slice(page * PAGE, (page + 1) * PAGE).map(club => ({ ...club, isFollowedByMe: true })), total: matched.length, hasMore: (page + 1) * PAGE < matched.length };
            }
            const params = clubSearchParams(query, { child, centre, finder, area });
            params.set('page', String(page));
            params.set('size', String(PAGE));
            const result = await fetchClubDirectory(params, signal);
            return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
        },
        key: club => String(club.id),
        Item: ({ item }) => <ClubRow club={item} distanceKm={distance(item)} />,
        Top: finder ? FinderYou : undefined,
        // A group a link named opens with its club above the results, whatever the filters (Parent Hub's finder).
        Tools: finder ? FinderNamedGroup : undefined,
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
        empty: { title: following ? 'No followed clubs yet' : 'No clubs listed yet', body: following ? 'Follow clubs to keep their profiles and updates here.' : 'Clubs appear here when they publish their profile.', action: <CreateLink kind="CLUB" from="world-clubs" size="sm">{pt('Is your club missing? Add it')}</CreateLink> },
    };
}
