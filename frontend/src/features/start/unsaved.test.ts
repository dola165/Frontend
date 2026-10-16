import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { followClub, unfollowClub } from './startApi';
import { FollowsFailed, followChanges, useUnsaved } from './unsaved';

vi.mock('./startApi', () => ({ followClub: vi.fn(), unfollowClub: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('follows each club on its own and, trying again, sends only the follow that failed', async () => {
    const held = new Map([[3, true]]);
    vi.mocked(followClub).mockImplementation(async id => { if (id === 2) throw new Error('offline'); return {} as never; });
    vi.mocked(unfollowClub).mockResolvedValue({} as never);
    const save = followChanges(held, new Map([[1, true], [2, true], [3, false]]));
    await expect(save()).rejects.toEqual(new FollowsFailed(1));
    expect(held).toEqual(new Map([[1, true], [3, false]]));
    vi.mocked(followClub).mockClear().mockResolvedValue({} as never);
    await save();
    expect(followClub).toHaveBeenCalledTimes(1);
    expect(followClub).toHaveBeenCalledWith(2);
    expect(unfollowClub).toHaveBeenCalledTimes(1);
});

it('keeps what did not save across screens, in screen order, until a retry saves it', async () => {
    const { result } = renderHook(() => useUnsaved());
    const flaky = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    await act(async () => { await result.current.attempt('see', flaky); });
    await act(async () => { await result.current.attempt('town', () => Promise.reject(new FollowsFailed(2))); });
    expect(result.current.items.map(item => [item.part, item.count])).toEqual([['town', 2], ['see', undefined]]);
    await act(async () => { await result.current.attempt('town', () => Promise.resolve()); });
    expect(result.current.pending()).toBe(true);
    let saved = false;
    await act(async () => { saved = await result.current.retry(); });
    expect(saved).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(flaky).toHaveBeenCalledTimes(2);
});
