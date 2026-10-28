import { searchTryouts, type TryoutPosting } from '../../tryouts/api';
import { fetchOpportunity, searchOpportunities } from '../../admissions/api';
import type { DiscoveryQuery, Participant } from '../../admissions/types';
import { postingLabel } from '../../tryouts/tryoutCopy';
import { availabilityCopy } from '../../admissions/applicant/copy';
import { wt } from '../copy';
import { first, type DirectoryQuery, type DirectorySource, type FilterDef, type FilterOption, type RememberedChoice } from '../directory/types';
import { bilingual, calendarDaysUntil, codeLabel, fixtureDay, fixtureTime } from '../format';
import { TrainingItem, TrialItem, type GroupResult } from './opportunityItems';
import { firstName } from '../players';
import { ChildSwitch } from './ChildSwitch';
import { clubScope } from './scopes';

const PAGE = 20;
export const trials: DirectorySource<TryoutPosting> = {
    id: 'trials',
    label: 'Trials',
    noun: ['trial', 'trials'],
    searchLabel: 'Search trials',
    searchPlaceholder: 'Search by club, position or age group',
    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'status', label: 'Applications', primary: true, fallback: 'OPEN', options: [{ value: 'OPEN', label: 'Open now' }, { value: 'ALL', label: 'All published' }] },
        clubScope('clubId'),
        { kind: 'text', key: 'location', label: 'Place', placeholder: 'City or ground' },
        { kind: 'date', key: 'from', label: 'From' },
        { kind: 'date', key: 'to', label: 'Until' },
        { kind: 'choice', key: 'closed', label: 'Show only', allLabel: 'Any state', when: query => first(query, 'status') === 'ALL', options: ['CLOSED', 'FILLED', 'EXPIRED', 'CANCELLED'].map(value => ({ value, label: postingLabel(value, en => en) })) },
        // Age groups that suit the person or their children, in their country: on for players, parents and anyone under 18,
        // theirs to turn off.
        { kind: 'toggle', key: 'forMe', label: 'Fits my age or my children’s', primary: true },
    ],
    defaults: ({ role, minor }): Record<string, string[]> => role === 'player' || role === 'parent' || minor ? { forMe: ['true'] } : {},
    async load(query, page, { signal, country, authenticated }) {
        const status = first(query, 'status') === 'ALL' ? first(query, 'closed') || 'ALL' : 'OPEN';
        const clubId = first(query, 'clubId') || undefined, location = first(query, 'location');
        const result = await searchTryouts({ q: query.q, location, status, clubId, from: first(query, 'from') || undefined, to: first(query, 'to') || undefined,
            countryCode: country && !clubId && !location ? country : undefined, forMe: authenticated && first(query, 'forMe') === 'true' ? 'true' : undefined, page, size: PAGE }, signal);
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

const birthYearOf = (participant?: Participant) => participant?.dateOfBirth ? Number(participant.dateOfBirth.slice(0, 4)) : undefined;

/**
 * Training groups taking players. A parent can search for one of their children: the child's
 * birth year and category then decide which groups fit, and the choice follows them to the group
 * and to other World pages (`remember`).
 */
export function groupsSource(participants: Participant[], remember?: RememberedChoice, clubs?: FilterOption[]): DirectorySource<GroupResult> {
    // Offered to parents: someone searching only for themselves needs no choice here.
    const playerFilter = participants.some(p => p.minor)
        ? [{ kind: 'choice' as const, key: 'player', label: 'Searching for', primary: true, allLabel: 'Anyone', remember, options: participants.map(p => ({ value: String(p.id), label: p.minor ? p.name : wt('{name} (you)', { name: p.name }) })) }]
        : [];
    const chosen = (value: string) => participants.find(p => String(p.id) === value);
    const children = participants.filter(p => p.minor);
    const searchFilters: FilterDef[] = [
        { kind: 'toggle', key: 'beginner', label: 'Beginners welcome', primary: true },
        { kind: 'choice', key: 'gender', label: 'Category', primary: true, allLabel: 'Everyone', when: query => !chosen(first(query, 'player'))?.gender, options: [{ value: 'MALE', label: 'Boys and men' }, { value: 'FEMALE', label: 'Girls and women' }] },
        // With the list of clubs a person can pick one; until then a club from a link shows as a removable scope.
        clubs?.length ? { kind: 'choice' as const, key: 'club', label: 'Club', allLabel: 'Any club', options: clubs } : clubScope('club'),
        { kind: 'scope', key: 'organization', label: 'One organisation' },
        { kind: 'text', key: 'birthYear', label: 'Player’s birth year', placeholder: 'For example 2015', when: query => !chosen(first(query, 'player')) },
        { kind: 'choice', key: 'method', label: 'How to join', allLabel: 'Any way', options: [{ value: 'DIRECT', label: 'Join directly' }, { value: 'INTRODUCTION', label: 'Introductory session first' }, { value: 'SELECTIVE', label: 'Selection' }] },
        { kind: 'toggle', key: 'all', label: 'Include groups not taking players' },
        { kind: 'toggle', key: 'includeWaitlist', label: 'Include waiting lists' },
    ];
    return {
        id: 'groups',
        label: 'Places to train',
        noun: ['group', 'groups'],
        searchLabel: 'Search training groups',
        searchPlaceholder: 'Search groups or organisations',
        pageSize: PAGE,
        version: participants.map(p => p.id).join(','),
        filters: [
            ...playerFilter,
            { kind: 'scope', key: 'group', label: 'Training group', name: (value, signal) => fetchOpportunity(Number(value), signal).then(group => group.name) },
            ...searchFilters.map(filter => ({ ...filter, when: (query: DirectoryQuery) => !first(query, 'group') && (filter.when?.(query) ?? true) })),
        ],
        async load(query, page, { signal, country }) {
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
            const typedYear = Number(first(query, 'birthYear'));
            const birthYear = birthYearOf(participant) ?? (typedYear >= 1900 && typedYear <= 2100 ? typedYear : undefined);
            const id = (key: string) => Number(first(query, key)) > 0 ? Number(first(query, key)) : undefined;
            const result = await searchOpportunities({
                q: query.q || undefined, acceptingOnly: first(query, 'all') !== 'true', includeWaitlist: first(query, 'includeWaitlist') === 'true',
                beginner: first(query, 'beginner') === 'true' ? true : undefined,
                gender: (participant?.gender || first(query, 'gender') || undefined) as DiscoveryQuery['gender'],
                method: (first(query, 'method') || undefined) as DiscoveryQuery['method'],
                clubId: id('club'), organizationId: id('organization'), birthYear, page, size: PAGE,
                // The person's own country unless a club or an organisation is named.
                country: country && !id('club') && !id('organization') ? [country] : undefined,
            }, signal);
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
        HeadTools: children.length ? props => <ChildSwitch {...props} children={children} remember={remember} /> : undefined,
        empty: { title: 'No groups are taking players', body: 'Include waiting lists, or ask a club directly from its profile.' },
    };
}

