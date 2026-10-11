import { render, screen } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { fetchPeople } from '../api';
import { forget } from '../cache';
import { playerSource, specialistSource, staffSource } from '../directories/people/personSources';
import { refereeSource } from '../directories/people/refereeSource';
import { arrangeGroups } from '../directory/groups';
import { NO_PLACES, type Places } from '../directory/places';
import type { DirectoryQuery, LoadContext } from '../directory/types';
import { useDirectoryState } from '../directory/useDirectoryState';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));

const context: LoadContext = { signal: new AbortController().signal, sessionId: 'world', authenticated: true, area: { city: 'Tbilisi', centre: { lat: 41.7151, lng: 44.8271 } } };
const query = (values: Record<string, string | string[]>, q = '', sort = 'RELEVANCE'): DirectoryQuery =>
    ({ q, sort, values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? value : [value]])) });
const missing = (status: number) => new AxiosError('missing', 'ERR', undefined, undefined, { status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: {} });
const user = (id: number, userType = 'COACH', isMinor = false) => ({ id, fullName: `Person ${id}`, username: `p${id}`, avatarUrl: null, userType, position: null, isMinor });
const get = vi.mocked(apiClient.get);
/** What the people directory was asked, as the query string it received. */
const asked = () => String(get.mock.calls.find(([url]) => url === '/people')?.[1]?.params);

/** The server without `GET /people`: `/people` fails with `status`, `/users/search` answers with `users`. */
function withoutDirectory(status: number, users = [user(1), user(2, 'PLAYER', true), user(3, 'PARENT'), user(4, 'PLAYER')], totalPages = 2) {
    get.mockImplementation(async (url: string) => {
        if (url === '/people') throw missing(status);
        return { data: { content: users, totalElements: 40, totalPages } };
    });
}

beforeEach(() => { get.mockReset(); forget(''); });

describe('people without the people directory', () => {
    it.each([404, 405, 501])('falls back to the name search when /people answers %s, keeping football people only', async status => {
        withoutDirectory(status);
        const page = await fetchPeople({ q: 'ka', page: 0, size: 24 }, 'world');
        expect(page.searchOnly).toBe(true);
        expect(get).toHaveBeenLastCalledWith('/users/search', expect.objectContaining({ params: { query: 'ka', page: 0, size: 24 } }));
        // The minor and the parent are left out; nobody is called a player who is not one.
        expect(page.items.map(person => [person.id, person.role])).toEqual([[1, 'COACH'], [4, 'PLAYER']]);
        expect(page.total).toBeNull();
        expect(page.hasMore).toBe(true);
    });

    it('keeps the name search to the views asked for', async () => {
        withoutDirectory(404);
        const page = await fetchPeople({ q: 'ka', role: ['PLAYER'] }, 'world');
        expect(page.items.map(person => person.id)).toEqual([4]);
    });

    it('asks for a name rather than claiming nobody is listed', async () => {
        withoutDirectory(404);
        const page = await fetchPeople({ page: 0 }, 'world');
        expect(page).toMatchObject({ items: [], total: null, searchOnly: true });
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('reports the missing directory once, and explains a filter instead of ignoring it', async () => {
        withoutDirectory(404);
        const onSearchOnly = vi.fn();
        const result = await staffSource({ searchOnly: false, onSearchOnly }).load(query({ job: 'Head coach' }, 'ka'), 0, context);
        expect(onSearchOnly).toHaveBeenCalledTimes(1);
        expect(result.items).toEqual([]);
        expect(result.notice).toMatch(/not available yet/);
    });

    it('in name-only mode, names the filters a link carries and searches nobody until they are cleared', async () => {
        const source = playerSource({ searchOnly: true });
        expect(source.filters.every(filter => filter.kind === 'scope')).toBe(true);
        expect(source.sortable?.(query({}))).toBe(false);
        const result = await source.load(query({ position: 'GK' }, 'ko'), 0, context);
        expect(result.notice).toMatch(/Clear the filters/);
        expect(get).not.toHaveBeenCalled();
        expect(source.empty.title).toBe('Search people by name');
    });
});

describe('the four views', () => {
    it('sends each view and each repeated filter once per value, measured from the World area but never narrowed to it', async () => {
        get.mockResolvedValue({ data: { items: [], total: 0, page: 0, size: 24, hasMore: false } });
        await staffSource({ searchOnly: false }).load(query({ job: ['Head coach', 'Goalkeeper coach'], licence: 'B', club: 'none', open: ['WORK', 'SERVICES'] }), 0, context);
        expect(asked()).toBe('profession=Head+coach&profession=Goalkeeper+coach&licence=B&club=none&openTo=WORK&openTo=SERVICES&role=COACH&role=CLUB_STAFF&lat=41.7151&lng=44.8271&sort=RELEVANCE&page=0&size=24');
        get.mockClear();
        // Without another order asked for, the nearest come first.
        await playerSource({ searchOnly: false }).load(query({ position: ['GK', 'DEF'], open: 'CLUB', age: '30+' }, '', ''), 0, context);
        expect(asked()).toBe('position=GK&position=DEF&age=30%2B&openTo=CLUB&role=PLAYER&lat=41.7151&lng=44.8271&sort=NEAREST&page=0&size=24');
    });

    it('counts people at their club (its crest in a ring) and people without a club at their city, naming nobody', async () => {
        const people = [
            { id: 1, fullName: 'At Dinamo', username: 'a', avatarUrl: null, role: 'SPECIALIST', headline: null, profession: 'Physiotherapist', clubId: 1, clubName: 'Dinamo', clubLogoUrl: '/crest/1.svg', city: 'Tbilisi' },
            { id: 2, fullName: 'In Batumi', username: 'b', avatarUrl: null, role: 'SPECIALIST', headline: null, profession: 'Sports psychologist', clubId: null, clubName: null, city: 'Batumi' },
        ];
        get.mockImplementation(async (url: string) => url === '/people' ? { data: { items: people, total: 2, page: 0, size: 24, hasMore: false } }
            : { data: [{ latitude: 41.6168, longitude: 41.6367, name: 'Batumi', cityName: 'Batumi', type: 'CITY' }] });
        const source = specialistSource({ searchOnly: false });
        const { items } = await source.load(query({}), 0, context);
        const places: Places = { ...NO_PLACES, club: id => id === 1 ? { lat: 41.7, lng: 44.8, name: 'FC Dinamo Tbilisi Academy', city: 'Tbilisi', clubId: 1, logoUrl: '/crest/1.svg' } : undefined };
        expect(source.place!(items[0], places)).toMatchObject({ pin: 'club:1', approximate: 'club', label: 'FC Dinamo Tbilisi Academy', crest: '/crest/1.svg', action: 'Open club' });
        expect(source.place!(items[1], places)).toMatchObject({ pin: 'area:batumi', approximate: 'area', label: 'Batumi', lat: 41.6168 });
        expect(source.place!(items[1], places)).not.toHaveProperty('to');
        // People are one list, the nearest first: never grouped by city.
        expect(source.groups).toBeUndefined();
        expect(source.line({ ...items[1], openTo: ['SERVICES'], distanceKm: 280 })).toMatchObject({ action: 'Open profile', peek: 'person-2', fact: 'Takes clients', detail: 'Sports psychologist · Batumi · ≈280 km' });
    });
});

describe('referees', () => {
    const referee = (id: number, area: string, formats: string, extra = {}) => ({ user_id: id, full_name: `Referee ${id}`, published: true, biography: '', qualifications: 'GFF Regional referee · Category 1',
        formats, languages: 'Georgian', service_area: area, travel_km: 40, accepts_paid: true, accepts_volunteer: true, fee: 80, currency: 'GEL', timezone: 'Asia/Tbilisi', revision: 1, ...extra });
    const match = { event_id: 5823, squad_id: 103, squad_name: 'U14 Boys', format: '9_A_SIDE', starts_at_iso: '2026-10-17T08:00:00Z', ends_at_iso: '2026-10-17T09:20:00Z', timezone: 'Asia/Tbilisi',
        location_lat: 41.7631, location_lng: 44.7712, location_name: 'Dinamo Academy Training Centre', referee_responsibility: 'HOST', can_arrange_official: true };
    const centres: Record<string, [number, number]> = { Tbilisi: [41.7151, 44.8271], Rustavi: [41.5495, 45.0012], Kutaisi: [42.2679, 42.6946] };
    function server(referees: ReturnType<typeof referee>[], club: number[] = []) {
        get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
            if (url === '/referees') return { data: { items: referees, total: referees.length, pageSize: 24, params: config?.params } };
            if (url.startsWith('/referees/club-squad/')) return { data: referees.filter(item => club.includes(item.user_id)) };
            if (url === '/match-exchange/5823') return { data: match };
            const city = new URLSearchParams(url.split('?')[1]).get('q')!;
            return { data: centres[city] ? [{ latitude: centres[city][0], longitude: centres[city][1], name: city, cityName: city, type: 'CITY' }] : [] };
        });
    }

    it('counts referees at the first city they state, and draws the chosen one\'s stated area', async () => {
        server([referee(1, 'Tbilisi and Rustavi', '9_A_SIDE'), referee(2, 'Gori', '9_A_SIDE')]);
        const { items } = await refereeSource.load(query({}), 0, context);
        expect(refereeSource.place!(items[0], NO_PLACES)).toMatchObject({ pin: 'area:tbilisi', approximate: 'area', lat: 41.7151 });
        // A city the map does not know is not guessed.
        expect(refereeSource.place!(items[1], NO_PLACES)).toBeNull();
        expect(refereeSource.reach!(items[0])).toMatchObject({ lat: 41.7151, lng: 44.8271, km: 40 });
    });

    it('without a match, lists everyone as one list, the nearest to the World area first', async () => {
        server([referee(1, 'Kutaisi', '9_A_SIDE'), referee(2, 'Tbilisi', '9_A_SIDE'), referee(3, 'Rustavi', '7_A_SIDE')]);
        const { items } = await refereeSource.load(query({}, '', ''), 0, context);
        expect(items.map(item => item.referee.user_id)).toEqual([2, 3, 1]);
        expect(new Set(items.map(item => refereeSource.groups!.of(item, query({})).key))).toEqual(new Set(['all']));
        expect(refereeSource.line(items[2])).toMatchObject({ detail: '9v9 · Kutaisi · ≈187 km' });
    });

    it('with a match chosen, asks for its format, sits referees on a bench and asks who is free only when told', async () => {
        server([referee(1, 'Kutaisi', '9_A_SIDE'), referee(2, 'Rustavi', '9_A_SIDE'), referee(3, 'Tbilisi', '9_A_SIDE, 7_A_SIDE')], [3]);
        const { items } = await refereeSource.load(query({ match: '5823' }), 0, context);
        expect(get).toHaveBeenCalledWith('/referees', expect.objectContaining({ params: expect.objectContaining({ format: '9_A_SIDE', from: undefined, to: undefined }) }));
        const bench = Object.fromEntries(items.map(item => [item.referee.user_id, item.bench]));
        expect(bench).toEqual({ 1: 'far', 2: 'reach', 3: 'club' });
        expect(refereeSource.groups!.of(items.find(item => item.referee.user_id === 3)!, query({ match: '5823' }))).toMatchObject({ key: 'club', rank: 0 });
        await refereeSource.load(query({ match: '5823', free: 'true' }), 0, context);
        expect(get).toHaveBeenLastCalledWith('/referees', expect.objectContaining({ params: expect.objectContaining({ from: match.starts_at_iso, to: match.ends_at_iso }) }));
    });
});

describe('groups', () => {
    it('puts ranked groups first, then bigger ones, keeps the list order inside, and gathers single results at the end', () => {
        const items = ['a1', 'b1', 'a2', 'c1', 'd1', 'z1'];
        const of = (item: string) => item === 'z1' ? { key: 'z', label: 'Yours', rank: 0 } : { key: item[0], label: item[0].toUpperCase() };
        expect(arrangeGroups(items, of, 'Others').map(({ group, items: grouped }) => [group.label, grouped])).toEqual([['Yours', ['z1']], ['A', ['a1', 'a2']], ['Others', ['b1', 'c1', 'd1']]]);
    });
});

function Opened() {
    const state = useDirectoryState([refereeSource, specialistSource({ searchOnly: false }), staffSource({ searchOnly: false }), playerSource({ searchOnly: false })],
        { tabAlias: 'role', tabValues: { REFEREE: 'referees', SPECIALIST: 'specialists', COACH: 'staff', CLUB_STAFF: 'staff', PLAYER: 'players' }, opening: 'staff' });
    return <p>{state.source.id}</p>;
}

it.each([['/world/people?role=REFEREE', 'referees'], ['/world/people?role=CLUB_STAFF', 'staff'], ['/world/people?tab=players', 'players'], ['/world/people', 'staff']])(
    '%s opens the %s view', (path, view) => {
        render(<MemoryRouter initialEntries={[path]}><Opened /></MemoryRouter>);
        expect(screen.getByText(view)).toBeInTheDocument();
    });
