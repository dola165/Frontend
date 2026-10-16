import { fetchOpenJobDirectory, type ClubJob } from '../../clubs/api';
import { CATEGORIES, labelForCategory } from '../../clubs/jobLabels';
import { searchTryouts, type TryoutPosting } from '../../tryouts/api';
import { searchOpportunities } from '../../admissions/api';
import type { DiscoveryQuery, Participant } from '../../admissions/types';
import { postingLabel } from '../../tryouts/tryoutCopy';
import { availabilityCopy } from '../../admissions/applicant/copy';
import { wt } from '../copy';
import { first, type DirectorySource, type FilterOption, type RememberedChoice } from '../directory/types';
import { bilingual, calendarDaysUntil, codeLabel, ENGAGEMENT, factTone, fixtureDay, fixtureTime, postedLabel } from '../format';
import { peekOf } from '../peek/usePeek';
import { JobItem, TrainingItem, TrialItem, type GroupResult } from './opportunityItems';
import { firstName } from '../players';
import { ChildSwitch } from './ChildSwitch';
import { clubScope } from './scopes';

// The open-role list is one request; keep it briefly so paging and refining don't refetch it.
// It is shared between searches, so it is never cancelled by one of them.
let jobCache: { at: number; jobs: Promise<ClubJob[]> } | null = null;
const openJobs = () => {
    if (!jobCache || Date.now() - jobCache.at > 60_000) jobCache = { at: Date.now(), jobs: fetchOpenJobDirectory().catch(error => { jobCache = null; throw error; }) };
    return jobCache.jobs;
};
const lower = (value?: string | null) => (value ?? '').toLowerCase();
const time = (value?: string | null) => Date.parse(value ?? '') || 0;

const PAGE = 20;
export const jobs: DirectorySource<ClubJob> = {
    id: 'jobs',
    label: 'Jobs & volunteering',
    noun: ['job', 'jobs'],
    searchLabel: 'Search jobs and volunteering',
    searchPlaceholder: 'Search roles, clubs or skills',    pageSize: PAGE,
    filters: [
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
    async load(query, page) {
        const text = lower(query.q), posted = first(query, 'posted');
        const since = posted === '7D' ? Date.now() - 7 * 86_400_000 : posted === '30D' ? Date.now() - 30 * 86_400_000 : 0;
        const has = (value: string | null | undefined, wanted: string) => !wanted || lower(value).includes(lower(wanted));
        const matches = (await openJobs())
            .filter(job => !first(query, 'engagement') || (job.engagementType ?? 'UNSPECIFIED') === first(query, 'engagement'))
            .filter(job => !first(query, 'category') || job.category === first(query, 'category'))
            .filter(job => !first(query, 'clubId') || String(job.clubId) === first(query, 'clubId'))
            .filter(job => has(job.clubCountryName, first(query, 'country')) && has(job.clubCityName, first(query, 'city')))
            .filter(job => has(job.ageGroup, first(query, 'ageGroup')) && has(job.level, first(query, 'level')))
            .filter(job => !since || time(job.createdAt) >= since)
            .filter(job => !text || [job.title, job.description, job.clubName, job.requiredRole, labelForCategory(job.category)].some(value => lower(value).includes(text)))
            .sort((a, b) => (query.sort === 'OLDEST' ? time(a.createdAt) - time(b.createdAt) || a.id - b.id : time(b.createdAt) - time(a.createdAt) || b.id - a.id));
        return { items: matches.slice(page * PAGE, (page + 1) * PAGE), total: matches.length, hasMore: (page + 1) * PAGE < matches.length };
    },
    key: job => String(job.id),
    Item: JobItem,
    line: job => {
        const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
        return { title: job.title, to: `/jobs/${job.id}`, action: wt('Open job'), crest: { src: job.clubLogoUrl, name: job.clubName ?? job.title }, peek: peekOf('job', job.id),
            detail: [job.clubName, job.clubCityName, postedLabel(job.createdAt)].filter(Boolean).join(' · '), fact: wt(terms.label), factTone: factTone(terms.tone) };
    },
    // Roles are counted on their club's pin ("3 roles").
    placeKinds: ['CLUB'],
    place: (job, places) => {
        const club = places.club(job.clubId);
        return club ? { lat: club.lat, lng: club.lng, tone: 'club', pin: `club:${job.clubId}`, label: job.clubName ?? club.name, noun: ['job', 'jobs'], to: `/clubs/${job.clubId}`, action: wt('Open club') } : null;
    },
    empty: { title: 'No open roles right now', body: 'Clubs post coaching, matchday and volunteer roles here.' },
};

export const trials: DirectorySource<TryoutPosting> = {
    id: 'trials',
    label: 'Trials',
    noun: ['trial', 'trials'],
    searchLabel: 'Search trials',
    searchPlaceholder: 'Search by club, position or age group',    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'status', label: 'Applications', primary: true, fallback: 'OPEN', options: [{ value: 'OPEN', label: 'Open now' }, { value: 'ALL', label: 'All published' }] },
        clubScope('clubId'),
        { kind: 'text', key: 'location', label: 'Place', placeholder: 'City or ground' },
        { kind: 'date', key: 'from', label: 'From' },
        { kind: 'date', key: 'to', label: 'Until' },
        { kind: 'choice', key: 'closed', label: 'Show only', allLabel: 'Any state', when: query => first(query, 'status') === 'ALL', options: ['CLOSED', 'FILLED', 'EXPIRED', 'CANCELLED'].map(value => ({ value, label: postingLabel(value, en => en) })) },
    ],
    async load(query, page, { signal }) {
        const status = first(query, 'status') === 'ALL' ? first(query, 'closed') || 'ALL' : 'OPEN';
        const result = await searchTryouts({ q: query.q, location: first(query, 'location'), status, clubId: first(query, 'clubId') || undefined, from: first(query, 'from') || undefined, to: first(query, 'to') || undefined, page, size: PAGE }, signal);
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
    return {
        id: 'groups',
        label: 'Places to train',
        noun: ['group', 'groups'],
        searchLabel: 'Search training groups',
        searchPlaceholder: 'Search groups or organisations',        pageSize: PAGE,
        version: participants.map(p => p.id).join(','),
        filters: [
            ...playerFilter,
            { kind: 'toggle', key: 'beginner', label: 'Beginners welcome', primary: true },
            { kind: 'choice', key: 'gender', label: 'Category', primary: true, allLabel: 'Everyone', when: query => !chosen(first(query, 'player'))?.gender, options: [{ value: 'MALE', label: 'Boys and men' }, { value: 'FEMALE', label: 'Girls and women' }] },
            // With the list of clubs a person can pick one; until then a club from a link shows as a removable scope.
            clubs?.length ? { kind: 'choice' as const, key: 'club', label: 'Club', allLabel: 'Any club', options: clubs } : clubScope('club'),
            { kind: 'scope', key: 'organization', label: 'One organisation' },
            { kind: 'text', key: 'birthYear', label: 'Player’s birth year', placeholder: 'For example 2015', when: query => !chosen(first(query, 'player')) },
            { kind: 'choice', key: 'method', label: 'How to join', allLabel: 'Any way', options: [{ value: 'DIRECT', label: 'Join directly' }, { value: 'INTRODUCTION', label: 'Introductory session first' }, { value: 'SELECTIVE', label: 'Selection' }] },
            { kind: 'toggle', key: 'all', label: 'Include groups not taking players' },
            { kind: 'toggle', key: 'includeWaitlist', label: 'Include waiting lists' },
        ],
        async load(query, page, { signal }) {
            const participant = chosen(first(query, 'player'));
            const typedYear = Number(first(query, 'birthYear'));
            const birthYear = birthYearOf(participant) ?? (typedYear >= 1900 && typedYear <= 2100 ? typedYear : undefined);
            const id = (key: string) => Number(first(query, key)) > 0 ? Number(first(query, key)) : undefined;
            const result = await searchOpportunities({
                q: query.q || undefined, acceptingOnly: first(query, 'all') !== 'true', includeWaitlist: first(query, 'includeWaitlist') === 'true',
                beginner: first(query, 'beginner') === 'true' ? true : undefined,
                gender: (participant?.gender || first(query, 'gender') || undefined) as DiscoveryQuery['gender'],
                method: (first(query, 'method') || undefined) as DiscoveryQuery['method'],
                clubId: id('club'), organizationId: id('organization'), birthYear, page, size: PAGE,
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
        place: ({ group }) => group.location.latitude != null && group.location.longitude != null
            ? { lat: group.location.latitude, lng: group.location.longitude, noun: ['group', 'groups'], label: group.name, meta: `${group.organizationName} · ${group.location.name}`, tone: 'club', to: `/admissions/opportunities/${group.id}` }
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

