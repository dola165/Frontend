import { browseCompetitions } from '../../../competitions/api';
import { fetchTournamentHost } from '../../../tournaments/api';
import { CupGlyph, FestivalGlyph, GroupsGlyph, LadderGlyph, LeagueGlyph } from '../../../tournaments/shape/FormatGlyph';
import { FORMAT_WORD } from '../../../tournaments/shape/shapeOf';
import { shared } from '../../cache';
import { wt } from '../../copy';
import { first, nearbyPoint, type DirectoryQuery, type DirectorySource, type FilterDef, type ScopeFilter } from '../../directory/types';
import { isoDay, isoDayOf, SCOPE_LABEL, sentence } from '../../format';
import { zoned } from '../../scoreboard/standings';
import { AGE_OPTIONS } from '../matches/listings';
import { valueScope } from '../scopes';
import { TournamentRow } from './TournamentRow';
import { fromCard, type EntriesState, type TournamentItem } from './tournamentItem';
import { ageGroupOf, nearParams, tournamentLine, tournamentPlace } from './tournamentLines';

const PAGE = 12;

/** The five formats as picture tiles; a league, a festival and a ladder are whole families, the two cups one structure each. */
const FORMAT_TILES = [
    { value: 'LEAGUE', label: 'League', icon: LeagueGlyph }, { value: 'KNOCKOUT', label: 'Knockout cup', icon: CupGlyph },
    { value: 'GROUPS_KNOCKOUT', label: 'Groups & finals', icon: GroupsGlyph }, { value: 'FESTIVAL', label: 'Festival', icon: FestivalGlyph },
    { value: 'LADDER', label: 'Ladder', icon: LadderGlyph },
];
const FAMILIES = new Set(['LEAGUE', 'FESTIVAL', 'LADDER']);
const STATUS_OPTIONS = [{ value: 'PLANNING', label: 'Coming up' }, { value: 'ACTIVE', label: 'On now' }, { value: 'COMPLETED', label: 'Finished' }, { value: 'CANCELLED', label: 'Cancelled' }];

const hasFee = (values: Record<string, string[]>) => Boolean(values.minFee?.[0] || values.maxFee?.[0]);
/** The fee range is checked as the server checks it (whole numbers up to 1,000,000, lowest first), so it is said here. */
function feeNotice(min: string, max: string) {
    if ([min, max].some(fee => fee && !/^\d+$/.test(fee))) return wt('Enter fees as whole numbers, for example 50.');
    if ([min, max].some(fee => fee && Number(fee) > 1_000_000)) return wt('Enter a fee up to 1,000,000.');
    if (min && max && Number(min) > Number(max)) return wt('The lowest fee is above the highest. Change one of them to search.');
    return '';
}

/** One organiser from a link or an organiser's page ("CLUB:12", "ORGANIZATION:801"): the chip carries its name. */
const hostScope: ScopeFilter = {
    kind: 'scope', key: 'host', label: 'One organiser',
    name: (value, signal) => {
        const [kind, id] = value.split(':');
        return (kind === 'CLUB' || kind === 'ORGANIZATION') && /^[1-9]\d*$/.test(id ?? '') ? fetchTournamentHost(kind, Number(id), signal).then(host => host.name) : Promise.resolve(null);
    },
};

export const TOURNAMENT_FILTERS: FilterDef[] = [
    { kind: 'choice', key: 'registration', label: 'Entries', primary: true, allLabel: 'All', options: [{ value: 'OPEN', label: 'Open for entries' }, { value: 'NOT_OPEN', label: 'Opening soon' }, { value: 'CLOSED', label: 'Entries closed' }] },
    { kind: 'choice', key: 'ageGroup', label: 'Age group', primary: true, allLabel: 'Any age group', options: AGE_OPTIONS },
    { kind: 'choice', key: 'format', label: 'Format', primary: true, allLabel: 'Any format', look: 'tiles', options: FORMAT_TILES },
    hostScope,
    { kind: 'choice', key: 'structure', label: 'Exact format', allLabel: 'Any', options: Object.entries(FORMAT_WORD).map(([value, label]) => ({ value, label })) },
    { kind: 'choice', key: 'scope', label: 'Who enters', allLabel: 'Anyone', options: Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label })) },
    { kind: 'choice', key: 'sideSize', label: 'Players per side', allLabel: 'Any', options: [3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => ({ value: String(n), label: `${n}v${n}` })) },
    { kind: 'choice', key: 'discipline', label: 'Discipline', allLabel: 'Any', options: [{ value: 'ASSOCIATION', label: 'Association football' }, { value: 'FUTSAL', label: 'Futsal' }, { value: 'BEACH', label: 'Beach soccer' }, { value: 'WALKING', label: 'Walking football' }, { value: 'OTHER', label: 'Other ruleset' }] },
    { kind: 'choice', key: 'playingLevel', label: 'Level', allLabel: 'Any level', options: ['DEVELOPMENT', 'RECREATIONAL', 'COMPETITIVE', 'ELITE'].map(value => ({ value, label: sentence(value) })) },
    { kind: 'choice', key: 'status', label: 'Status', allLabel: 'Any status', options: STATUS_OPTIONS },
    { kind: 'text', key: 'eligibilityCategory', label: 'Eligibility', placeholder: 'Exact published category' },
    { kind: 'date', key: 'from', label: 'Ending on or after' },
    { kind: 'date', key: 'to', label: 'Starting by' },
    { kind: 'text', key: 'minFee', label: 'Lowest entry fee', placeholder: 'No minimum', inputMode: 'numeric' },
    { kind: 'text', key: 'maxFee', label: 'Highest entry fee', placeholder: 'Any fee', inputMode: 'numeric' },
    { kind: 'choice', key: 'currency', label: 'Fee currency', fallback: 'GEL', when: query => hasFee(query.values), options: ['GEL', 'USD', 'EUR', 'GBP'].map(value => ({ value, label: value })) },
    { kind: 'choice', key: 'feeBasis', label: 'Fee basis', allLabel: 'Any basis', when: query => hasFee(query.values), options: [{ value: 'TEAM', label: 'Per team' }, { value: 'PLAYER', label: 'Per player' }, { value: 'EVENT', label: 'Per event' }] },
    { kind: 'toggle', key: 'openPlaces', label: 'Places still available' },
    // Kept from older links, which chose a kind, a city, a country or a spot on the map: shown as chips, still applied.
    valueScope('family', 'Kind'), valueScope('city', 'City'), valueScope('country', 'Country'), { kind: 'scope', key: 'around', label: 'Near the place chosen' },
];

/** Keys sent to `GET /competitions` exactly as the filters hold them. */
const PASSED = ['registration', 'family', 'structure', 'ageGroup', 'scope', 'sideSize', 'discipline', 'playingLevel', 'status', 'country', 'city', 'eligibilityCategory', 'from', 'to', 'minFee', 'maxFee', 'currency', 'feeBasis', 'openPlaces'];

/** The list's search as `GET /competitions` parameters: filters, the format tile, the organiser, and where (a spot from an old link, else the World area). */
export function cardParams(query: DirectoryQuery, area: Parameters<typeof nearParams>[1]) {
    const params = new URLSearchParams();
    for (const key of PASSED) if (first(query, key)) params.set(key, first(query, key));
    const format = first(query, 'format');
    if (format) { const key = FAMILIES.has(format) ? 'family' : 'structure'; if (!params.has(key)) params.set(key, format); }
    const around = nearbyPoint(query, 'around');
    if (around) { params.set('latitude', String(around.lat)); params.set('longitude', String(around.lng)); params.set('radiusKm', '25'); } else nearParams(params, area);
    const [hostKind, hostId] = first(query, 'host').split(':');
    if ((hostKind === 'CLUB' || hostKind === 'ORGANIZATION') && /^[1-9]\d*$/.test(hostId ?? '')) { params.set('hostKind', hostKind); params.set('hostId', hostId); }
    if (query.q) params.set('q', query.q);
    return params;
}

const withParams = (params: URLSearchParams, extra: Record<string, string>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(extra)) next.set(key, value); return next; };

/**
 * Tournaments not yet over first, by start date, then the finished ones, newest first: two searches read as one list.
 * A finished tournament that still ends today or later is in the first search, so the second skips it and the count
 * subtracts it.
 */
async function liveThenFinished(params: URLSearchParams, page: number, signal: AbortSignal) {
    const today = isoDay();
    const live = (p: number, size = PAGE) => browseCompetitions(withParams(params, { from: today, page: String(p), size: String(size) }), signal);
    const done = (p: number, size = PAGE) => browseCompetitions(withParams(params, { status: 'COMPLETED', sort: 'newest', page: String(p), size: String(size) }), signal);
    const [liveTotal, doneTotal, both] = await shared(`tournament-totals:${params}:${today}`, () => Promise.all([live(0, 1), done(0, 1),
        browseCompetitions(withParams(params, { status: 'COMPLETED', from: today, page: '0', size: '1' }), signal)]).then(pages => pages.map(result => result.totalElements)));
    const livePages = Math.ceil(liveTotal / PAGE), total = liveTotal + doneTotal - both;
    if (page < livePages) {
        const result = await live(page);
        return { cards: result.content, total, hasMore: page + 1 < livePages || doneTotal > both };
    }
    const result = await done(page - livePages);
    return { cards: result.content.filter(card => !card.endDate || isoDayOf(zoned(card.endDate)!) < today), total, hasMore: page - livePages + 1 < Math.ceil(doneTotal / PAGE) };
}

/**
 * All tournaments: the full directory under their age groups, finished ones last; following the World area. Format
 * as picture tiles, entries and age in the strip under the map; the rest under More filters.
 */
export const allTournaments: DirectorySource<TournamentItem> = {
    id: 'all',
    label: 'All tournaments',
    noun: ['tournament', 'tournaments'],
    searchLabel: 'Search tournaments',
    searchPlaceholder: 'Search leagues, cups and festivals',
    layout: 'rows',
    pageSize: PAGE,
    area: true,
    filters: TOURNAMENT_FILTERS,
    sorts: [{ value: 'date', label: 'Starts soonest' }, { value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name A–Z' }],
    async load(query, page, { signal, area }) {
        const notice = feeNotice(first(query, 'minFee'), first(query, 'maxFee'));
        if (notice) return { items: [], total: null, hasMore: false, notice };
        const params = cardParams(query, area);
        const entries = (first(query, 'registration') || undefined) as EntriesState | undefined;
        const sort = query.sort || 'date';
        if (sort === 'date' && !first(query, 'status') && !first(query, 'from') && !first(query, 'to')) {
            const { cards, total, hasMore } = await liveThenFinished(params, page, signal);
            return { items: cards.map(card => fromCard(card, entries)), total, hasMore };
        }
        if (sort !== 'date') params.set('sort', sort);
        params.set('page', String(page));
        params.set('size', String(PAGE));
        const result = await browseCompetitions(params, signal);
        return { items: result.content.map(card => fromCard(card, entries)), total: result.totalElements, hasMore: page + 1 < result.totalPages };
    },
    key: item => String(item.id),
    Item: TournamentRow,
    line: tournamentLine,
    groups: { of: ageGroupOf, uncounted: true },
    placeKinds: ['TOURNAMENT'],
    place: tournamentPlace,
    empty: { title: 'No tournaments published yet', body: 'Leagues, cups and festivals appear here when organisers publish them.' },
};
