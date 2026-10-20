import { HOURS, posterOf, type Job } from '../../jobs/api';
import { fetchOpenJobDirectory, type ClubJob } from '../../clubs/api';
import { CATEGORIES } from '../../clubs/jobLabels';
import { searchTryouts, type TryoutPosting } from '../../tryouts/api';
import { fetchOpportunity, searchOpportunities } from '../../admissions/api';
import type { DiscoveryQuery, Participant } from '../../admissions/types';
import { postingLabel } from '../../tryouts/tryoutCopy';
import { availabilityCopy } from '../../admissions/applicant/copy';
import { wt } from '../copy';
import { first, type DirectoryQuery, type DirectorySource, type FilterDef, type FilterOption, type RememberedChoice } from '../directory/types';
import { bilingual, calendarDaysUntil, codeLabel, ENGAGEMENT, factTone, fixtureDay, fixtureTime, postedLabel } from '../format';
import { peekOf } from '../peek/usePeek';
import { JobItem, TrainingItem, TrialItem, type GroupResult } from './opportunityItems';
import { firstName } from '../players';
import { ChildSwitch } from './ChildSwitch';
import { clubScope } from './scopes';

const PAGE = 20;
export const jobs: DirectorySource<ClubJob> = {
    id: 'jobs',
    label: 'Jobs & volunteering',
    noun: ['job', 'jobs'],
    searchLabel: 'Search jobs and volunteering',
    searchPlaceholder: 'Search roles, clubs or skills',
    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'direction', label: 'Listing type', allLabel: 'All listings', options: [{ value: 'HIRING', label: 'Jobs' }, { value: 'OFFERING', label: 'People available' }] },
        { kind: 'choice', key: 'poster', label: 'Posted by', allLabel: 'Everyone', options: [{ value: 'clubs', label: 'Clubs' }, { value: 'people', label: 'People' }] },
        { kind: 'choice', key: 'hours', label: 'Hours', allLabel: 'Any hours', options: HOURS },
        { kind: 'choice', key: 'engagement', label: 'Terms', primary: true, allLabel: 'All roles', options: [{ value: 'PAID', label: 'Paid' }, { value: 'VOLUNTEER', label: 'Volunteering' }, { value: 'FLEXIBLE', label: 'Paid or volunteer' }] },
        clubScope('clubId'),
        { kind: 'choice', key: 'category', label: 'Football role', allLabel: 'Any football role', options: CATEGORIES.filter(item => item.value !== 'ALL').map(({ value, label }) => ({ value, label })) },
        { kind: 'text', key: 'country', label: 'Country', placeholder: 'Any country' },
        { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city' },
        { kind: 'text', key: 'ageGroup', label: 'Age group', placeholder: 'For example U12' },
        { kind: 'text', key: 'level', label: 'Level', placeholder: 'Any level' },
        { kind: 'choice', key: 'posted', label: 'Posted', allLabel: 'Any time', options: [{ value: '7D', label: 'Past 7 days' }, { value: '30D', label: 'Past 30 days' }] },
    ],
    sorts: [{ value: 'NEWEST', label: 'Newest first' }, { value: 'OLDEST', label: 'Oldest first' }],
    async load(query, page, { signal, country }) {
        const params = new URLSearchParams({ page: String(page), size: String(PAGE) });
        if (query.q) params.set('q', query.q);
        for (const key of ['direction', 'poster', 'hours', 'engagement', 'category', 'clubId', 'country', 'city', 'ageGroup', 'level', 'posted']) {
            const value = first(query, key);
            if (value) params.set(key, value);
        }
        // The person's own country unless a club or a place is named.
        if (country && !['clubId', 'country', 'city'].some(key => first(query, key))) params.set('countryCode', country);
        if (query.sort) params.set('sort', query.sort);
        const result = await fetchOpenJobDirectory(params, signal);
        return { items: result.content, total: result.totalElements, hasMore: (page + 1) * PAGE < result.totalElements };
    },
    key: job => String(job.id),
    Item: JobItem,
    line: job => {
        const poster = posterOf(job as Job);
        const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
        return { title: job.title, to: `/jobs/${job.id}`, action: wt('Open job'), crest: { src: poster.avatarUrl, name: poster.name }, peek: peekOf('job', job.id),
            detail: [poster.name, poster.city, postedLabel(job.createdAt)].filter(Boolean).join(' · '), fact: wt(terms.label), factTone: factTone(terms.tone) };
    },
    // Roles are counted on their club's pin ("3 roles").
    placeKinds: ['CLUB'],
    place: (job, places) => {
        const listing = job as Job, poster = posterOf(listing);
        if (poster.kind === 'PERSON') return listing.place ? { ...listing.place, tone: 'person', approximate: 'area', label: poster.city ?? wt('Town'), pin: `job-area:${poster.city}`, noun: ['job', 'jobs'], to: `/jobs/${job.id}`, action: wt('Open job') } : null;
        const club = places.club(job.clubId);
        return club ? { lat: club.lat, lng: club.lng, tone: 'club', pin: `club:${job.clubId}`, label: job.clubName ?? club.name, noun: ['job', 'jobs'], to: `/clubs/${job.clubId}`, action: wt('Open club') } : null;
    },
    empty: { title: 'No open roles right now', body: 'Clubs and people post jobs and availability here.' },
};

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

