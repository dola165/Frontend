import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMatchCards, useWantToJoin } from './useSquadCards';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));

afterEach(() => { vi.clearAllMocks(); });

const failure = (status: number) => ({ isAxiosError: true, response: { status } });
const request = (id: number, answered: string | null = null) => ({ id, version: 1, source: 'LINK', playerId: id, childName: `Child ${id}`, birthYear: 2014, guardianName: null, message: null,
    createdAt: `2026-10-2${id}T09:00:00Z`, caseId: null, destination: '/my-squads', groups: [], setup: { canConfigure: false, destination: null }, answeredBy: answered, answeredAt: answered ? '2026-10-29T08:00:00Z' : null });

it('keeps Want to join while a change reloads it, and lists a request answered first by someone else', async () => {
    let answer = (url: string) => Promise.resolve({ data: url.includes('join-requests') ? [request(1)] : [] });
    api.get.mockImplementation((url: string) => answer(url));
    const { result, rerender } = renderHook(({ revision }) => useWantToJoin(7, [105], true, revision), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(api.get).toHaveBeenCalledWith('/squad-communication/105/join-requests', expect.objectContaining({ params: { answered: true } }));
    const waiting: (() => void)[] = [];
    answer = url => new Promise(resolve => { waiting.push(() => resolve({ data: url.includes('join-requests') ? [request(1, 'Koba Gelashvili')] : [] })); });
    rerender({ revision: 1 });
    expect(result.current.items).toHaveLength(1);
    await waitFor(() => expect(waiting).toHaveLength(2));
    waiting.forEach(release => release());
    await waitFor(() => expect(result.current.items?.[0]).toMatchObject({ state: 'ANSWERED', answeredBy: 'Koba Gelashvili' }));
});

it('takes a refusal as "not yours" and any other failure as one to show', async () => {
    api.get.mockImplementation((url: string) => Promise.reject(failure(url.includes('join-requests') ? 403 : 500)));
    const { result } = renderHook(() => useWantToJoin(7, [105], true, 0));
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.failed).toBe(true);
});

it('reports a next match card that failed to load, and keeps the cards while they reload', async () => {
    api.get.mockImplementation((url: string) => url.includes('/105/') ? Promise.reject(failure(502)) : url.includes('/103/') ? Promise.reject(failure(404))
        : Promise.resolve({ data: { squadId: 101, squadName: 'U12', match: null } }));
    const { result, rerender } = renderHook(({ revision }) => useMatchCards([101, 103, 105], revision), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.cards).not.toBeNull());
    expect(result.current.failed).toEqual([105]);
    expect(result.current.cards?.get(103)).toBeNull();
    api.get.mockImplementation(() => new Promise(() => undefined));
    rerender({ revision: 1 });
    expect(result.current.cards?.get(101)).toMatchObject({ squadName: 'U12' });
});
