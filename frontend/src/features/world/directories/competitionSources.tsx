import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Badge, Button, FixtureRow, ListRow } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { browseCompetitions, browsePersonalCompetitions, familyLabels, structureLabels, type CompetitionCard } from '../../competitions/api';
import { fetchMyTournamentInvitations, fetchTournamentHosts, setTournamentHostFollow } from '../../tournaments/api';
import type { TournamentHost, TournamentInvitationInboxItem, TournamentSummary } from '../../tournaments/domain';
import { fetchClubProfile } from '../api';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { first, nearbyPoint, type DirectorySource, type ScopeFilter } from '../directory/types';
import { sentence } from '../format';
import { COMPETITION_STATUS, CompetitionRow, dateColumn, SCOPE_LABEL } from '../rows';
import { AGE_OPTIONS } from './matchSources';

const PAGE = 12;
const STATUS_OPTIONS = [{ value: 'PLANNING', label: 'Registration and planning' }, { value: 'ACTIVE', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }];
const SCOPE_OPTIONS = Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }));
const hasFee = (values: Record<string, string[]>) => Boolean(values.minFee?.[0] || values.maxFee?.[0]);

/** One organiser from a link ("CLUB:12" or "ORGANIZATION:4"); a club organiser's chip carries its name. */
const hostScope: ScopeFilter = {
    kind: 'scope', key: 'host', label: 'One organiser',
    name: (value, signal) => {
        const [kind, id] = value.split(':');
        return kind === 'CLUB' && /^[1-9]\d*$/.test(id ?? '') ? fetchClubProfile(Number(id), signal).then(club => club.name) : Promise.resolve(null);
    },
};

/** Keys sent to `GET /competitions` exactly as the filters hold them. */
const PASSED = ['registration', 'family', 'structure', 'ageGroup', 'scope', 'sideSize', 'discipline', 'playingLevel', 'status', 'country', 'city', 'eligibilityCategory', 'from', 'to', 'minFee', 'maxFee', 'currency', 'feeBasis', 'openPlaces'];

export const competitions: DirectorySource<CompetitionCard> = {
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
        { kind: 'nearby', key: 'around', label: 'Near me', km: 25 },
        hostScope,
        { kind: 'choice', key: 'structure', label: 'Format', allLabel: 'Any format', when: query => Boolean(first(query, 'family')), options: Object.entries(structureLabels).map(([value, label]) => ({ value, label })) },
        { kind: 'choice', key: 'ageGroup', label: 'Age group', allLabel: 'Any age group', options: AGE_OPTIONS },
        { kind: 'choice', key: 'scope', label: 'Who enters', allLabel: 'Anyone', options: SCOPE_OPTIONS },
        { kind: 'choice', key: 'sideSize', label: 'Players per side', allLabel: 'Any', options: [3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => ({ value: String(n), label: `${n}v${n}` })) },
        { kind: 'choice', key: 'discipline', label: 'Discipline', allLabel: 'Any', options: [{ value: 'ASSOCIATION', label: 'Association football' }, { value: 'FUTSAL', label: 'Futsal' }, { value: 'BEACH', label: 'Beach soccer' }, { value: 'WALKING', label: 'Walking football' }, { value: 'OTHER', label: 'Other ruleset' }] },
        { kind: 'choice', key: 'playingLevel', label: 'Level', allLabel: 'Any level', options: ['DEVELOPMENT', 'RECREATIONAL', 'COMPETITIVE', 'ELITE'].map(value => ({ value, label: sentence(value) })) },
        { kind: 'choice', key: 'status', label: 'Status', allLabel: 'Any status', options: STATUS_OPTIONS },
        { kind: 'text', key: 'eligibilityCategory', label: 'Eligibility', placeholder: 'Exact published category' },
        { kind: 'text', key: 'country', label: 'Country', placeholder: 'Any country' },
        { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city' },
        { kind: 'date', key: 'from', label: 'Starting from' },
        { kind: 'date', key: 'to', label: 'Ending by' },
        { kind: 'text', key: 'minFee', label: 'Lowest entry fee', placeholder: 'No minimum' },
        { kind: 'text', key: 'maxFee', label: 'Highest entry fee', placeholder: 'Any fee' },
        { kind: 'choice', key: 'currency', label: 'Fee currency', fallback: 'GEL', when: query => hasFee(query.values), options: ['GEL', 'USD', 'EUR', 'GBP'].map(value => ({ value, label: value })) },
        { kind: 'choice', key: 'feeBasis', label: 'Fee basis', allLabel: 'Any basis', when: query => hasFee(query.values), options: [{ value: 'TEAM', label: 'Per team' }, { value: 'PLAYER', label: 'Per player' }, { value: 'EVENT', label: 'Per event' }] },
        { kind: 'toggle', key: 'openPlaces', label: 'Places still available' },
    ],
    sorts: [{ value: 'date', label: 'Event date' }, { value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name A–Z' }],
    async load(query, page, { signal }) {
        // Only filters that apply carry values, so a currency is sent only with a fee to compare.
        const params = new URLSearchParams();
        for (const key of PASSED) if (first(query, key)) params.set(key, first(query, key));
        const around = nearbyPoint(query, 'around');
        if (around) { params.set('latitude', String(around.lat)); params.set('longitude', String(around.lng)); params.set('radiusKm', '25'); }
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

function MyCompetitionRow({ item }: { item: TournamentSummary }) {
    const t = useWorldCopy();
    const { user } = useAuth();
    const managed = user?.navigationCapabilities?.workspaces.some(w => w.id === 'tournament.workspace' && w.context.id === item.id);
    const badge = COMPETITION_STATUS[item.status] ?? COMPETITION_STATUS.PLANNING;
    return (
        <FixtureRow tone="event" to={managed ? `/tournaments/${item.id}/workspace` : `/tournaments/${item.id}`} title={item.name} {...dateColumn(item.startDate)}
            meta={[t(SCOPE_LABEL[item.participantScope] ?? ''), item.hostClubName || item.organizerName, plural(item.entryCount, 'entry', 'entries'), managed ? t('You run this competition') : null].filter(Boolean).join(' · ')}
            trail={<Badge tone={badge.tone}>{t(badge.label)}</Badge>} />
    );
}

export const mine: DirectorySource<TournamentSummary> = {
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
        { kind: 'choice', key: 'scope', label: 'Who enters', allLabel: 'Anyone', options: SCOPE_OPTIONS },
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
    const t = useWorldCopy();
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
        catch (cause) { setError(extractApiErrorMessage(cause, t('Following could not be updated.'))); }
        finally { setBusy(false); }
    };
    return (
        <li>
            <div className="gk-list-row">
                <span className="gk-list-row__lead"><Crest src={host.logoUrl} name={host.name} size={40} /></span>
                <span className="gk-list-row__main">
                    <Link className="gk-list-row__title gk-world-link" to={`/world/competitions?host=${host.kind}:${host.id}`}>{host.name}</Link>
                    <span className="gk-list-row__meta">{host.kind === 'CLUB' ? t('Club') : t('Organisation')} · {plural(host.tournamentCount, 'competition')}{error && <span role="alert" className="gk-world-more__error"> · {error}</span>}</span>
                </span>
                <span className="gk-list-row__trail">
                    <Button size="sm" aria-pressed={following} disabled={busy} onClick={follow}>{following ? <><Check aria-hidden="true" />{t('Following')}</> : <><Plus aria-hidden="true" />{t('Follow')}</>}</Button>
                </span>
            </div>
        </li>
    );
}

export const organisers: DirectorySource<TournamentHost> = {
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
    const t = useWorldCopy();
    return (
        <ListRow to="/requests" lead={<Crest name={item.tournamentName} size={40} />} title={item.tournamentName}
            meta={[item.squadName || item.clubName || t('You, as a player'), t(SCOPE_LABEL[item.participantScope] ?? ''), item.tournamentStatus === 'PLANNING' ? t('In preparation') : t('Already started or finished')].filter(Boolean).join(' · ')}
            trail={<><span className="gk-world-row-note">{t('Answer in your inbox')}</span><Badge tone="warning">{t('Invited')}</Badge></>} />
    );
}

/** The most invitations one search looks through; pending invitations are few. */
const INVITATION_SEARCH = 100;

/** Pending invitations to enter a competition. Answering stays in the existing request decision flow. */
export const invitations: DirectorySource<TournamentInvitationInboxItem> = {
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
        const text = query.q.toLowerCase();
        if (!text) {
            const result = await fetchMyTournamentInvitations(page, PAGE);
            return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
        }
        // The server has no invitation search; a search looks through every pending invitation at once, so counts stay true.
        const result = await fetchMyTournamentInvitations(0, INVITATION_SEARCH);
        const items = result.content.filter(item => [item.tournamentName, item.clubName, item.squadName].some(value => (value ?? '').toLowerCase().includes(text)));
        return { items, total: result.totalPages > 1 ? null : items.length, hasMore: false };
    },
    key: item => String(item.invitationId),
    Item: InvitationRow,
    empty: { title: 'No pending invitations', body: 'Invitations for you, your squads and the clubs you manage appear here.' },
};
