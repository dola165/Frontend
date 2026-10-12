import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { searchOpportunities } from '../../admissions/api';
import type { Participant } from '../../admissions/types';
import { apiClient } from '../../../api/axiosConfig';
import { eventSearch } from '../../requests/api';
import { allTournaments, cardParams } from '../directories/tournaments/allSource';
import { myTournaments } from '../directories/tournaments/mineSource';
import { season } from '../directories/tournaments/seasonSource';
import { groupsSource, jobs, trials } from '../directories/opportunitySources';
import { fixtures } from '../directories/matches/fixturesSource';
import { exchange } from '../directories/matches/exchangeSource';
import { arrangements, events } from '../directories/matches/otherSources';
import { clubsSource } from '../directories/clubSources';
import { playerSource, specialistSource, staffSource } from '../directories/people/personSources';
import { refereeSource } from '../directories/people/refereeSource';
import { FIELDS } from '../front/fields';
import { ROLES, aRole, defaultRole, offeredFor, roleLayout } from '../front/roles';
import { FIELD_VIEWS } from '../front/fieldViews';
import { LegacyMatchesRedirect, TournamentSetupRedirect, TournamentsRedirect, WorldRedirect } from '../WorldRedirect';
import { CARRIED, readQuery, useDirectoryState } from '../directory/useDirectoryState';
import type { AnySource, DirectoryQuery, LoadContext } from '../directory/types';

vi.mock('../../admissions/api', () => ({ searchOpportunities: vi.fn(), fetchAdmissionHome: vi.fn() }));
vi.mock('../../requests/api', () => ({ eventSearch: vi.fn(), eventDestination: () => null }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'world', user: { id: 1, navigationCapabilities: undefined } }) }));

const context: LoadContext = { signal: new AbortController().signal, sessionId: 'world', authenticated: true };
const query = (values: Record<string, string>, q = ''): DirectoryQuery => ({ q, sort: '', values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, [value]])) });
const child: Participant = { id: 101, name: 'Nino', dateOfBirth: '2018-04-02', minor: true, guardian: true, provenance: null, gender: 'FEMALE' };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchOpportunities).mockResolvedValue({ items: [], total: 0, page: 0, size: 20, hasMore: false } as never);
    vi.mocked(eventSearch).mockResolvedValue({ items: [], total: 41, hasMore: true });
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [], totalElements: 0, totalPages: 0 } });
});

it('searches training groups for the chosen child by birth year and category, keeping waiting lists optional', async () => {
    const source = groupsSource([child]);
    expect(source.filters.find(filter => filter.key === 'player')).toBeTruthy();
    await source.load(query({ player: '101', includeWaitlist: 'true', club: '4' }), 0, context);
    expect(searchOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({ birthYear: 2018, gender: 'FEMALE', acceptingOnly: true, includeWaitlist: true, clubId: 4, page: 0 }), context.signal);
});

it('lets a person pick the club for places to train once the clubs are known, and keeps a linked club otherwise', () => {
    const club = (clubs?: { value: string; label: string }[]) => groupsSource([child], undefined, clubs).filters.find(filter => filter.key === 'club');
    expect(club()?.kind).toBe('scope');
    expect(club([{ value: '4', label: 'Saburtalo Youth' }])).toMatchObject({ kind: 'choice', options: [{ value: '4', label: 'Saburtalo Youth' }] });
});

it('offers no child choice to someone searching only for themselves', () => {
    expect(groupsSource([{ ...child, minor: false, guardian: false }]).filters.some(filter => filter.key === 'player')).toBe(false);
});

it('asks the server for the requested page of events rather than filtering the first', async () => {
    const page = await events.load(query({ activity: 'TRYOUT', location: 'Tbilisi' }, 'დინამო'), 1, context);
    expect(eventSearch).toHaveBeenCalledWith(expect.objectContaining({ q: 'დინამო', activity: 'TRYOUT', location: 'Tbilisi', page: 1, size: 20 }), 'world', context.signal);
    expect(page).toEqual({ items: [], total: 41, hasMore: true });
});

/** The outgoing tournament search for a URL, through the same query reading the directory uses. */
const competitionParams = async (search: string) => Object.fromEntries(cardParams(readQuery(allTournaments, new URLSearchParams(search)).query, undefined));

it('sends a fee currency only with a fee to compare', async () => {
    expect(await competitionParams('')).toEqual({});
    expect(await competitionParams('currency=USD&feeBasis=TEAM')).toEqual({});
    expect(await competitionParams('maxFee=50')).toEqual({ maxFee: '50', currency: 'GEL' });
    expect(await competitionParams('minFee=10&currency=EUR&feeBasis=PLAYER')).toMatchObject({ minFee: '10', currency: 'EUR', feeBasis: 'PLAYER' });
});

it('says what is wrong with a fee range the server would refuse, without asking it', async () => {
    const notice = async (search: string) => {
        vi.mocked(apiClient.get).mockClear();
        const page = await allTournaments.load(readQuery(allTournaments, new URLSearchParams(search)).query, 0, context);
        expect(apiClient.get).not.toHaveBeenCalled();
        return page.notice;
    };
    expect(await notice('minFee=12.5')).toBe('Enter fees as whole numbers, for example 50.');
    expect(await notice('maxFee=2000000')).toBe('Enter a fee up to 1,000,000.');
    expect(await notice('minFee=100&maxFee=50')).toBe('The lowest fee is above the highest. Change one of them to search.');
    expect(await competitionParams('minFee=50&maxFee=50')).toMatchObject({ minFee: '50', maxFee: '50' });
});

it('sends a tournament organiser, eligibility and a distance search as the server names them', async () => {
    expect(await competitionParams('host=CLUB:4&eligibilityCategory=Girls&around=41.7,44.8')).toMatchObject({ hostKind: 'CLUB', hostId: '4', eligibilityCategory: 'Girls', latitude: '41.7', longitude: '44.8', radiusKm: '25' });
    expect(await competitionParams('host=CLUB:abc')).not.toHaveProperty('hostKind');
    // The format tiles: a league is a family, a knockout cup one structure; the World area is the distance search.
    expect(await competitionParams('format=LEAGUE')).toEqual({ family: 'LEAGUE' });
    expect(await competitionParams('format=KNOCKOUT')).toEqual({ structure: 'KNOCKOUT' });
    expect(cardParams(readQuery(allTournaments, new URLSearchParams('')).query, { city: 'Tbilisi', centre: { lat: 41.7, lng: 44.8 } }).get('radiusKm')).toBe('40');
});

it('lists tournaments not yet over first, then the finished ones, as one list', async () => {
    const answer = (url: string) => {
        const params = new URLSearchParams(url.split('?')[1]);
        const card = (id: number, endDate: string) => ({ id, name: `T${id}`, status: params.get('status') ?? 'ACTIVE', participantScope: 'CLUB', startDate: '2026-09-01', endDate, entryCount: 4, entryCap: 8, profile: { rules: null, revision: 0, legacy: true } });
        const finished = params.get('status') === 'COMPLETED';
        const totalElements = finished ? (params.has('from') ? 1 : 3) : 13;
        const content = params.get('size') === '1' ? [] : finished ? [card(90, '2999-01-01'), card(91, '2026-01-01'), card(92, '2026-02-01')] : Array.from({ length: params.get('page') === '1' ? 1 : 12 }, (_, i) => card(i + 1, '2999-01-01'));
        return Promise.resolve({ data: { content, totalElements, totalPages: Math.ceil(totalElements / 12) } });
    };
    vi.mocked(apiClient.get).mockImplementation(answer as unknown as typeof apiClient.get);
    const all = readQuery(allTournaments, new URLSearchParams('')).query;
    const first = await allTournaments.load(all, 0, context), second = await allTournaments.load(all, 1, context), third = await allTournaments.load(all, 2, context);
    expect([first.items.length, first.total, first.hasMore]).toEqual([12, 15, true]);
    expect([second.items.length, second.hasMore]).toEqual([1, true]);
    // The finished tournament still ending in the future was listed with the live ones.
    expect(third.items.map(item => item.id)).toEqual([91, 92]);
    expect(third.hasMore).toBe(false);
});

function Opened({ sources, alias }: { sources: AnySource[]; alias?: string }) {
    const state = useDirectoryState(sources, { tabAlias: alias });
    return <p>{state.source.id}:{JSON.stringify(Object.fromEntries(Object.entries(state.query.values).filter(([, values]) => values.length)))}</p>;
}
const DIRECTORIES: Record<string, { sources: AnySource[]; alias?: string }> = {
    '/world/clubs': { sources: [clubsSource({ child })] },
    '/world/people': { sources: [refereeSource, specialistSource({ searchOnly: false }), staffSource({ searchOnly: false }), playerSource({ searchOnly: false })] },
    '/world/matches': { sources: [fixtures, exchange, arrangements, events] },
    '/world/opportunities': { sources: [jobs, trials, groupsSource([child])], alias: 'type' },
    '/world/venues': { sources: [] },
    '/world/tournaments': { sources: [season, allTournaments, myTournaments] },
};
// The directory links the front page's fields end with ("All …"), each with its tab and filters chosen.
const FIELD_LINKS = ['/world/matches?tab=exchange', '/world/matches?tab=mine', '/world/matches?period=HISTORY', '/world/tournaments?tab=all&registration=OPEN', '/world/tournaments?tab=all&status=ACTIVE',
    '/world/people?tab=specialists', '/world/clubs?type=ACADEMY&near=Tbilisi', '/world/clubs?open=true&near=Tbilisi',
    '/world/opportunities?tab=groups&player=101', '/world/opportunities?tab=trials', '/world/opportunities?tab=jobs&category=COACHING', '/world/opportunities?tab=jobs&engagement=VOLUNTEER',
    '/world/matches?tab=fixtures&period=UPCOMING&mine=true&squadId=103', '/world/matches?tab=fixtures&period=HISTORY', '/world/matches?tab=exchange&ageGroup=U14', '/world/people?tab=referees'];

it.each(FIELD_LINKS)('the field link %s opens its intended tab and filters', to => {
    const url = new URL(to, 'http://world');
    const directory = DIRECTORIES[url.pathname];
    render(<MemoryRouter initialEntries={[to]}><Opened sources={directory.sources} alias={directory.alias} /></MemoryRouter>);
    const [tab, values] = screen.getByText(/:/).textContent!.split(/:(.*)/s);
    const wanted = url.searchParams.get('tab') ?? directory.sources[0].id;
    expect(tab).toBe(wanted);
    // Every filter in the link is one the opened tab applies.
    const applied = JSON.parse(values) as Record<string, string[]>;
    for (const [key, value] of url.searchParams) if (key !== 'tab' && !CARRIED.includes(key)) expect(applied[key]).toContain(value);
});

it('gives every role its own page: a list beside the map, a handful below, all of them among its offered fields', () => {
    const lists = new Set(FIELDS.filter(field => field.shape === 'list').map(field => field.id));
    for (const role of ROLES) {
        const layout = roleLayout(role.id);
        expect(lists.has(layout.side)).toBe(true);
        expect(layout.fields.length).toBeGreaterThanOrEqual(4);
        expect(layout.fields.length).toBeLessThanOrEqual(6);
        expect(layout.fields).not.toContain(layout.side);
        expect(offeredFor(role.id)).toEqual(expect.arrayContaining([layout.side, ...layout.fields]));
    }
});

it('has a view for every field, and ends every coaching page with the labelled club rail', () => {
    for (const field of FIELDS) expect(FIELD_VIEWS[field.id]).toBeDefined();
    for (const role of ROLES.filter(item => item.group === 'Coaching staff')) expect(roleLayout(role.id).fields.at(-1)).toBe('fromClubs');
    expect(aRole('academy-director')).toBe('an academy director');
    expect(aRole('head-coach')).toBe('a head coach');
});

it('starts a coach, a parent with a chosen child and a club player on their own pages until they choose', () => {
    expect(defaultRole('coach')).toBe('head-coach');
    expect(defaultRole('parent')).toBe('parent');
    expect(defaultRole('member', 'PLAYER')).toBe('player');
    expect(defaultRole('member')).toBe('fan');
});

function Where() {
    const location = useLocation();
    return <p>{location.pathname}{location.search}{location.hash}</p>;
}
const visit = (path: string, element: ReactNode) => render(
    <MemoryRouter initialEntries={[path]}><Routes><Route path={path.split('?')[0]} element={element} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>,
);

it.each([
    ['/matches', 'hub', '/world/matches'],
    ['/matches?section=find&tab=mine', 'hub', '/world/matches?tab=mine'],
    ['/matches?section=fixtures', 'hub', '/world/matches?period=HISTORY'],
    ['/match-exchange?format=SEVEN_A_SIDE', 'exchange', '/world/matches?format=SEVEN_A_SIDE&tab=exchange'],
    ['/match-exchange?lat=41.7&lng=44.8&radiusKm=50', 'exchange', '/world/matches?tab=exchange&around=41.7%2C44.8'],
    ['/match-exchange?tab=referees&q=gff', 'exchange', '/world/people?q=gff&tab=referees'],
    ['/match-history?clubId=1', 'history', '/world/matches?clubId=1&period=HISTORY'],
    ['/matches?section=competitions&view=hosts&kind=CLUB&host=4', 'hub', '/world/tournaments?host=CLUB%3A4&tab=all'],
    ['/matches?section=competitions&host=CLUB:3', 'hub', '/world/tournaments?host=CLUB%3A3&tab=all'],
    ['/tournaments?hostKind=CLUB&hostId=4', 'competitions', '/world/tournaments?host=CLUB%3A4&tab=all'],
    ['/tournaments?latitude=41.7&longitude=44.8&radiusKm=25', 'competitions', '/world/tournaments?around=41.7%2C44.8&tab=all'],
    ['/tournaments?view=invitations', 'competitions', '/world/tournaments?tab=mine'],
    ['/tournaments', 'competitions', '/world/tournaments'],
] as const)('sends %s to its World page', (path, kind, expected) => {
    visit(path, <LegacyMatchesRedirect kind={kind} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
});

it.each([
    ['/world/competitions', '/world/tournaments'],
    ['/world/competitions?tab=invitations', '/world/tournaments?tab=mine'],
    ['/world/competitions?tab=hosts&following=true', '/world/tournaments'],
    ['/world/competitions?registration=OPEN&near=Tbilisi', '/world/tournaments?registration=OPEN&near=Tbilisi&tab=all'],
    ['/world/competitions?tab=mine', '/world/tournaments?tab=mine'],
] as const)('sends the renamed %s to Tournaments, on the list its keys belong to', (path, expected) => {
    visit(path, <TournamentsRedirect />);
    expect(screen.getByText(expected)).toBeInTheDocument();
});

it.each([
    ['/tournaments/setup', '/world/tournaments?peek=draw-new'],
    ['/tournaments/setup?organizer=901&family=LEAGUE', '/world/tournaments?peek=draw-o901.fLEAGUE'],
    ['/tournaments/setup?organizer=abc&family=TRAMPOLINE', '/world/tournaments?peek=draw-new'],
] as const)('opens the old setup page %s as the Draw room in World', (path, expected) => {
    visit(path, <TournamentSetupRedirect />);
    expect(screen.getByText(expected)).toBeInTheDocument();
});

it('renames old club directory keys and keeps the rest of the search', () => {
    visit('/clubs?search=dinamo&type=ACADEMY', <WorldRedirect to="/world/clubs" rename={{ search: 'q' }} />);
    expect(screen.getByText('/world/clubs?type=ACADEMY&q=dinamo')).toBeInTheDocument();
});

it('opens the role an old jobs link selected, and the jobs tab otherwise', () => {
    const jobsRedirect = <WorldRedirect to="/world/opportunities" rename={{ search: 'q' }} set={{ tab: 'jobs' }} detail={{ key: 'job', path: '/jobs' }} />;
    visit('/jobs?job=5', jobsRedirect);
    expect(screen.getByText('/jobs/5')).toBeInTheDocument();
    visit('/roles?search=coach', jobsRedirect);
    expect(screen.getByText('/world/opportunities?q=coach&tab=jobs')).toBeInTheDocument();
});

