import { eventSearch, type EventItem } from '../../../requests/api';
import { first, type DirectorySource } from '../../directory/types';
import { EventRow } from './EventRow';
import { eventDayGroup } from './eventDays';
import { eventLine } from './matchBrowse';
import { eventPlace } from './matchPlaces';

export const events: DirectorySource<EventItem> = {
    id: 'events', area: true,
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
    async load(query, page, { signal, sessionId, country, area }) {
        const location = first(query, 'location') || area?.city || '';
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
