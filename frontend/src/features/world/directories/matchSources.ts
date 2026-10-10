import { getMatchHistory, type HistoryMatch } from '../../matchHistory/api';
import { ages, formats, levels, type Match } from '../../matchExchange/api';
import { eventSearch, type EventItem } from '../../requests/api';
import { fetchMatchListings } from '../api';
import { first, nearbyPoint, type DirectorySource } from '../directory/types';
import { fixtureDay, fixtureTime, sentence } from '../format';
import { EventItemRow } from '../rows';
import { ArrangementItem, FixtureItem, ListingItem, PastMatchTool } from './matchItems';
import { clubScope, competitionScope } from './scopes';

/** Age groups as filter options: codes such as U12 as they are, the rest in words. */
export const AGE_OPTIONS = ages.map(value => ({ value, label: /^U\d+$/.test(value) ? value : sentence(value) }));
const FORMAT_OPTIONS = Object.entries(formats).filter(([key]) => key !== 'OTHER').map(([value, label]) => ({ value, label }));

export const fixtures: DirectorySource<HistoryMatch> = {
    id: 'fixtures',
    label: 'Fixtures & results',
    noun: ['match', 'matches'],
    searchLabel: 'Search fixtures and results',
    searchPlaceholder: 'Search by club, squad, competition or ground',
    layout: 'rows',
    pageSize: 24,
    signInReason: 'Fixtures and results are visible to signed-in members.',
    // Scores and kick-off changes arrive without a reload, as on the old match history.
    refreshMs: 30_000,
    filters: [
        { kind: 'choice', key: 'period', label: 'When', primary: true, fallback: 'UPCOMING', options: [{ value: 'UPCOMING', label: 'Upcoming' }, { value: 'HISTORY', label: 'Results' }, { value: 'NEEDS_RESULT', label: 'Needs a result', signedIn: true }] },
        { kind: 'choice', key: 'source', label: 'Kind of match', primary: true, allLabel: 'All matches', options: [{ value: 'TOURNAMENT', label: 'Competitions' }, { value: 'SCHEDULE', label: 'Club fixtures' }, { value: 'MATCH_EXCHANGE', label: 'Friendlies' }] },
        { kind: 'toggle', key: 'mine', label: 'My teams', primary: true },
        clubScope('clubId'),
        { kind: 'scope', key: 'squadId', label: 'One squad' },
        competitionScope('tournamentId'),
        { kind: 'choice', key: 'resultStatus', label: 'Result', allLabel: 'Any result', when: query => first(query, 'period') !== 'UPCOMING', options: [
            { value: 'NONE', label: 'Not recorded' }, { value: 'PROPOSED', label: 'Awaiting confirmation' }, { value: 'DISPUTED', label: 'Disputed' }, { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'RECORDED', label: 'Recorded by organiser' }, { value: 'BYE', label: 'Bye' }, { value: 'LEGACY', label: 'Previously recorded' },
        ] },
        { kind: 'date', key: 'from', label: 'From' },
        { kind: 'date', key: 'to', label: 'Until' },
    ],
    async load(query, page, { signal, sessionId }) {
        const params = new URLSearchParams({ period: first(query, 'period') || 'UPCOMING', page: String(page), size: '24' });
        for (const key of ['source', 'resultStatus', 'from', 'to', 'mine', 'clubId', 'squadId', 'tournamentId']) if (first(query, key)) params.set(key, first(query, key));
        if (query.q) params.set('q', query.q);
        const result = await getMatchHistory(params.toString(), signal, sessionId);
        return { items: result.items, total: result.total, hasMore: (page + 1) * result.pageSize < result.total };
    },
    key: match => match.id,
    Item: FixtureItem,
    Tools: PastMatchTool,
    empty: { title: 'No matches here yet', body: 'Matches appear when a team or competition organiser schedules or records them.' },
};

const exchangeFilters = [
    { kind: 'choice', key: 'format', label: 'Format', primary: true, allLabel: 'Any format', options: FORMAT_OPTIONS },
    { kind: 'nearby', key: 'around', label: 'Near me', km: 50 },
    { kind: 'choice', key: 'ageGroup', label: 'Age group', allLabel: 'Any age group', options: AGE_OPTIONS },
    { kind: 'choice', key: 'level', label: 'Level', allLabel: 'Any level', options: levels.map(value => ({ value, label: sentence(value) })) },
    { kind: 'choice', key: 'venuePreference', label: 'Ground', allLabel: 'Home or away', options: [{ value: 'HOME', label: 'They host' }, { value: 'AWAY', label: 'They travel' }] },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'Until' },
] satisfies DirectorySource<Match>['filters'];

const loadListings = (mine: boolean): DirectorySource<Match>['load'] => async (query, page, { signal }) => {
    const params = new URLSearchParams();
    for (const key of ['format', 'ageGroup', 'level', 'venuePreference', 'from', 'to']) if (first(query, key)) params.set(key, first(query, key));
    const around = nearbyPoint(query, 'around');
    if (around) { params.set('lat', String(around.lat)); params.set('lng', String(around.lng)); params.set('radiusKm', '50'); }
    if (query.q) params.set('q', query.q);
    if (mine) params.set('mine', 'true');
    if (page) params.set('page', String(page));
    const result = await fetchMatchListings(params, signal);
    const size = result.pageSize ?? 24;
    return { items: result.items, total: result.total, hasMore: (page + 1) * size < result.total };
};
const listingPoint = (m: Match) => m.location_lat != null && m.location_lng != null
    ? { id: String(m.event_id), lat: m.location_lat, lng: m.location_lng, label: m.title, meta: `${fixtureDay(m.starts_at_iso, m.timezone)} ${fixtureTime(m.starts_at_iso, m.timezone)} · ${m.location_name}`, tone: 'match' as const, to: `/match-exchange/${m.event_id}` }
    : null;

export const exchange: DirectorySource<Match> = {
    id: 'exchange',
    label: 'Open matches',
    noun: ['open match', 'open matches'],
    searchLabel: 'Search open matches',
    searchPlaceholder: 'Search by club, squad or ground',
    layout: 'rows',
    pageSize: 24,
    signInReason: 'Teams looking for an opponent are visible to signed-in members.',
    filters: exchangeFilters,
    load: loadListings(false),
    key: m => String(m.event_id),
    Item: ListingItem,
    point: listingPoint,
    mapLink: query => `/world/map?layers=matches${query.q ? `&q=${encodeURIComponent(query.q)}` : ''}`,
    empty: { title: 'No open matches right now', body: 'Teams post here when they need an opponent for a date.' },
};

export const arrangements: DirectorySource<Match> = {
    id: 'mine',
    label: 'My arrangements',
    noun: ['arrangement', 'arrangements'],
    searchLabel: 'Search my arrangements',
    searchPlaceholder: 'Search by opponent, squad or ground',
    layout: 'rows',
    pageSize: 24,
    personal: true,
    filters: exchangeFilters.filter(filter => filter.key !== 'venuePreference' && filter.key !== 'around'),
    load: loadListings(true),
    key: m => String(m.event_id),
    Item: ArrangementItem,
    point: listingPoint,
    empty: { title: 'No match arrangements yet', body: 'Arrange a match with a club you know, or post an open match for other teams to answer.' },
};

export const events: DirectorySource<EventItem> = {
    id: 'events',
    label: 'Events',
    tabLabel: 'All events',
    noun: ['event', 'events'],
    searchLabel: 'Search events',
    searchPlaceholder: 'Search by name or club',
    layout: 'rows',
    pageSize: 20,
    filters: [
        { kind: 'choice', key: 'activity', label: 'Activity', primary: true, allLabel: 'Everything', options: [
            { value: 'MATCH', label: 'Matches' }, { value: 'TOURNAMENT', label: 'Competitions' }, { value: 'TRYOUT', label: 'Trials' }, { value: 'TRAINING', label: 'Public training' }, { value: 'OTHER', label: 'Other' },
        ] },
        { kind: 'text', key: 'location', label: 'Place', placeholder: 'City, venue or address' },
        { kind: 'date', key: 'from', label: 'From' },
        { kind: 'date', key: 'to', label: 'Until' },
    ],
    async load(query, page, { signal, sessionId }) {
        const result = await eventSearch({ q: query.q, location: first(query, 'location'), activity: first(query, 'activity') || 'ALL', from: first(query, 'from') || undefined, to: first(query, 'to') || undefined, page, size: 20 }, sessionId, signal);
        return { items: result.items, total: result.total, hasMore: result.hasMore };
    },
    key: item => `${item.kind}:${item.id}`,
    Item: EventItemRow,
    empty: { title: 'No published events', body: 'Clubs and organisers publish matches, competitions, trials and public training here. Private schedules never appear.' },
};
