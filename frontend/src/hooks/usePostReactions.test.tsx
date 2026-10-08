import { act, renderHook } from '@testing-library/react';
import { apiClient } from '../api/axiosConfig';
import type { FeedPostDto } from '../components/feed/FeedPost';
import { usePostReactions } from './usePostReactions';
vi.mock('../api/axiosConfig', () => ({ apiClient: { put: vi.fn(), delete: vi.fn() } }));
const post = { id: 7, myReaction: 'LOVE', reactionCount: 3, reactionCounts: { LOVE: 2, WOW: 1 } } as FeedPostDto;
beforeEach(() => vi.clearAllMocks());

it('blocks duplicate gestures and applies canonical server counts once', async () => {
    let finish!: (value: { data: FeedPostDto }) => void;
    vi.mocked(apiClient.put).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const saved = vi.fn(), { result } = renderHook(() => usePostReactions('feed', saved));
    let pending!: Promise<void>;
    act(() => { pending = result.current.change(7, 'LOVE'); void result.current.change(7, 'WOW'); });
    expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(result.current.pending[7]).toBe(true);
    await act(async () => { finish({ data: post }); await pending; });
    expect(saved).toHaveBeenCalledExactlyOnceWith(post);
    expect(result.current.pending[7]).toBe(false);
});

it('keeps the prior selection after failure and permits explicit retry and removal', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: post });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { ...post, myReaction: null, reactionCount: 2 } });
    const saved = vi.fn(), { result } = renderHook(() => usePostReactions('feed', saved));
    await act(() => result.current.change(7, 'LOVE'));
    expect(saved).not.toHaveBeenCalled();
    expect(result.current.errors[7]).toContain('previous choice is unchanged');
    await act(() => result.current.change(7, 'LOVE'));
    expect(result.current.errors[7]).toBeNull();
    await act(() => result.current.change(7, null));
    expect(apiClient.delete).toHaveBeenCalledWith('/posts/7/reaction', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(saved.mock.lastCall?.[0].myReaction).toBeNull();
});

it('aborts and ignores a response belonging to the previous profile', async () => {
    let finish!: (value: { data: FeedPostDto }) => void;
    vi.mocked(apiClient.put).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const saved = vi.fn(), { result, rerender } = renderHook(({ scope }) => usePostReactions(scope, saved), { initialProps: { scope: 'profile:1' } });
    let pending!: Promise<void>;
    act(() => { pending = result.current.change(7, 'LOVE'); });
    const config = vi.mocked(apiClient.put).mock.calls[0][2];
    rerender({ scope: 'profile:2' });
    expect(config?.signal?.aborted).toBe(true);
    await act(async () => { finish({ data: post }); await pending; });
    expect(saved).not.toHaveBeenCalled();
    expect(result.current.pending).toEqual({});
});
