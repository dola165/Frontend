import { useEffect, useMemo, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { fetchNotifications } from '../../../api/notifications';
import { buildNotificationDestination } from '../../../utils/notifications';
import { safeNotificationLink } from '../../../utils/notificationDestinations';
import type { NotificationItem } from '../../../types/notifications';
import type { Participant } from '../../admissions/types';
import { rememberSelectedPlayer } from '../../parents/playerSelection';
import type { MySquad } from '../front/coach/mySquads';
import { squadsFrom } from '../front/coach/mySquads';
import { clubsSource, clubSearchParams } from '../directories/clubSources';
import { groupsSource, trials } from '../directories/opportunitySources';
import { fixtures } from '../directories/matches/fixturesSource';
import { windowFilters } from '../directories/matches/matchday';
import { allTournaments, cardParams } from '../directories/tournaments/allSource';
import { groupSearch, publicParams, trialSearch } from '../directories/opportunitySearch';
import { effectiveDirectoryQuery, readQuery, useDirectoryState } from '../directory/useDirectoryState';
import { useDirectoryData } from '../directory/useDirectoryData';
import { useWorldChild } from '../players';
import { WatchReturn } from '../watches/WatchReturn';
import { WatchSearch } from '../watches/WatchSearch';
import { searchReturnPath } from '../watches/returnPath';
import { searchSpec, type SearchSpec, type SearchWatch } from '../watches/api';
import type { AnySource } from '../directory/types';

const state = vi.hoisted(() => ({ session: 'fix-one', participants: [] as Participant[] | undefined, squads: [] as MySquad[],
    watch: null as SearchWatch | null, denied: false }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: state.session, user: { id: 4, dob: '1988-01-01' } }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../worldSession', () => ({ useWorldSession: () => ({ participants: state.participants, membership: null }) }));
vi.mock('../front/useWorldRole', () => ({ useWorldRole: () => 'parent' }));
vi.mock('../front/coach/mySquads', async original => ({ ...await original<typeof import('../front/coach/mySquads')>(),
    useSquadFocus: () => ({ status: 'ready', squads: state.squads, focus: state.squads }) }));
vi.mock('../useWorldArea', () => ({ useWorldArea: () => ({ area: { city: 'Batumi', centre: { lat: 41.6, lng: 41.6 }, ready: true, anywhere: false, country: 'GE' } }) }));

const child: Participant = { id: 9, name: 'Synthetic Child', dateOfBirth: '2018-12-30', gender: 'FEMALE', minor: true, guardian: true, provenance: null };
const area = { city: 'Batumi', anywhere: false, centre: { lat: 41.6, lng: 41.6 } };
const context = { area, country: 'GE', authenticated: true, sessionId: 'fix-one', signal: new AbortController().signal };
const notice: NotificationItem = { id: 101, type: 'WORLD_SEARCH_RESULTS', entityType: 'world_search_window', entityId: 21,
    title: 'New World results', body: 'New public results match a search you follow.', scope: 'PERSONAL', createdAt: '2026-10-30T10:00:00Z', isRead: false, linkPath: '/world/clubs?watch=7' };

beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); state.session = 'fix-one'; state.participants = [child]; state.squads = []; state.watch = null; state.denied = false;
    vi.mocked(apiClient.get).mockImplementation(async url => {
        const path = String(url);
        if (path === '/notifications') return { data: { content: [notice], pageNumber: 0, pageSize: 20, totalElements: 1 } };
        if (path === '/world/search-watches/7') {
            if (state.denied) throw new Error('This search is no longer available.');
            return { data: state.watch };
        }
        if (path === '/world/search-watches') return { data: state.watch?.active ? [state.watch] : [] };
        if (path === '/match-exchange/squads' || path === '/squad-communication') return { data: [] };
        return { data: { content: [], totalElements: 0, totalPages: 0, items: [], total: 0, hasMore: false, pageSize: 24 } };
    });
    vi.mocked(apiClient.post).mockImplementation(async (_url, input) => {
        state.watch = { ...input as Omit<SearchWatch, 'id' | 'active'>, id: 7, active: true };
        return { data: state.watch };
    });
});

function Directory({ kind = 'clubs' }: { kind?: 'clubs' | 'groups' | 'fixtures' }) {
    const { child: resolved } = useWorldChild();
    const source = useMemo(() => kind === 'groups' ? groupsSource(state.participants ?? [], resolved)
        : kind === 'fixtures' ? fixtures : clubsSource({ child: resolved, centre: area.centre }), [kind, resolved]);
    return <DirectoryState source={source} />;
}
function DirectoryState({ source }: { source: AnySource }) {
    const location = useLocation();
    const state = useDirectoryState([source]);
    const data = useDirectoryData(source, state.query, false);
    return <><code data-testid="path">{location.pathname}{location.search}</code><code data-testid="query">{JSON.stringify(state.query)}</code>
        <h2>{source.heading?.(state.query) ?? source.label}</h2><code data-testid="watch">{JSON.stringify(data.watch)}</code>
        {data.error && <p role="alert">{data.error}</p>}{data.notice && <p role="status">{data.notice}</p>}<WatchSearch spec={data.watch} childId={data.childId} contextChildId={data.contextChildId}/></>;
}
function Inbox() {
    const [items, setItems] = useState<NotificationItem[]>([]);
    useEffect(() => { void fetchNotifications({}, { _authSessionId: state.session }).then(page => setItems(page.content)); }, []);
    return <>{items.map(item => <Link key={item.id} to={buildNotificationDestination(item)}>Open result notice</Link>)}</>;
}
function ReturnDirectory() {
    const location = useLocation();
    return new URLSearchParams(location.search).has('watch') ? <WatchReturn/> : <Directory/>;
}
const clubCalls = () => vi.mocked(apiClient.get).mock.calls.map(call => String(call[0])).filter(url => url.startsWith('/clubs?'));

it('W1 reads the notification API then maps and resolves its opaque link to the saved effective public query', async () => {
    rememberSelectedPlayer(4, state.session, 9);
    const first = render(<MemoryRouter initialEntries={['/world/clubs?near=Batumi&country=GE']}><Directory/></MemoryRouter>);
    // A parent's club search for their child follows itself: no button, one quiet line with Stop.
    expect(await screen.findByText('We’ll tell you about new places for Synthetic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow this search' })).not.toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const saved = new URL(state.watch!.returnPath, 'https://test.invalid').searchParams;
    expect(saved.get('player')).toBe('9'); expect(saved.get('birthYear')).toBe('2018'); expect(saved.get('country')).toBe('GE');
    first.unmount(); vi.mocked(apiClient.get).mockClear(); state.session = 'fix-two';
    rememberSelectedPlayer(4, state.session, 10);
    state.participants = [child, { ...child, id: 10, dateOfBirth: '2012-01-01' }];
    render(<MemoryRouter initialEntries={['/inbox']}><Routes><Route path="/inbox" element={<Inbox/>}/><Route path="/world/clubs" element={<ReturnDirectory/>}/></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('link', { name: 'Open result notice' }));
    await waitFor(() => expect(clubCalls()).toHaveLength(1));
    const params = new URL(clubCalls()[0], 'https://test.invalid').searchParams;
    expect(params.get('birthYear')).toBe('2018'); expect(params.get('city')).toBe('Batumi'); expect(params.get('country')).toBe('GE');
    expect(params.toString()).not.toMatch(/player|child|guardian|Synthetic|2018-12/);
    expect(screen.getByTestId('path')).toHaveTextContent('player=9');
    expect(apiClient.get).toHaveBeenCalledWith('/world/search-watches/7', expect.objectContaining({ _authSessionId: 'fix-two' }));
});

it('W1 accepts only the exact positive safe watch route with matching notice type and entity', () => {
    expect(buildNotificationDestination(notice)).toBe('/world/clubs?watch=7');
    for (const linkPath of ['/world/clubs?watch=0', '/world/clubs?watch=01', '/world/clubs?watch=-1', '/world/clubs?watch=9007199254740992',
        '/world/clubs?watch=7&player=9', '/world/clubs?watch=7&city=Batumi', '/world/clubs?watch=7&watch=8', '/world/clubs?watch=7#x', '/world/search-watches/7', '/world/clubs?watch=%37', '/world/clubs?watch=7\n', '/world/clubs?watch=7\r']) {
        expect(safeNotificationLink(linkPath)).toBeNull();
        expect(buildNotificationDestination({ ...notice, linkPath })).toBe('/requests?view=updates&itemId=101');
    }
    for (const change of [{ type: 'NEW_MESSAGE' }, { entityType: 'club' }, { entityId: 0 }, { entityId: 9007199254740992 }])
        expect(buildNotificationDestination({ ...notice, ...change })).toBe('/requests?view=updates&itemId=101');
});

it('W2 opens followed-search management through ownership resolution and stops on an unavailable saved watch', async () => {
    state.denied = true;
    render(<MemoryRouter initialEntries={['/world/clubs?watch=7']}><WatchReturn/></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('This search is no longer available.');
    expect(clubCalls()).toHaveLength(0);
});

it.each(['ageGroup=U16', 'age=15'])('W4 preserves hidden explicit club criteria through the URL reader, state and API: %s', async search => {
    rememberSelectedPlayer(4, state.session, 9);
    render(<MemoryRouter initialEntries={[`/world/clubs?${search}`]}><Directory/></MemoryRouter>);
    await waitFor(() => expect(clubCalls()).toHaveLength(1));
    const params = new URL(clubCalls()[0], 'https://test.invalid').searchParams;
    const [key, value] = search.split('='); expect(params.get(key)).toBe(value); expect(params.has('birthYear')).toBe(false);
});

it('W4 uses identical explicit fixture city/age criteria for opening-window and actual list API', async () => {
    rememberSelectedPlayer(4, state.session, 9);
    const params = new URLSearchParams('city=Rustavi&ageGroup=U16&period=UPCOMING&near=Batumi');
    const query = effectiveDirectoryQuery(fixtures, readQuery(fixtures, params).query, { birthYear: '2018' }, area);
    expect(windowFilters(query)).toContain('city=Rustavi'); expect(windowFilters(query)).toContain('ageGroup=U16'); expect(windowFilters(query)).not.toContain('birthYear');
    render(<MemoryRouter initialEntries={[`/world/matches?${params}`]}><Directory kind="fixtures"/></MemoryRouter>);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(expect.stringMatching(/\/match-history\?/), expect.anything()));
    const request = vi.mocked(apiClient.get).mock.calls.map(call => String(call[0])).find(url => url.startsWith('/match-history?'))!;
    const sent = new URL(request, 'https://test.invalid').searchParams;
    expect(sent.get('city')).toBe('Rustavi'); expect(sent.get('ageGroup')).toBe('U16'); expect(sent.has('birthYear')).toBe(false);
});

it('W4 retains a country-only tournament URL through requests and saved-watch return without the viewer radius', async () => {
    const viewerArea = { city: 'Tbilisi', centre: { lat: 41.7151, lng: 44.8271 } };
    const viewer = { ...context, area: viewerArea, country: 'GE' };
    const query = readQuery(allTournaments, new URLSearchParams('tab=all&countryCode=DE')).query;
    expect(Object.fromEntries(cardParams(query, viewerArea, 'GE'))).toEqual({ countryCode: 'DE' });
    await allTournaments.load(query, 0, viewer);
    const requests = vi.mocked(apiClient.get).mock.calls.map(call => String(call[0])).filter(url => url.startsWith('/competitions?'));
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
        const sent = new URL(request, 'https://test.invalid').searchParams;
        expect(sent.get('countryCode')).toBe('DE');
        for (const key of ['city', 'latitude', 'longitude', 'radiusKm']) expect(sent.has(key)).toBe(false);
    }
    const spec = allTournaments.watch!(query, viewer)!;
    expect(spec.filters).toEqual({ countryCode: ['DE'] });
    const path = searchReturnPath({ query: spec, returnPath: '/world/tournaments?tab=all&near=Tbilisi', childId: null })!;
    const restored = readQuery(allTournaments, new URL(path, 'https://test.invalid').searchParams).query;
    expect(searchSpec('TOURNAMENTS', cardParams(restored, viewerArea, 'GE'))).toEqual(spec);
    expect(Object.fromEntries(cardParams(query, { city: 'Tbilisi', centre: null }, 'GE'))).toEqual({ countryCode: 'DE' });
});

it('W4 keeps ordinary country-and-distance tournament defaults when the URL names no location', () => {
    const viewerArea = { city: 'Tbilisi', centre: { lat: 41.7151, lng: 44.8271 } };
    const query = readQuery(allTournaments, new URLSearchParams('tab=all')).query;
    const params = cardParams(query, viewerArea, 'GE');
    expect(Object.fromEntries(params)).toEqual({ countryCode: 'GE', latitude: '41.7151', longitude: '44.8271', radiusKm: '40' });
    const spec = allTournaments.watch!(query, { ...context, area: viewerArea, country: 'GE' })!;
    const path = searchReturnPath({ query: spec, returnPath: '/world/tournaments?tab=all&near=Tbilisi', childId: null })!;
    const restored = readQuery(allTournaments, new URL(path, 'https://test.invalid').searchParams).query;
    expect(searchSpec('TOURNAMENTS', cardParams(restored, viewerArea, 'FR'))).toEqual(spec);
    expect(Object.fromEntries(cardParams(query, { city: 'Tbilisi', centre: null }, 'GE'))).toEqual({ countryCode: 'GE', city: 'Tbilisi' });
});

it('W4 preserves an explicitly chosen tournament point alongside the explicit country', () => {
    const query = readQuery(allTournaments, new URLSearchParams('tab=all&countryCode=DE&around=52.5,13.4&radiusKm=10')).query;
    expect(Object.fromEntries(cardParams(query, { city: 'Tbilisi', centre: { lat: 41.7151, lng: 44.8271 } }, 'GE')))
        .toEqual({ countryCode: 'DE', latitude: '52.5', longitude: '13.4', radiusKm: '10' });
});

it('W5 withholds a selected child with unknown cohort, then accepts an explicit public choice', async () => {
    state.participants = [{ ...child, dateOfBirth: null }];
    const view = render(<MemoryRouter initialEntries={['/world/clubs?player=9']}><Directory/></MemoryRouter>);
    expect(await screen.findByRole('status')).toHaveTextContent('Choose Anyone or an explicit public birth year');
    expect(clubCalls()).toHaveLength(0); expect(screen.queryByRole('button', { name: 'Follow this search' })).not.toBeInTheDocument();
    view.unmount();
    render(<MemoryRouter initialEntries={['/world/clubs?player=anyone&birthYear=2018']}><Directory/></MemoryRouter>);
    await waitFor(() => expect(clubCalls()).toHaveLength(1)); expect(clubCalls()[0]).toContain('birthYear=2018');
});

it.each([null, undefined, '', 'unpublished', 'U99'])('W5 does not promote an unknown squad category to SENIOR: %s', async category => {
    state.squads = squadsFrom([{ id: 3, clubId: 71, name: 'Synthetic squad', category }], []);
    expect(state.squads[0].publishedAgeGroup).toBeUndefined();
    render(<MemoryRouter initialEntries={['/world/clubs?for=3&player=anyone']}><Directory/></MemoryRouter>);
    expect(await screen.findByRole('status')).toHaveTextContent('Choose Anyone or an explicit public birth year'); expect(clubCalls()).toHaveLength(0);
});

it('W5 allows an explicit public cohort after a selected squad has no known category', async () => {
    state.squads = squadsFrom([{ id: 3, clubId: 71, name: 'Synthetic squad', category: null }], []);
    render(<MemoryRouter initialEntries={['/world/clubs?for=3&player=anyone&birthYear=2018']}><Directory/></MemoryRouter>);
    await waitFor(() => expect(clubCalls()).toHaveLength(1));
    expect(clubCalls()[0]).toContain('birthYear=2018'); expect(clubCalls()[0]).not.toContain('SENIOR');
});

it('W2 retains a derived group country when the reopened Near and browser country differ', () => {
    const source = groupsSource([child], child);
    const original = effectiveDirectoryQuery(source, readQuery(source, new URLSearchParams()).query, { birthYear: '2018' }, area);
    const query = source.watch!(original, context)!;
    expect(query.filters.country).toEqual(['GE']);
    const path = searchReturnPath({ query, returnPath: '/world/opportunities?tab=groups&player=9&near=Batumi', childId: null })!;
    const reopened = readQuery(source, new URL(path, 'https://test.invalid').searchParams).query;
    const params = publicParams(groupSearch(reopened, child, { area: { city: 'Elsewhere', centre: null }, country: 'FR' }));
    expect(searchSpec('GROUPS', params)).toEqual(query);
});

it.each([['', true], ['&player=', false], ['&player=anyone', false]])('W6 resolves missing versus blank/Anyone only once for group headings, requests and watches: %s', async (player, narrowed) => {
    rememberSelectedPlayer(4, state.session, 9);
    render(<MemoryRouter initialEntries={[`/world/opportunities?tab=groups${player}`]}><Directory kind="groups"/></MemoryRouter>);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admissions/opportunities', expect.anything()));
    const config = vi.mocked(apiClient.get).mock.calls.find(call => call[0] === '/admissions/opportunities')![1]!;
    expect(config.params).toMatchObject({ birthYear: narrowed ? 2018 : undefined, gender: narrowed ? 'FEMALE' : undefined });
    expect(screen.getByRole('heading')).toHaveTextContent(narrowed ? 'Training groups for Synthetic' : 'Training groups');
    if (!narrowed) expect(screen.getByRole('heading')).not.toHaveTextContent('Synthetic');
    await waitFor(() => expect(screen.getByTestId('watch').textContent).toContain('GROUPS'));
    const spec = JSON.parse(screen.getByTestId('watch').textContent!);
    expect(spec.filters.birthYear).toEqual(narrowed ? ['2018'] : undefined);
    expect(screen.getByTestId('query').textContent).not.toContain('Synthetic Child');
});

it('W6 rejects an unavailable selected player instead of restoring memory or searching broadly', async () => {
    rememberSelectedPlayer(4, state.session, 9);
    render(<MemoryRouter initialEntries={['/world/opportunities?tab=groups&player=999']}><Directory kind="groups"/></MemoryRouter>);
    expect(await screen.findByRole('status')).toHaveTextContent('This search context is unavailable');
    expect(vi.mocked(apiClient.get).mock.calls.some(call => call[0] === '/admissions/opportunities')).toBe(false);
});

it('W2 canonical saved criteria round-trip through each actual source without later area or memory restrictions', () => {
    const cases: [SearchSpec, AnySource, (query: ReturnType<typeof readQuery>['query']) => URLSearchParams][] = [
        [searchSpec('CLUBS', new URLSearchParams('search=Club&type=GRASSROOTS&birthYear=2018&lat=41.70000&lng=44.80000&km=10&feeMax=120')), clubsSource(), query => clubSearchParams(query, { centre: area.centre, area })],
        [searchSpec('GROUPS', new URLSearchParams('acceptingOnly=false&includeWaitlist=true&birthYear=2018&country=GE&city=Rustavi&gender=FEMALE')), groupsSource([]), query => publicParams(groupSearch(query, undefined, { ...context, country: 'FR', area: { city: 'Elsewhere', centre: null } }))],
        [searchSpec('TRIALS', new URLSearchParams('q=Trial&status=CLOSED&location=Rustavi&birthYear=2018&countryCode=GE')), trials, query => publicParams(trialSearch(query, context))],
        [searchSpec('TOURNAMENTS', new URLSearchParams('q=Cup&ageGroup=U16&countryCode=GE&latitude=41.7&longitude=44.8&radiusKm=40')), allTournaments, query => cardParams(query, area, 'FR')],
    ];
    for (const [query, source, paramsOf] of cases) {
        const path = searchReturnPath({ query, returnPath: '/world/clubs?near=Batumi', childId: null })!;
        const params = new URL(path, 'https://test.invalid').searchParams;
        expect(params.get('player')).toBe('anyone');
        const effective = readQuery(source, params).query;
        // Shared context sees the explicit cohort in the URL, not a later remembered child's cohort.
        if (params.has('birthYear')) effective.values.birthYear = params.getAll('birthYear');
        expect(searchSpec(query.kind, paramsOf(effective))).toEqual(query);
    }
});
