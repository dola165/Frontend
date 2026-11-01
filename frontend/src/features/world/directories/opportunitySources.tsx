import { searchTryouts, type TryoutPosting } from '../../tryouts/api';
import { fetchOpportunity, searchOpportunities } from '../../admissions/api';
import type { Participant } from '../../admissions/types';
import { postingLabel } from '../../tryouts/tryoutCopy';
import { availabilityCopy } from '../../admissions/applicant/copy';
import { wt } from '../copy';
import { first, type DirectoryQuery, type DirectorySource, type FilterDef, type FilterOption } from '../directory/types';
import { bilingual, calendarDaysUntil, codeLabel, fixtureDay, fixtureTime } from '../format';
import { TrainingItem, TrialItem, type GroupResult } from './opportunityItems';
import { firstName } from '../players';
import { groupSearch, trialSearch, publicParams } from './opportunitySearch';
import { searchSpec } from '../watches/api';
import { clubScope } from './scopes';

const PAGE = 20;
export const trials: DirectorySource<TryoutPosting> = {
    id: 'trials', area: true, forContext: true,
    watch: (query, context) => { const params = publicParams(trialSearch(query, context)); return params.has('forMe') ? null : searchSpec('TRIALS', params); },
    label: 'Trials',
    noun: ['trial', 'trials'],
    searchLabel: 'Search trials',
    searchPlaceholder: 'Search by club, position or age group',
    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'status', label: 'Applications', primary: true, fallback: 'OPEN', options: [{ value: 'OPEN', label: 'Open now' }, { value: 'ALL', label: 'All published' }] },
        clubScope('clubId'),
        { kind: 'scope', key: 'location', label: 'Place' },
        { kind: 'scope', key: 'countryCode', label: 'Country' },
        { kind: 'date', key: 'from', label: 'From' },
        { kind: 'date', key: 'to', label: 'Until' },
        { kind: 'choice', key: 'closed', label: 'Show only', allLabel: 'Any state', when: query => first(query, 'status') === 'ALL', options: ['CLOSED', 'FILLED', 'EXPIRED', 'CANCELLED'].map(value => ({ value, label: postingLabel(value, en => en) })) },
        // Age groups that suit the person or their children, in their country: on for players, parents and anyone under 18,
        // theirs to turn off.
        { kind: 'toggle', key: 'forMe', label: 'Fits my age or my children’s', primary: true },
    ],
    defaults: ({ role, minor }): Record<string, string[]> => role === 'player' || role === 'parent' || minor ? { forMe: ['true'] } : {},
    async load(query, page, { signal, area, country, authenticated }) {
        const result = await searchTryouts({ ...trialSearch(query, { area, country, authenticated }), page, size: PAGE }, signal);
        return { items: result.items, total: result.total, hasMore: result.hasMore };
    },
    key: trial => String(trial.id),
    Item: TrialItem,
    line: trial => {
        const left = trial.status === 'OPEN' ? calendarDaysUntil(trial.deadline) : null;
        const closing = left != null && left >= 0 && left <= 3;
        return { when: { time: fixtureTime(trial.tryoutDate), day: fixtureDay(trial.tryoutDate) }, title: trial.title, to: `/tryouts/${trial.id}`, action: wt('Open trial'),
            detail: [trial.clubName, codeLabel(trial.ageGroup), codeLabel(trial.position)].filter(Boolean).join(' · '),
            fact: closing ? wt('Apply by {day}', { day: fixtureDay(trial.deadline) }) : postingLabel(trial.status, bilingual), factTone: closing ? 'warning' : trial.status === 'OPEN' ? 'accent' : undefined };
    },
    // A trial at its own ground, else (marked approximate) at its club.
    placeKinds: ['TRYOUT', 'CLUB'],
    place: (trial, places) => {
        const marker = places.trial(trial.id);
        const own = marker && marker.clubId === trial.clubId ? marker : undefined;
        const at = own ?? places.club(trial.clubId);
        return at ? { lat: at.lat, lng: at.lng, tone: 'trial', approximate: own ? undefined : 'club', label: trial.title, meta: `${fixtureDay(trial.tryoutDate)} · ${trial.clubName}`, to: `/tryouts/${trial.id}`, noun: ['trial', 'trials'] } : null;
    },
    empty: { title: 'No open trials right now', body: 'Clubs publish trials here before each intake.' },
};

/** Trials as a guest sees them: without "fits my age", which needs to know who is looking. */
export const guestTrials: DirectorySource<TryoutPosting> = { ...trials, filters: trials.filters.filter(filter => filter.key !== 'forMe'), defaults: undefined };


/**
 * Training groups taking players. A parent can search for one of their children: the child's
 * birth year and category then decide which groups fit, and the choice follows them to the group
 * and to other World pages through the shared resolved For context.
 */
export function groupsSource(participants: Participant[], resolvedChild?: Participant, clubs?: FilterOption[]): DirectorySource<GroupResult> {
    const playerFilter: FilterDef[] = participants.some(person => person.minor && person.guardian) ? [{ kind: 'scope', key: 'player', label: 'For' }] : [];
    const chosen = (value: string) => value ? participants.find(p => String(p.id) === value) : resolvedChild;
    const searchFilters: FilterDef[] = [
        { kind: 'toggle', key: 'beginner', label: 'Beginners welcome', primary: true },
        resolvedChild?.gender ? { kind: 'scope', key: 'gender', label: 'Category' } : { kind: 'choice', key: 'gender', label: 'Category', primary: true, allLabel: 'Everyone', options: [{ value: 'MALE', label: 'Boys and men' }, { value: 'FEMALE', label: 'Girls and women' }] },
        // With the list of clubs a person can pick one; until then a club from a link shows as a removable scope.
        clubs?.length ? { kind: 'choice' as const, key: 'club', label: 'Club', allLabel: 'Any club', options: clubs } : clubScope('club'),
        { kind: 'scope', key: 'organization', label: 'One organisation' },
        { kind: 'scope', key: 'country', label: 'Country' },
        { kind: 'scope', key: 'city', label: 'City' },
        resolvedChild ? { kind: 'scope', key: 'birthYear', label: 'Player’s birth year' } : { kind: 'text', key: 'birthYear', label: 'Player’s birth year', placeholder: 'For example 2015' },
        { kind: 'choice', key: 'method', label: 'How to join', allLabel: 'Any way', options: [{ value: 'DIRECT', label: 'Join directly' }, { value: 'INTRODUCTION', label: 'Introductory session first' }, { value: 'SELECTIVE', label: 'Selection' }] },
        { kind: 'toggle', key: 'all', label: 'Include groups not taking players' },
        { kind: 'toggle', key: 'includeWaitlist', label: 'Include waiting lists' },
    ];
    return {
        id: 'groups', area: true, forContext: true,
        watch: (query, context) => first(query, 'group') ? null : searchSpec('GROUPS', publicParams(groupSearch(query, chosen(first(query, 'player')), context))),
        label: 'Places to train',
        noun: ['group', 'groups'],
        searchLabel: 'Search training groups',
        searchPlaceholder: 'Search groups or organisations',
        pageSize: PAGE,
        version: participants.map(p => [p.id, p.dateOfBirth, p.gender].join(':')).join(','),
        filters: [
            ...playerFilter,
            { kind: 'scope', key: 'group', label: 'Training group', name: (value, signal) => fetchOpportunity(Number(value), signal).then(group => group.name) },
            ...searchFilters.map(filter => ({ ...filter, when: (query: DirectoryQuery) => !first(query, 'group') && (filter.when?.(query) ?? true) })),
        ],
        async load(query, page, { signal, area, country }) {
            const participant = chosen(first(query, 'player'));
            // A link from a joining page reads that exact public group, even when it is no longer taking players.
            // Its actual venue must not be replaced by the club pin or lost beyond the first search page.
            const scope = first(query, 'group');
            if (scope) {
                const groupId = Number(scope);
                if (!/^[1-9]\d*$/.test(scope) || !Number.isSafeInteger(groupId)) throw new Error('This group could not load.');
                const group = await fetchOpportunity(groupId, signal);
                const matches = !query.q || [group.name, group.organizationName].some(value => value.toLowerCase().includes(query.q.trim().toLowerCase()));
                return { items: matches && page === 0 ? [{ group, player: participant?.id }] : [], total: matches ? 1 : 0, hasMore: false };
            }
            const result = await searchOpportunities({ ...groupSearch(query, participant, { area, country }), page, size: PAGE }, signal);
            return { items: result.items.map(group => ({ group, player: participant?.id })), total: result.total, hasMore: result.hasMore };
        },
        key: ({ group }) => String(group.id),
        Item: TrainingItem,
        line: ({ group, player }) => {
            const open = group.availability === 'PLACES_AVAILABLE' || group.availability === 'APPLICATIONS_OPEN';
            return { title: group.name, to: `/admissions/opportunities/${group.id}${player ? `?player=${player}` : ''}`, action: wt('Open group'), crest: { name: group.organizationName },
                detail: [group.organizationName, wt('Born {from}–{to}', { from: group.birthYearFrom, to: group.birthYearTo }), group.location.name].filter(Boolean).join(' · '),
                fact: bilingual(...availabilityCopy[group.availability]), factTone: open ? 'accent' : group.availability === 'WAITLIST' ? 'warning' : undefined };
        },
        place: ({ group, player }) => group.location.latitude != null && group.location.longitude != null
            ? { lat: group.location.latitude, lng: group.location.longitude, noun: ['group', 'groups'], label: group.name, meta: `${group.organizationName} · ${group.location.name}`, tone: 'club', to: `/admissions/opportunities/${group.id}${player ? `?player=${player}` : ''}` }
            : null,
        // A parent sees whom the list is for, with the other children one press away.
        heading: query => {
            const child = chosen(first(query, 'player'));
            return child?.minor ? wt('Training groups for {name}', { name: firstName(child.name) }) : wt('Training groups');
        },
        empty: { title: 'No groups are taking players', body: 'Include waiting lists, or ask a club directly from its profile.' },
    };
}

