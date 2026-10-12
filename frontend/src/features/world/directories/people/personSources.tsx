import { ClipboardList, Shirt, Stethoscope } from 'lucide-react';
import type { PersonRole } from '../../api';
import type { DirectorySource, FilterDef } from '../../directory/types';
import { valueScope } from '../scopes';
import { openToOptions, SERVICES } from './peopleWords';
import { countPeople, loadPeople, PAGE, type PersonItem } from './peopleData';
import { PersonResult } from './PersonResult';
import { personLine, personPlace, type PersonKind } from './personData';

export interface PeopleMode { /** The server has no people directory: only a name search works. */ searchOnly: boolean; onSearchOnly?: () => void }

const SIGN_IN = 'Profiles of coaches, players, referees and specialists are visible to signed-in members.';
/** Nearest first (from the World area) unless the person asks otherwise. */
export const PEOPLE_SORTS = [{ value: 'NEAREST', label: 'Nearest' }, { value: 'RELEVANCE', label: 'Best match' }, { value: 'NAME', label: 'Name A–Z' }];
const WHERE = { kind: 'choice', key: 'club', label: 'Where', allLabel: 'Clubs and independent',
    options: [{ value: 'any', label: 'At a club' }, { value: 'none', label: 'Independent' }] } as const satisfies FilterDef;
/** What the people in a view say they are open to: work, private training, a club… in that view's words. */
const openTo = (kind: PersonKind): FilterDef => ({ kind: 'choice', key: 'open', label: 'Open to', allLabel: 'Anyone', primary: true, multi: true, options: openToOptions(kind) });
/** Without the people directory, a link's filters show as chips that say what cannot be searched yet. */
const asScopes = (filters: FilterDef[]): FilterDef[] => filters.map(filter => valueScope(filter.key, filter.label));

/** What one person view needs besides its filters: who is in it, what it is called, how it reads. */
function personView({ id, label, noun, kind, roles, icon, subtitle, filters, params, defaults, empty }: {
    id: string; label: string; noun: [string, string]; kind: PersonKind; roles: PersonRole[]; icon: DirectorySource<PersonItem>['icon']; subtitle: string;
    filters: FilterDef[]; params: (values: Record<string, string[]>) => Record<string, string | string[] | undefined>;
    defaults: DirectorySource<PersonItem>['defaults']; empty: DirectorySource<PersonItem>['empty'];
}) {
    return ({ searchOnly, onSearchOnly }: PeopleMode): DirectorySource<PersonItem> => ({
        // Everyone is listed, the nearest to the World area first: a place orders the list, it never empties it.
        id, label, noun, icon, subtitle, layout: 'tiles', pageSize: PAGE, area: 'nearest', signInReason: SIGN_IN,
        version: searchOnly ? 'search' : 'directory',
        searchLabel: `Search ${noun[1]}`, searchPlaceholder: searchOnly ? 'Search people by name' : 'Name, club or what they do',
        filters: searchOnly ? asScopes(filters) : filters,
        sorts: PEOPLE_SORTS, sortable: () => !searchOnly,
        count: countPeople(roles),
        load: (query, page, context) => loadPeople({ roles, params: { ...params(query.values), openTo: query.values.open }, query, page, context, searchOnly, onSearchOnly }),
        key: person => String(person.id),
        Item: ({ item }) => <PersonResult item={item} kind={kind} />,
        line: person => personLine(person, kind),
        placeKinds: ['CLUB'],
        place: (person, places) => personPlace(person, places, noun),
        defaults: searchOnly ? undefined : defaults,
        empty: searchOnly ? { title: 'Search people by name', body: 'Type at least two letters of a name. Filtering by job, place or licence needs the people directory.' } : empty,
    });
}

const JOBS = ['Head coach', 'Assistant coach', 'Goalkeeper coach', 'Fitness coach', 'Youth coach', 'Performance analyst', 'Academy director', 'Team manager'];
const LADDER = [{ value: 'PRO', label: 'UEFA Pro' }, { value: 'A', label: 'UEFA A or higher' }, { value: 'B', label: 'UEFA B or higher' }, { value: 'C', label: 'UEFA C or higher' }, { value: 'GK', label: 'Goalkeeper licence', apart: true }];

/** Coaches and club staff: by job, by the licence they state, by what they are open to (work, private training). */
export const staffSource = personView({
    id: 'staff', label: 'Coaches & staff', noun: ['person', 'people'], kind: 'staff', roles: ['COACH', 'CLUB_STAFF'], icon: ClipboardList, subtitle: 'Coaches and club staff',
    filters: [
        { kind: 'choice', key: 'job', label: 'Job', primary: true, multi: true, options: JOBS.map(value => ({ value, label: value })) },
        { kind: 'choice', key: 'licence', label: 'Licence', allLabel: 'Any licence', primary: true, look: 'ladder', options: LADDER },
        openTo('staff'),
        WHERE,
    ],
    params: values => ({ profession: values.job, licence: values.licence?.[0], club: values.club?.[0] }),
    // A parent looks for private training; a club looking for staff, for people open to work.
    defaults: ({ role }): Record<string, string[]> => role === 'goalkeeper-coach' ? { job: ['Goalkeeper coach'] } : role === 'parent' || role === 'player' ? { open: ['SERVICES'] }
        : role === 'academy-director' || role === 'club-admin' ? { open: ['WORK'] } : {},
    empty: { title: 'No coaches or club staff listed yet', body: 'People appear here when they publish a football profile.' },
});

/** Specialists you hire: by the service they offer, by whether they take clients. */
export const specialistSource = personView({
    id: 'specialists', label: 'Specialists', noun: ['specialist', 'specialists'], kind: 'specialist', roles: ['SPECIALIST'], icon: Stethoscope, subtitle: 'Physios, analysts and more',
    filters: [
        { kind: 'choice', key: 'service', label: 'Service', primary: true, multi: true, look: 'tiles', options: SERVICES.map(({ value, label, icon }) => ({ value, label, icon })) },
        openTo('specialist'),
        WHERE,
    ],
    params: values => ({ profession: values.service, club: values.club?.[0] }),
    // Parents see specialists at clubs until people offering services to children can be checked.
    defaults: ({ role }): Record<string, string[]> => role === 'fitness-coach' ? { service: ['Physiotherapist', 'Strength & conditioning coach', 'Sports nutritionist'] } : role === 'parent' ? { club: ['any'] } : {},
    empty: { title: 'No specialists listed yet', body: 'Physios, analysts and other specialists appear here when they publish a profile.' },
});

/** Adult players you scout: by position on a pitch, looking for a club or a coach, by age. Nobody under 18 is listed. */
export const playerSource = personView({
    id: 'players', label: 'Players', noun: ['player', 'players'], kind: 'player', roles: ['PLAYER'], icon: Shirt, subtitle: 'Adult players',
    filters: [
        { kind: 'choice', key: 'position', label: 'Position', primary: true, multi: true, look: 'pitch',
            options: [{ value: 'GK', label: 'Goalkeepers' }, { value: 'DEF', label: 'Defenders' }, { value: 'MID', label: 'Midfielders' }, { value: 'FWD', label: 'Forwards' }] },
        openTo('player'),
        { kind: 'choice', key: 'age', label: 'Age', primary: true, multi: true, options: [{ value: '18-21', label: '18–21' }, { value: '22-29', label: '22–29' }, { value: '30+', label: '30 and over' }] },
    ],
    params: values => ({ position: values.position, age: values.age }),
    // Coaching staff and analysts scouting, and agents, start with players looking for a club.
    defaults: ({ role }): Record<string, string[]> => role === 'analyst' || role === 'agent' ? { open: ['CLUB'] } : {},
    empty: { title: 'No players listed yet', body: 'Adult players appear here when they publish a football profile.' },
});
