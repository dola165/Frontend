import { browseCompetitions, browsePersonalCompetitions, familyLabels, structureLabels, type CompetitionCard } from '../../competitions/api';
import { fetchMyTournamentInvitations, fetchTournamentHosts } from '../../tournaments/api';
import type { TournamentHost, TournamentInvitationInboxItem, TournamentSummary } from '../../tournaments/domain';
import { fetchClubProfile } from '../api';
import { plural, wt } from '../copy';
import type { Places } from '../directory/places';
import { first, nearbyPoint, type BrowseLine, type DirectorySource, type Placement, type ScopeFilter } from '../directory/types';
import { codeLabel, COMPETITION_STATUS, dateColumn, entryState, factTone, SCOPE_LABEL, sentence, shortDate } from '../format';
import { CompetitionRow } from '../rows';
import { HostRow, InvitationRow, MyCompetitionRow } from './competitionItems';
import { AGE_OPTIONS } from './matchSources';

const PAGE = 12;

/** The host club is in the payload but not yet in the published type. */
type Hosted = { id: number; name: string; startDate?: string | null; hostClubId?: number | null };
/** A competition at its own ground, else (marked approximate) at the club that hosts it. */
const competitionPlace = (item: Hosted, places: Places): Placement | null => {
    const own = places.competition(item.id);
    const at = own ?? places.club(item.hostClubId);
    return at ? { lat: at.lat, lng: at.lng, tone: 'event', approximate: own ? undefined : 'club', label: item.name, meta: shortDate(item.startDate) ?? undefined, to: `/tournaments/${item.id}`, noun: ['competition', 'competitions'] } : null;
};
/** A published competition: its first day, the age, format and host, and where entries stand. */
const competitionLine = (card: CompetitionCard & { registrationClosesAt?: string | null }): BrowseLine => {
    const rules = card.profile?.rules;
    const state = entryState(card.status, card.registrationClosesAt);
    return { when: dateColumn(card.startDate), title: card.name, to: `/tournaments/${card.id}`, action: wt('Open tournament'), fact: state.label, factTone: factTone(state.tone),
        detail: [rules && codeLabel(rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`, card.hostClubName || card.organizerName].filter(Boolean).join(' · ') };
};
const STATUS_OPTIONS = [{ value: 'PLANNING', label: 'Registration and planning' }, { value: 'ACTIVE', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }];
const SCOPE_OPTIONS = Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }));
const hasFee = (values: Record<string, string[]>) => Boolean(values.minFee?.[0] || values.maxFee?.[0]);
/** The fee range is checked as the server checks it (whole numbers up to 1,000,000, lowest first), so it is said here. */
const MAX_FEE = 1_000_000;
function feeNotice(min: string, max: string) {
    if ([min, max].some(fee => fee && !/^\d+$/.test(fee))) return wt('Enter fees as whole numbers, for example 50.');
    if ([min, max].some(fee => fee && Number(fee) > MAX_FEE)) return wt('Enter a fee up to 1,000,000.');
    if (min && max && Number(min) > Number(max)) return wt('The lowest fee is above the highest. Change one of them to search.');
    return '';
}

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
        { kind: 'text', key: 'minFee', label: 'Lowest entry fee', placeholder: 'No minimum', inputMode: 'numeric' },
        { kind: 'text', key: 'maxFee', label: 'Highest entry fee', placeholder: 'Any fee', inputMode: 'numeric' },
        { kind: 'choice', key: 'currency', label: 'Fee currency', fallback: 'GEL', when: query => hasFee(query.values), options: ['GEL', 'USD', 'EUR', 'GBP'].map(value => ({ value, label: value })) },
        { kind: 'choice', key: 'feeBasis', label: 'Fee basis', allLabel: 'Any basis', when: query => hasFee(query.values), options: [{ value: 'TEAM', label: 'Per team' }, { value: 'PLAYER', label: 'Per player' }, { value: 'EVENT', label: 'Per event' }] },
        { kind: 'toggle', key: 'openPlaces', label: 'Places still available' },
    ],
    sorts: [{ value: 'date', label: 'Event date' }, { value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name A–Z' }],
    async load(query, page, { signal }) {
        const notice = feeNotice(first(query, 'minFee'), first(query, 'maxFee'));
        if (notice) return { items: [], total: null, hasMore: false, notice };
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
    line: competitionLine,
    placeKinds: ['TOURNAMENT', 'CLUB'],
    place: competitionPlace,
    empty: { title: 'No competitions published yet', body: 'Leagues, cups and festivals appear here when organisers publish them.' },
};

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
    line: item => {
        const badge = COMPETITION_STATUS[item.status] ?? COMPETITION_STATUS.PLANNING;
        return { when: dateColumn(item.startDate), title: item.name, to: `/tournaments/${item.id}`, action: wt('Open tournament'), fact: wt(badge.label), factTone: factTone(badge.tone),
            detail: [SCOPE_LABEL[item.participantScope] && wt(SCOPE_LABEL[item.participantScope]), item.hostClubName || item.organizerName].filter(Boolean).join(' · ') };
    },
    placeKinds: ['TOURNAMENT', 'CLUB'],
    place: competitionPlace,
    empty: { title: 'No competitions yet', body: 'Competitions you organise, or that your club or squads enter, appear here.' },
};

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
    line: host => ({ title: host.name, to: `/world/competitions?host=${host.kind}:${host.id}`, action: wt('Show tournaments'), crest: { src: host.logoUrl, name: host.name },
        detail: host.kind === 'CLUB' ? wt('Club') : wt('Organisation'), fact: plural(host.tournamentCount, 'competition') }),
    // A club that organises is pinned at the club; an organisation has no place of its own on the map.
    placeKinds: ['CLUB'],
    place: (host, places) => {
        const club = host.kind === 'CLUB' ? places.club(host.id) : undefined;
        return club ? { lat: club.lat, lng: club.lng, tone: 'club', label: host.name, meta: plural(host.tournamentCount, 'competition'), to: `/clubs/${host.id}`, action: wt('Open club') } : null;
    },
    empty: { title: 'No organisers yet', body: 'Clubs and organisations appear here once they publish a competition.' },
};

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
    line: item => ({ title: item.tournamentName, to: '/requests', action: wt('Answer'), crest: { name: item.tournamentName }, fact: wt('Invited'), factTone: 'warning',
        detail: [item.squadName || item.clubName || wt('You, as a player'), SCOPE_LABEL[item.participantScope] && wt(SCOPE_LABEL[item.participantScope])].filter(Boolean).join(' · ') }),
    placeKinds: ['TOURNAMENT'],
    place: (item, places) => {
        const at = places.competition(item.tournamentId);
        return at ? { lat: at.lat, lng: at.lng, tone: 'event', label: item.tournamentName, to: `/tournaments/${item.tournamentId}`, action: wt('Open tournament'), noun: ['invitation', 'invitations'] } : null;
    },
    empty: { title: 'No pending invitations', body: 'Invitations for you, your squads and the clubs you manage appear here.' },
};
