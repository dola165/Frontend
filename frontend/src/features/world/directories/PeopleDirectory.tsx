import { Badge, ButtonLink, ListRow } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { formats, type Referee } from '../../matchExchange/api';
import { fetchPeople, fetchReferees, type PersonSummary } from '../api';
import { PersonRow } from '../rows';
import { Crest } from '../Crest';
import { DirectoryPage } from '../directory/DirectoryPage';
import { first, type DirectorySource } from '../directory/types';

const PAGE = 24;
/** Common professions, as people describe themselves. The search also matches any free text. */
const PROFESSIONS = ['Sports psychologist', 'Physiotherapist', 'Video analyst', 'Sports nutritionist', 'Strength & conditioning coach', 'Team doctor', 'Football photographer', 'Sports lawyer'];

type PersonItem =
    | { kind: 'person'; person: PersonSummary }
    | { kind: 'referee'; referee: Referee };

function PersonItemRow({ item }: { item: PersonItem }) {
    if (item.kind === 'referee') {
        const r = item.referee;
        const terms = [r.accepts_paid && r.fee ? `${r.fee} ${r.currency}` : r.accepts_paid ? 'Paid' : null, r.accepts_volunteer ? 'Volunteer' : null].filter(Boolean).join(' or ');
        return (
            <ListRow to={`/referees/${r.user_id}`} lead={<Crest name={r.full_name} round size={40} />}
                title={r.full_name}
                meta={[r.qualifications, r.service_area && `Covers ${r.service_area}${r.travel_km ? ` +${r.travel_km} km` : ''}`, r.formats && r.formats.split(',').map(code => formats[code.trim()] ?? code.trim()).join(', ')].filter(Boolean).join(' · ')}
                trail={<>{terms && <span className="gk-world-row-note">{terms}</span>}<Badge tone="info">Referee</Badge></>} />
        );
    }
    return <PersonRow person={item.person} />;
}

const people: DirectorySource<PersonItem> = {
    id: 'people',
    label: 'People',
    noun: ['person', 'people'],
    searchLabel: 'Search people',
    searchPlaceholder: 'Search by name, profession or club',
    layout: 'rows',
    pageSize: PAGE,
    signInReason: 'Profiles of coaches, players, referees and specialists are visible to signed-in members.',
    filters: [
        { kind: 'choice', key: 'role', label: 'Role', primary: true, allLabel: 'Everyone', options: [
            { value: 'COACH', label: 'Coaches' }, { value: 'PLAYER', label: 'Players' }, { value: 'REFEREE', label: 'Referees' },
            { value: 'AGENT', label: 'Agents' }, { value: 'SPECIALIST', label: 'Specialists' }, { value: 'CLUB_STAFF', label: 'Club staff' },
        ] },
        { kind: 'choice', key: 'profession', label: 'Profession', primary: true, allLabel: 'Any profession', when: query => first(query, 'role') === 'SPECIALIST', options: PROFESSIONS.map(value => ({ value, label: value })) },
        { kind: 'text', key: 'profession', label: 'Profession or skill', placeholder: 'For example psychologist', when: query => !['REFEREE', 'SPECIALIST'].includes(first(query, 'role')) },
        { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city', when: query => first(query, 'role') !== 'REFEREE' },
        { kind: 'toggle', key: 'verified', label: 'Confirmed by a club or licence', when: query => first(query, 'role') !== 'REFEREE' },
        { kind: 'choice', key: 'format', label: 'Match format', options: Object.entries(formats).map(([value, label]) => ({ value, label })), when: query => first(query, 'role') === 'REFEREE' },
        { kind: 'toggle', key: 'volunteer', label: 'Volunteers', when: query => first(query, 'role') === 'REFEREE' },
    ],
    sorts: [{ value: 'RELEVANCE', label: 'Best match' }, { value: 'NAME', label: 'Name A–Z' }],
    async load(query, page, { signal, sessionId }) {
        if (first(query, 'role') === 'REFEREE') {
            const result = await fetchReferees({ q: query.q || undefined, format: first(query, 'format') || undefined, volunteer: first(query, 'volunteer') || undefined, page }, signal);
            const size = result.pageSize ?? PAGE;
            return { items: result.items.map(referee => ({ kind: 'referee' as const, referee })), total: result.total, hasMore: (page + 1) * size < result.total };
        }
        const result = await fetchPeople({ q: query.q || undefined, role: first(query, 'role') || undefined, profession: first(query, 'profession') || undefined, city: first(query, 'city') || undefined,
            verified: first(query, 'verified') || undefined, sort: query.sort, page, size: PAGE }, sessionId, signal);
        return { items: result.items.map(person => ({ kind: 'person' as const, person })), total: result.total, hasMore: result.hasMore };
    },
    key: item => item.kind === 'referee' ? `referee:${item.referee.user_id}` : `person:${item.person.id}`,
    Item: PersonItemRow,
    empty: { title: 'No public profiles yet', body: 'People appear here when they publish a football profile. Search by name to find anyone else.' },
};

export default function PeopleDirectory() {
    const { user } = useAuth();
    const referee = hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace');
    return (
        <DirectoryPage title="People" subtitle="Coaches, players, referees, agents and specialists with a public football profile." sources={[people]}
            actions={user && <>
                {referee && <ButtonLink variant="ghost" to="/referees/me">My referee work</ButtonLink>}
                <ButtonLink to="/account/roles">Your football roles</ButtonLink>
            </>} />
    );
}
