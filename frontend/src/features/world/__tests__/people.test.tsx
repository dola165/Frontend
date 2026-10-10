import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { fetchPeople } from '../api';
import { peopleSource } from '../directories/peopleSource';
import type { DirectoryQuery, LoadContext } from '../directory/types';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));

const context: LoadContext = { signal: new AbortController().signal, sessionId: 'world', authenticated: true };
const query = (values: Record<string, string>, q = ''): DirectoryQuery => ({ q, sort: 'RELEVANCE', values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, [value]])) });
const missing = (status: number) => new AxiosError('missing', 'ERR', undefined, undefined, { status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: {} });
const user = (id: number, isMinor = false) => ({ id, fullName: `Person ${id}`, username: `p${id}`, avatarUrl: null, userType: 'COACH', position: 'Coach', isMinor });
const get = vi.mocked(apiClient.get);

/** The server without `GET /people`: `/people` fails with `status`, `/users/search` answers with `users`. */
function withoutDirectory(status: number, users = [user(1), user(2, true), user(3)], totalPages = 2) {
    get.mockImplementation(async (url: string) => {
        if (url === '/people') throw missing(status);
        return { data: { content: users, totalElements: 40, totalPages } };
    });
}

beforeEach(() => get.mockReset());

describe('people without the people directory', () => {
    it.each([404, 405, 501])('falls back to the name search when /people answers %s', async status => {
        withoutDirectory(status);
        const page = await fetchPeople({ q: 'ka', page: 0, size: 24 }, 'world');
        expect(page.searchOnly).toBe(true);
        expect(get).toHaveBeenLastCalledWith('/users/search', expect.objectContaining({ params: { query: 'ka', page: 0, size: 24 } }));
        // Minors are removed here, after paging, so the server's total would overcount: it is unknown.
        expect(page.items.map(person => person.id)).toEqual([1, 3]);
        expect(page.total).toBeNull();
        expect(page.hasMore).toBe(true);
    });

    it('does not fall back on other errors', async () => {
        get.mockRejectedValue(missing(500));
        await expect(fetchPeople({ q: 'ka' }, 'world')).rejects.toBeInstanceOf(AxiosError);
    });

    it('asks for a name rather than claiming nobody is listed', async () => {
        withoutDirectory(404);
        const page = await fetchPeople({ page: 0 }, 'world');
        expect(page).toMatchObject({ items: [], total: null, searchOnly: true });
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('reports the missing directory once, and explains a role filter instead of ignoring it', async () => {
        withoutDirectory(404);
        const onSearchOnly = vi.fn();
        const result = await peopleSource({ searchOnly: false, onSearchOnly }).load(query({ role: 'COACH' }, 'ka'), 0, context);
        expect(onSearchOnly).toHaveBeenCalledTimes(1);
        expect(result.items).toEqual([]);
        expect(result.notice).toMatch(/not available yet/);
    });

    it('in name-only mode, names filters a link carries and searches nobody until they are cleared', async () => {
        const source = peopleSource({ searchOnly: true });
        expect(source.filters.filter(filter => filter.kind === 'scope').map(filter => filter.key)).toEqual(['profession', 'city', 'verified']);
        expect(source.sortable?.(query({}))).toBe(false);
        const result = await source.load(query({ city: 'Batumi' }, 'ko'), 0, context);
        expect(result.notice).toMatch(/Clear the filters/);
        expect(get).not.toHaveBeenCalled();
        expect(source.empty.title).toBe('Search people by name');
    });

    it('still lists referees, which have their own directory', async () => {
        get.mockResolvedValue({ data: { items: [{ user_id: 8, full_name: 'Referee Eight' }], total: 1, pageSize: 20 } });
        const result = await peopleSource({ searchOnly: true }).load(query({ role: 'REFEREE' }), 0, context);
        expect(get).toHaveBeenCalledWith('/referees', expect.anything());
        expect(result.items).toHaveLength(1);
    });
});

it('uses the people directory and its total when the server has it', async () => {
    get.mockResolvedValue({ data: { items: [], total: 12, page: 0, size: 24, hasMore: false } });
    const result = await peopleSource({ searchOnly: false }).load(query({ role: 'COACH', city: 'Tbilisi' }), 0, context);
    expect(get).toHaveBeenCalledWith('/people', expect.objectContaining({ params: expect.objectContaining({ role: 'COACH', city: 'Tbilisi' }) }));
    expect(result.total).toBe(12);
});
