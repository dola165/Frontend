import { eventSearch, type EventItem } from '../../../requests/api';
import { first, type DirectorySource } from '../../directory/types';
import { EventRow } from './EventRow';
import { eventDayGroup } from './eventDays';
import { ArrangementRow } from './ArrangementRow';
import { hostingGroup, LANES, loadMyArrangements, type Arrangement } from './arrangements';
import { exchangeFilters } from './listings';
import { arrangementLine, eventLine } from './matchBrowse';
import { eventPlace, listingPlace } from './matchPlaces';

const ARRANGEMENT_KEYS = ['format', 'ageGroup', 'level', 'from', 'to'];
const arrangementFilters = (query: Parameters<DirectorySource<Arrangement>['load']>[0]) => {
    const params = new URLSearchParams();
    for (const key of ARRANGEMENT_KEYS) if (first(query, key)) params.set(key, first(query, key));
    if (query.q) params.set('q', query.q);
    return params.toString();
};

/**
 * My arrangements in four lanes: what needs me, what waits on the other side, what is coming up, what was played
 * (with its score). Each line says what it waits for, or shows its track of four dots. The tab counts what needs me.
 */
export const arrangements: DirectorySource<Arrangement> = {
    id: 'mine',
    label: 'My arrangements',
    noun: ['arrangement', 'arrangements'],
    searchLabel: 'Search my arrangements',
    searchPlaceholder: 'Club, title or city',    pageSize: 24,
    personal: true,
    // Age group and format; the lanes replace a status filter.
    filters: exchangeFilters.filter(filter => !['venuePreference', 'around'].includes(filter.key)).map(filter => filter.key === 'ageGroup' ? { ...filter, primary: true } : filter),
    count: async ({ sessionId, authenticated }) => {
        if (!authenticated) return null;
        const needs = (await loadMyArrangements(sessionId, '')).filter(a => a.lane === 'needs').length;
        return needs ? { count: needs, tone: 'warning', label: 'need you' } : null;
    },
    async load(query, _page, { sessionId }) {
        const items = await loadMyArrangements(sessionId, arrangementFilters(query));
        return { items, total: items.length, hasMore: false };
    },
    key: a => a.code,
    Item: ArrangementRow,
    line: arrangementLine,
    placeKinds: ['CLUB'],
    place: (a, places) => listingPlace(a.m, places),
    groups: { of: a => LANES[a.lane], always: Object.values(LANES) },
    panel: hostingGroup,
    empty: { title: 'No match arrangements yet', body: 'Arrange a match with a club you know, or post an open match for other teams to answer.' },
};

export const events: DirectorySource<EventItem> = {
    id: 'events',
    label: 'Events',
    tabLabel: 'All events',
    noun: ['event', 'events'],
    searchLabel: 'Search events',
    searchPlaceholder: 'Search by name or club',    pageSize: 20,
    filters: [
        { kind: 'choice', key: 'activity', label: 'Activity', primary: true, allLabel: 'Everything', options: [
            { value: 'MATCH', label: 'Matches' }, { value: 'TOURNAMENT', label: 'Tournaments' }, { value: 'TRYOUT', label: 'Trials' }, { value: 'TRAINING', label: 'Public training' }, { value: 'OTHER', label: 'Other' },
        ] },
        { kind: 'text', key: 'location', label: 'Place', placeholder: 'City, venue or address' },
        { kind: 'date', key: 'from', label: 'From' },
        { kind: 'date', key: 'to', label: 'Until' },
    ],
    async load(query, page, { signal, sessionId, country }) {
        const location = first(query, 'location');
        const result = await eventSearch({ q: query.q, location, activity: first(query, 'activity') || 'ALL', from: first(query, 'from') || undefined, to: first(query, 'to') || undefined,
            country: country && !location ? country : undefined, page, size: 20 }, sessionId, signal);
        return { items: result.items, total: result.total, hasMore: result.hasMore };
    },
    key: item => `${item.kind}:${item.id}`,
    Item: EventRow,
    // By day, soonest first; tournaments already under way first of all (the backend sorts by name, so within a page).
    groups: { of: eventDayGroup, uncounted: true },
    line: eventLine,
    placeKinds: ['MATCH', 'TOURNAMENT', 'TRYOUT', 'CLUB'],
    place: eventPlace,
    empty: { title: 'No published events', body: 'Clubs and organisers publish matches, competitions, trials and public training here. Private schedules never appear.' },
};
