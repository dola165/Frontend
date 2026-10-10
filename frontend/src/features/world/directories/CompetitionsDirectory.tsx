import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Badge, Button, ButtonLink, FixtureRow, ListRow } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { appLocale } from '../../../utils/formatting';
import { ages } from '../../matchExchange/api';
import { browseCompetitions, browsePersonalCompetitions, familyLabels, structureLabels, type CompetitionCard } from '../../competitions/api';
import { fetchMyTournamentInvitations, fetchTournamentHosts, setTournamentHostFollow } from '../../tournaments/api';
import type { TournamentHost, TournamentInvitationInboxItem, TournamentSummary } from '../../tournaments/domain';
import { Crest } from '../Crest';
import { DirectoryPage } from '../directory/DirectoryPage';
import { first, type DirectorySource } from '../directory/types';
import { plural, sentence } from '../format';
import { CompetitionRow } from '../rows';

const PAGE = 12;
const SCOPE_LABEL: Record<string, string> = { CLUB: 'Club teams', SQUAD: 'Squads', PLAYER: 'Individual players' };
const STATUS_OPTIONS = [{ value: 'PLANNING', label: 'Registration and planning' }, { value: 'ACTIVE', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }];

const competitions: DirectorySource<CompetitionCard> = {
    id: 'all',
    label: 'Competitions',
    tabLabel: 'All competitions',
    noun: ['competition', 'competitions'],
    searchLabel: 'Search competitions',
    searchPlaceholder: 'Search leagues, cups and festivals',
    layout: 'rows',
    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'registration', label: 'Entries', primary: true, allLabel: 'All', options: [{ value: 'OPEN', label: 'Open for entries' }, { value: 'NOT_OPEN', label: 'Opening soon' }, { value: 'CLOSED', label: 'Entries closed' }] },
        { kind: 'choice', key: 'family', label: 'Kind', primary: true, allLabel: 'Every kind', options: Object.entries(familyLabels).map(([value, label]) => ({ value, label })) },
        { kind: 'scope', key: 'host', label: 'One organiser' },
        { kind: 'choice', key: 'structure', label: 'Format', allLabel: 'Any format', when: query => Boolean(first(query, 'family')), options: Object.entries(structureLabels).map(([value, label]) => ({ value, label })) },
        { kind: 'choice', key: 'ageGroup', label: 'Age group', allLabel: 'Any age group', options: ages.map(value => ({ value, label: value === 'SENIOR' ? 'Senior' : value === 'VETERANS' ? 'Veterans' : value })) },
        { kind: 'choice', key: 'scope', label: 'Who enters', allLabel: 'Anyone', options: Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label })) },
        { kind: 'choice', key: 'sideSize', label: 'Players per side', allLabel: 'Any', options: [3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => ({ value: String(n), label: `${n}v${n}` })) },
        { kind: 'choice', key: 'discipline', label: 'Discipline', allLabel: 'Any', options: [{ value: 'ASSOCIATION', label: 'Association football' }, { value: 'FUTSAL', label: 'Futsal' }, { value: 'BEACH', label: 'Beach soccer' }, { value: 'WALKING', label: 'Walking football' }, { value: 'OTHER', label: 'Other ruleset' }] },
        { kind: 'choice', key: 'playingLevel', label: 'Level', allLabel: 'Any level', options: ['DEVELOPMENT', 'RECREATIONAL', 'COMPETITIVE', 'ELITE'].map(value => ({ value, label: sentence(value) })) },
        { kind: 'choice', key: 'status', label: 'Status', allLabel: 'Any status', options: STATUS_OPTIONS },
        { kind: 'text', key: 'country', label: 'Country', placeholder: 'Any country' },
        { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city' },
        { kind: 'date', key: 'from', label: 'Starting from' },
        { kind: 'date', key: 'to', label: 'Ending by' },
        { kind: 'text', key: 'maxFee', label: 'Highest entry fee', placeholder: 'Any fee' },
        { kind: 'choice', key: 'currency', label: 'Fee currency', fallback: 'GEL', when: query => Boolean(first(query, 'maxFee')), options: ['GEL', 'USD', 'EUR'].map(value => ({ value, label: value })) },
        { kind: 'toggle', key: 'openPlaces', label: 'Places still available' },
    ],
    sorts: [{ value: 'date', label: 'Event date' }, { value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name A–Z' }],
    async load(query, page, { signal }) {
        const params = new URLSearchParams();
        for (const [key, values] of Object.entries(query.values)) if (values[0] && key !== 'host') params.set(key, values[0]);
        if (params.has('maxFee') && !params.has('currency')) params.set('currency', 'GEL');
        // An organiser arrives as "CLUB:12" or "ORGANIZATION:4".
        const [hostKind, hostId] = first(query, 'host').split(':');
        if ((hostKind === 'CLUB' || hostKind === 'ORGANIZATION') && /^[1-9]\d*$/.test(hostId ?? '')) { params.set('hostKind', hostKind); params.set('hostId', hostId); }
        if (query.q) params.set('q', query.q);
        if (query.sort && query.sort !== 'date') params.set('sort', query.sort);
        params.set('page', String(page));
        params.set('size', String(PAGE));
        const result = await browseCompetitions(params, signal);
        return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
    },
    key: card => String(card.id),
    Item: ({ item }) => <CompetitionRow card={item} />,
    empty: { title: 'No competitions published yet', body: 'Leagues, cups and festivals appear here when organisers publish them.' },
};

const STATUS_BADGE: Record<string, { label: string; tone: 'accent' | 'violet' | 'neutral' | 'danger' }> = {
    PLANNING: { label: 'Planning', tone: 'violet' }, ACTIVE: { label: 'In progress', tone: 'accent' }, COMPLETED: { label: 'Completed', tone: 'neutral' }, CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

function MyCompetitionRow({ item }: { item: TournamentSummary }) {
    const { user } = useAuth();
    const managed = user?.navigationCapabilities?.workspaces.some(w => w.id === 'tournament.workspace' && w.context.id === item.id);
    const start = item.startDate ? new Date(item.startDate) : null;
    const valid = Boolean(start && !Number.isNaN(start.getTime()));
    const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.PLANNING;
    return (
        <FixtureRow tone="event" to={managed ? `/tournaments/${item.id}/workspace` : `/tournaments/${item.id}`} title={item.name}
            time={valid ? start!.toLocaleDateString(appLocale(), { day: 'numeric' }) : 'TBC'} day={valid ? start!.toLocaleDateString(appLocale(), { month: 'short' }) : 'Dates to confirm'}
            meta={[SCOPE_LABEL[item.participantScope], item.hostClubName || item.organizerName, plural(item.entryCount, 'entry', 'entries'), managed ? 'You run this competition' : null].filter(Boolean).join(' · ')}
            trail={<Badge tone={badge.tone}>{badge.label}</Badge>} />
    );
}

const mine: DirectorySource<TournamentSummary> = {
    id: 'mine',
    label: 'My competitions',
    noun: ['competition', 'competitions'],
    searchLabel: 'Search my competitions',
    searchPlaceholder: 'Search competitions you run or play in',
    layout: 'rows',
    pageSize: PAGE,
    personal: true,
    filters: [
        { kind: 'choice', key: 'status', label: 'Status', primary: true, allLabel: 'Any status', options: STATUS_OPTIONS },
        { kind: 'choice', key: 'scope', label: 'Who enters', allLabel: 'Anyone', options: Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label })) },
    ],
    async load(query, page) {
        const result = await browsePersonalCompetitions({ page, size: PAGE, search: query.q || undefined, scope: first(query, 'scope') || undefined, status: first(query, 'status') || undefined });
        return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
    },
    key: item => String(item.id),
    Item: MyCompetitionRow,
    empty: { title: 'No competitions yet', body: 'Competitions you organise, or that your club or squads enter, appear here.' },
};

function HostRow({ item: host }: { item: TournamentHost }) {
    const { status } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [following, setFollowing] = useState(host.following);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const follow = async () => {
        if (status !== 'authenticated') return navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
        setBusy(true);
        try { setFollowing((await setTournamentHostFollow(host.kind, host.id, !following)).following); setError(''); }
        catch (cause) { setError(extractApiErrorMessage(cause, 'Following could not be updated.')); }
        finally { setBusy(false); }
    };
    return (
        <li>
            <div className="gk-list-row">
                <span className="gk-list-row__lead"><Crest src={host.logoUrl} name={host.name} size={40} /></span>
                <span className="gk-list-row__main">
                    <Link className="gk-list-row__title gk-world-link" to={`/world/competitions?host=${host.kind}:${host.id}`}>{host.name}</Link>
                    <span className="gk-list-row__meta">{host.kind === 'CLUB' ? 'Club' : 'Organisation'} · {plural(host.tournamentCount, 'competition')}{error && <span role="alert" className="gk-world-more__error"> · {error}</span>}</span>
                </span>
                <span className="gk-list-row__trail">
                    <Button size="sm" aria-pressed={following} disabled={busy} onClick={follow}>{following ? <><Check aria-hidden="true" />Following</> : <><Plus aria-hidden="true" />Follow</>}</Button>
                </span>
            </div>
        </li>
    );
}

const organisers: DirectorySource<TournamentHost> = {
    id: 'hosts',
    label: 'Organisers',
    noun: ['organiser', 'organisers'],
    searchLabel: 'Search organisers',
    searchPlaceholder: 'Search clubs and organisations that run competitions',
    layout: 'rows',
    pageSize: PAGE,
    filters: [{ kind: 'toggle', key: 'following', label: 'Following', primary: true }],
    async load(query, page, { authenticated }) {
        const result = await fetchTournamentHosts({ page, size: PAGE, search: query.q || undefined, following: authenticated && first(query, 'following') === 'true' ? true : undefined });
        return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
    },
    key: host => `${host.kind}:${host.id}`,
    Item: HostRow,
    empty: { title: 'No organisers yet', body: 'Clubs and organisations appear here once they publish a competition.' },
};

function InvitationRow({ item }: { item: TournamentInvitationInboxItem }) {
    return (
        <ListRow to="/requests" lead={<Crest name={item.tournamentName} size={40} />} title={item.tournamentName}
            meta={[item.squadName || item.clubName || 'You, as a player', SCOPE_LABEL[item.participantScope], item.tournamentStatus === 'PLANNING' ? 'In preparation' : 'Already started or finished'].filter(Boolean).join(' · ')}
            trail={<><span className="gk-world-row-note">Answer in your inbox</span><Badge tone="warning">Invited</Badge></>} />
    );
}

/** Pending invitations to enter a competition. Answering stays in the existing request decision flow. */
const invitations: DirectorySource<TournamentInvitationInboxItem> = {
    id: 'invitations',
    label: 'Invitations',
    noun: ['invitation', 'invitations'],
    searchLabel: 'Search invitations',
    searchPlaceholder: 'Search by competition, club or squad',
    layout: 'rows',
    pageSize: PAGE,
    personal: true,
    filters: [],
    async load(query, page) {
        const result = await fetchMyTournamentInvitations(page, PAGE);
        const text = query.q.toLowerCase();
        const items = text ? result.content.filter(item => [item.tournamentName, item.clubName, item.squadName].some(value => (value ?? '').toLowerCase().includes(text))) : result.content;
        return { items, total: text ? items.length : result.totalElements, hasMore: page + 1 < result.totalPages };
    },
    key: item => String(item.invitationId),
    Item: InvitationRow,
    empty: { title: 'No pending invitations', body: 'Invitations for you, your squads and the clubs you manage appear here.' },
};

/** World › Competitions: every published competition, my own, invitations to enter, and who runs them. */
export default function CompetitionsDirectory() {
    const { user } = useAuth();
    return (
        <DirectoryPage
            title="Competitions"
            subtitle="Leagues, cups, ladders and festivals. See who can enter and when entries close."
            sources={[competitions, mine, invitations, organisers]}
            // Anyone signed in can start: setup helps a new organiser create their organisation first.
            actions={user && <ButtonLink variant={hasNavigationCapability(user.navigationCapabilities, 'tournament.create') ? 'primary' : 'secondary'} to="/tournaments/setup"><Plus aria-hidden="true" />Create a competition</ButtonLink>}
        />
    );
}
