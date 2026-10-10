import { fetchMapDiscovery } from '../../../api/map';
import type { Participant } from '../../admissions/types';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { fetchClubDirectory } from '../api';
import { ClubCard } from '../cards/ClubCard';
import { first, type DirectoryQuery, type DirectorySource, type RememberedChoice } from '../directory/types';
import { clubTypeLabel } from '../format';
import { ageOn, childFilter } from '../players';
import { JOIN_POLICY_FILTER } from './clubFilters';

const PAGE = 12;
/** Club types as the World map groups them, for "Open full map". */
const MAP_CATEGORY: Record<string, string[]> = { ACADEMY: ['PROFESSIONAL_ACADEMY', 'PRIVATE_ACADEMY'], SCHOOL: ['SCHOOL_CLUB'], AMATEUR: ['AMATEUR_CLUB'], OTHER: ['OTHER'] };
type Located = ClubProfile & { latitude?: number | null; longitude?: number | null };

/** The full map with the same clubs: search text, how to join, kind of club and city. */
export function clubsMapLink(query: DirectoryQuery) {
    const params = new URLSearchParams({ layers: 'clubs' });
    if (query.q) params.set('q', query.q);
    query.values.joinPolicy?.forEach(value => params.append('joinPolicy', value));
    [...new Set(query.values.type?.flatMap(type => MAP_CATEGORY[type] ?? []))].forEach(value => params.append('category', value));
    if (first(query, 'city')) params.set('region', first(query, 'city'));
    if (first(query, 'player')) params.set('player', first(query, 'player'));
    return `/world/map?${params}`;
}

/**
 * Clubs: academies, schools and community clubs. For a parent searching for a child, only clubs
 * with a programme for the child's age are asked for, and each card shows what fits.
 */
export function clubsSource({ children = [], remember, centre }: { children?: Participant[]; remember?: RememberedChoice; centre?: { lat: number; lng: number } | null } = {}): DirectorySource<ClubProfile> {
    const child = (query: DirectoryQuery) => children.find(person => String(person.id) === first(query, 'player'));
    return {
        id: 'clubs',
        label: 'Clubs',
        noun: ['club', 'clubs'],
        searchLabel: 'Search clubs',
        searchPlaceholder: 'Search clubs by name or area',
        layout: 'cards',
        pageSize: PAGE,
        version: children.map(person => person.id).join(','),
        filters: [
            ...(remember ? childFilter(children, remember) : []),
            { kind: 'choice', key: 'type', label: 'Club type', primary: true, multi: true, options: [
                { value: 'ACADEMY', label: 'Academies' }, { value: 'SCHOOL', label: 'Football schools' }, { value: 'GRASSROOTS', label: 'Grassroots' },
                { value: 'AMATEUR', label: 'Amateur' }, { value: 'SEMI_PROFESSIONAL', label: 'Semi-professional' }, { value: 'PROFESSIONAL', label: 'Professional' }, { value: 'OTHER', label: 'Other' },
            ] },
            JOIN_POLICY_FILTER,
            { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city' },
            { kind: 'text', key: 'country', label: 'Country', placeholder: 'Any country' },
        ],
        sorts: [{ value: 'MEMBER_COUNT', label: 'Most members' }, { value: 'NAME', label: 'Name A–Z' }, { value: 'NEWEST', label: 'Newest' }],
        async load(query, page, { signal }) {
            const params = new URLSearchParams();
            query.values.type?.forEach(value => params.append('type', value));
            query.values.joinPolicy?.forEach(value => params.append('joinPolicy', value));
            if (query.q) params.set('search', query.q);
            if (first(query, 'city')) params.set('city', first(query, 'city'));
            if (first(query, 'country')) params.set('country', first(query, 'country'));
            // Backend needed: `age` keeps clubs with a published programme for that age.
            const age = ageOn(child(query)?.dateOfBirth);
            if (age != null) params.set('age', String(age));
            if (query.sort && query.sort !== 'NEWEST') params.set('sort', query.sort);
            params.set('page', String(page));
            params.set('size', String(PAGE));
            const result = await fetchClubDirectory(params, signal);
            return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
        },
        key: club => String(club.id),
        Item: ({ item }) => <ClubCard club={item} />,
        // Directory records may carry no coordinates; then the map search around the area places clubs by id.
        pointsKey: query => `${query.q}|${first(query, 'city')}|${centre?.lat},${centre?.lng}`,
        async loadPoints(query, { signal }) {
            const at = centre ?? { lat: 41.7151, lng: 44.8271 };
            const result = await fetchMapDiscovery({ lat: at.lat, lng: at.lng, radius: 300, type: ['CLUB'], query: query.q || first(query, 'city') || undefined }, signal);
            return new Map(result.content.map(marker => [String(marker.clubId ?? marker.entityId), { lat: marker.latitude, lng: marker.longitude }]));
        },
        point: (club: Located, coords) => {
            const at = club.latitude != null && club.longitude != null ? { lat: club.latitude, lng: club.longitude } : coords;
            return at ? { id: String(club.id), ...at, label: club.name, meta: [clubTypeLabel(club.type), club.cityName].filter(Boolean).join(' · '), tone: 'club', to: `/clubs/${club.id}` } : null;
        },
        mapLink: clubsMapLink,
        empty: { title: 'No clubs listed yet', body: 'Clubs appear here when they publish their profile.' },
    };
}
