import { formats } from '../../matchExchange/api';
import { fetchPeople, fetchReferees } from '../api';
import { wt } from '../copy';
import { first, type BrowseLine, type DirectoryQuery, type DirectorySource, type FilterDef } from '../directory/types';
import type { Places } from '../directory/places';
import { PERSON_ROLE } from '../format';
import { PersonItemRow, type PersonItem } from './peopleItems';
import { valueScope } from './scopes';

const PAGE = 24;
/** Common professions, as people describe themselves. The search also matches any free text. */
const PROFESSIONS = ['Sports psychologist', 'Physiotherapist', 'Video analyst', 'Sports nutritionist', 'Strength & conditioning coach', 'Team doctor', 'Football photographer', 'Sports lawyer'];
const ROLES = [
    { value: 'COACH', label: 'Coaches' }, { value: 'PLAYER', label: 'Players' }, { value: 'REFEREE', label: 'Referees' },
    { value: 'AGENT', label: 'Agents' }, { value: 'SPECIALIST', label: 'Specialists' }, { value: 'CLUB_STAFF', label: 'Club staff' },
];

const isReferee = (query: DirectoryQuery) => first(query, 'role') === 'REFEREE';
const refereeFilters: FilterDef[] = [
    { kind: 'choice', key: 'format', label: 'Match format', options: Object.entries(formats).map(([value, label]) => ({ value, label })), when: isReferee },
    { kind: 'toggle', key: 'volunteer', label: 'Volunteers', when: isReferee },
];
/** Filters only the people directory can answer; a name search cannot. */
const asksDirectory = (query: DirectoryQuery) => Boolean((first(query, 'role') && !isReferee(query)) || first(query, 'profession') || first(query, 'city') || first(query, 'verified'));
const UNAVAILABLE = 'Finding people by role, profession or place is not available yet. Clear the filters to search everyone by name.';

/** A person or referee as a browse line: face, name, what they do, and their role or terms. */
function personLine(item: PersonItem): BrowseLine {
    if (item.kind === 'referee') {
        const r = item.referee;
        const terms = [r.accepts_paid && r.fee ? `${r.fee} ${r.currency}` : r.accepts_paid ? wt('Paid') : null, r.accepts_volunteer ? wt('Volunteer') : null].filter(Boolean).join(` ${wt('or')} `);
        return { title: r.full_name, to: `/referees/${r.user_id}`, crest: { name: r.full_name, round: true },
            detail: [wt('Referee'), r.service_area && wt('Covers {area}', { area: r.service_area })].filter(Boolean).join(' · '), fact: terms || undefined };
    }
    const p = item.person;
    return { title: p.fullName, to: `/profile/${p.id}`, crest: { src: p.avatarUrl, name: p.fullName, round: true },
        detail: [p.headline || p.profession, p.city].filter(Boolean).join(' · '), fact: wt(PERSON_ROLE[p.role] ?? 'Member') };
}

/**
 * People are counted on their club's pin, never placed by name: the pin is the club ("FC Dinamo Tbilisi · 4 people").
 * Referees cover an area rather than a place, so they stay off the map.
 */
function personPlace(item: PersonItem, places: Places) {
    if (item.kind !== 'person' || item.person.clubId == null) return null;
    const club = places.club(item.person.clubId);
    return club ? { lat: club.lat, lng: club.lng, tone: 'person' as const, pin: `club:${item.person.clubId}`, label: club.name, noun: ['person', 'people'] as [string, string], to: `/clubs/${item.person.clubId}` } : null;
}

/**
 * People with a public football profile. Without the people directory on the server
 * (`searchOnly`), people are found by name only: role, profession, place and confirmation
 * filters are not offered, and a link that carries one says so instead of ignoring it.
 * `onSearchOnly` reports the first answer that shows the directory is missing.
 */
export function peopleSource({ searchOnly, onSearchOnly }: { searchOnly: boolean; onSearchOnly?: () => void }): DirectorySource<PersonItem> {
    return {
        id: 'people',
        label: 'People',
        noun: ['person', 'people'],
        searchLabel: 'Search people',
        searchPlaceholder: searchOnly ? 'Search people by name' : 'Search by name, profession or club',
        layout: 'rows',
        pageSize: PAGE,
        version: searchOnly ? 'search' : 'directory',
        signInReason: 'Profiles of coaches, players, referees and specialists are visible to signed-in members.',
        filters: searchOnly ? [
            { kind: 'choice', key: 'role', label: 'Role', primary: true, allLabel: 'Everyone', options: ROLES.filter(role => role.value === 'REFEREE') },
            ...refereeFilters,
            valueScope('profession', 'Profession'), valueScope('city', 'City'), valueScope('verified', 'Confirmed by a club or licence'),
        ] : [
            { kind: 'choice', key: 'role', label: 'Role', primary: true, allLabel: 'Everyone', options: ROLES },
            { kind: 'choice', key: 'profession', label: 'Profession', primary: true, allLabel: 'Any profession', when: query => first(query, 'role') === 'SPECIALIST', options: PROFESSIONS.map(value => ({ value, label: value })) },
            { kind: 'text', key: 'profession', label: 'Profession or skill', placeholder: 'For example psychologist', when: query => !['REFEREE', 'SPECIALIST'].includes(first(query, 'role')) },
            { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city', when: query => !isReferee(query) },
            { kind: 'toggle', key: 'verified', label: 'Confirmed by a club or licence', when: query => !isReferee(query) },
            ...refereeFilters,
        ],
        sorts: [{ value: 'RELEVANCE', label: 'Best match' }, { value: 'NAME', label: 'Name A–Z' }],
        // The referee list keeps its own order, and a name search has no sort.
        sortable: query => !searchOnly && !isReferee(query),
        async load(query, page, { signal, sessionId }) {
            if (isReferee(query)) {
                const result = await fetchReferees({ q: query.q || undefined, format: first(query, 'format') || undefined, volunteer: first(query, 'volunteer') || undefined, page }, signal);
                const size = result.pageSize ?? PAGE;
                return { items: result.items.map(referee => ({ kind: 'referee' as const, referee })), total: result.total, hasMore: (page + 1) * size < result.total };
            }
            const unavailable = { items: [], total: null, hasMore: false, notice: wt(UNAVAILABLE) };
            if (searchOnly && asksDirectory(query)) return unavailable;
            const result = await fetchPeople({ q: query.q || undefined, role: first(query, 'role') || undefined, profession: first(query, 'profession') || undefined, city: first(query, 'city') || undefined,
                verified: first(query, 'verified') || undefined, sort: query.sort, page, size: PAGE }, sessionId, signal);
            if (result.searchOnly && !searchOnly) {
                onSearchOnly?.();
                if (asksDirectory(query)) return unavailable;
            }
            return { items: result.items.map(person => ({ kind: 'person' as const, person })), total: result.total, hasMore: result.hasMore };
        },
        key: item => item.kind === 'referee' ? `referee:${item.referee.user_id}` : `person:${item.person.id}`,
        Item: PersonItemRow,
        line: personLine,
        placeKinds: ['CLUB'],
        place: personPlace,
        mapped: query => !isReferee(query),
        empty: searchOnly
            ? { title: 'Search people by name', body: 'Type at least two letters of a name to find coaches, players and specialists. Referees can be browsed from the Referees chip.' }
            : { title: 'No public profiles yet', body: 'People appear here when they publish a football profile. Search by name to find anyone else.' },
    };
}
