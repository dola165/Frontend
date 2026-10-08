import { act, renderHook, waitFor } from '@testing-library/react';
import { usePagedProfilePosts } from './usePagedProfilePosts';
import { apiClient } from '../api/axiosConfig';
vi.mock('../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const post = (id: number) => ({ id, authorName: 'Player', content: 'Update', mediaUrls: [], createdAt: '2026-09-23T00:00:00', likeCount: 0, commentCount: 0 });
beforeEach(() => vi.clearAllMocks());
it('replaces each page, keeps 20 posts maximum, and fetches previous cursors on demand', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: Array.from({ length: 25 }, (_, i) => post(100-i)), nextCursor: 81 } })
        .mockResolvedValueOnce({ data: { posts: [post(80)], nextCursor: null } })
        .mockResolvedValueOnce({ data: { posts: [post(100)], nextCursor: 81 } });
    const { result } = renderHook(() => usePagedProfilePosts('/posts/user/7'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(20);
    expect(apiClient.get).toHaveBeenLastCalledWith('/posts/user/7', expect.objectContaining({ params: { limit: 20 } }));
    act(() => result.current.older());
    await waitFor(() => expect(result.current.posts[0]?.id).toBe(80));
    expect(result.current.posts).toHaveLength(1);
    expect(apiClient.get).toHaveBeenLastCalledWith('/posts/user/7', expect.objectContaining({ params: { limit: 20, cursor: 81 } }));
    act(() => result.current.newer());
    await waitFor(() => expect(result.current.posts[0]?.id).toBe(100));
    expect(result.current.page).toBe(1);
});
it('does not retry failures automatically and resets the cursor for another identity', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ data: { posts: [post(7)], nextCursor: null } });
    const { result, rerender } = renderHook(({ endpoint }) => usePagedProfilePosts(endpoint), { initialProps: { endpoint: '/posts/club/1' } });
    await waitFor(() => expect(result.current.error).toContain('could not load'));
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    rerender({ endpoint: '/posts/club/2' });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/posts/club/2', expect.objectContaining({ params: { limit: 20 } })));
    expect(result.current.page).toBe(1);
});
