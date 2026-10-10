import { Badge, ListRow } from '../../../design/primitives';
import { formats, type Referee } from '../../matchExchange/api';
import { fetchPeople, fetchReferees, type PersonSummary } from '../api';
import { useWorldCopy, wt } from '../copy';
import { PersonRow } from '../rows';
import { Crest } from '../Crest';
import { first, type DirectoryQuery, type DirectorySource, type FilterDef } from '../directory/types';
import { valueScope } from './scopes';

const PAGE = 24;
/** Common professions, as people describe themselves. The search also matches any free text. */
const PROFESSIONS = ['Sports psychologist', 'Physiotherapist', 'Video analyst', 'Sports nutritionist', 'Strength & conditioning coach', 'Team doctor', 'Football photographer', 'Sports lawyer'];
const ROLES = [
    { value: 'COACH', label: 'Coaches' }, { value: 'PLAYER', label: 'Players' }, { value: 'REFEREE', label: 'Referees' },
    { value: 'AGENT', label: 'Agents' }, { value: 'SPECIALIST', label: 'Specialists' }, { value: 'CLUB_STAFF', label: 'Club staff' },
];

export type PersonItem =
    | { kind: 'person'; person: PersonSummary }
    | { kind: 'referee'; referee: Referee };

function PersonItemRow({ item }: { item: PersonItem }) {
    const t = useWorldCopy();
    if (item.kind === 'referee') {
        const r = item.referee;
        const terms = [r.accepts_paid && r.fee ? `${r.fee} ${r.currency}` : r.accepts_paid ? t('Paid') : null, r.accepts_volunteer ? t('Volunteer') : null].filter(Boolean).join(` ${t('or')} `);
        return (
            <ListRow to={`/referees/${r.user_id}`} lead={<Crest name={r.full_name} round size={40} />}
                title={r.full_name}
                meta={[r.qualifications, r.service_area && `${t('Covers {area}', { area: r.service_area })}${r.travel_km ? ` +${r.travel_km} km` : ''}`, r.formats && r.formats.split(',').map(code => t(formats[code.trim()] ?? code.trim())).join(', ')].filter(Boolean).join(' · ')}
                trail={<>{terms && <span className="gk-world-row-note">{terms}</span>}<Badge tone="info">{t('Referee')}</Badge></>} />
        );
    }
    return <PersonRow person={item.person} />;
}

const isReferee = (query: DirectoryQuery) => first(query, 'role') === 'REFEREE';
const refereeFilters: FilterDef[] = [
    { kind: 'choice', key: 'format', label: 'Match format', options: Object.entries(formats).map(([value, label]) => ({ value, label })), when: isReferee },
    { kind: 'toggle', key: 'volunteer', label: 'Volunteers', when: isReferee },
];
/** Filters only the people directory can answer; a name search cannot. */
const asksDirectory = (query: DirectoryQuery) => Boolean((first(query, 'role') && !isReferee(query)) || first(query, 'profession') || first(query, 'city') || first(query, 'verified'));
const UNAVAILABLE = 'Finding people by role, profession or place is not available yet. Clear the filters to search everyone by name.';

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
        empty: searchOnly
            ? { title: 'Search people by name', body: 'Type at least two letters of a name to find coaches, players and specialists. Referees can be browsed from the Referees chip.' }
            : { title: 'No public profiles yet', body: 'People appear here when they publish a football profile. Search by name to find anyone else.' },
    };
}
