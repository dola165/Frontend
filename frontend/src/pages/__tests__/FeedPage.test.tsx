import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FeedPage } from '../../pages/FeedPage';
import type { FeedPostDto } from '../../components/feed/FeedPost';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
    },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' },
}));

vi.mock('../../components/ui/SkeletonCard', () => ({
    SkeletonCard: () => <div data-testid="skeleton-card" />,
    SkeletonMessageRow: () => <div data-testid="skeleton-message-row" />,
    SkeletonHero: () => <div data-testid="skeleton-hero" />,
}));

vi.mock('../../components/feed/PostComposer', () => ({
    PostComposer: ({ onPostCreated }: { onPostCreated: () => void }) => (
        <div data-testid="post-composer" onClick={onPostCreated}>PostComposer</div>
    ),
}));

vi.mock('../../components/feed/FeedList', () => ({
    FeedList: ({ posts, emptyState, onLikeToggle, likeErrors, onSelectPost }: {
        posts: FeedPostDto[];
        emptyState: React.ReactNode;
        onLikeToggle: (postId: number) => Promise<void>;
        likeErrors: Record<number, string | null>;
        onSelectPost: (post: FeedPostDto) => void;
    }) => posts.length === 0 ? <>{emptyState}</> : (
        <div data-testid="feed-list">
            <span data-testid="post-ids">{posts.map(post => post.id).join(',')}</span>
            <span data-testid="like-count">{posts[0].likeCount}</span>
            <span data-testid="like-state">{posts[0].isLikedByMe ? 'liked' : 'not-liked'}</span>
            <button type="button" onClick={() => void onLikeToggle(posts[0].id)}>Toggle like</button>
            <button type="button" onClick={() => onSelectPost(posts[0])}>Open media</button>
            {likeErrors[posts[0].id] && <span role="alert">{likeErrors[posts[0].id]}</span>}
        </div>
    ),
}));

import { apiClient } from '../../api/axiosConfig';

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/home']}>
            <FeedPage />
        </MemoryRouter>
    );

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

describe('FeedPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('loading state', () => {
        it('shows skeleton cards while fetching', () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
            renderPage();
            expect(screen.getAllByTestId('skeleton-card').length).toBeGreaterThan(0);
        });
    });

    describe('error state', () => {
        it('shows error banner when API fails', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
            renderPage();
            expect(await screen.findByText('Home could not load')).toBeInTheDocument();
            expect(screen.getByText(/Check your connection/)).toBeInTheDocument();
        });

        it('shows retry button in error banner', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
            renderPage();
            expect(await screen.findByText('Retry')).toBeInTheDocument();
        });

        it('retries load when retry button is clicked', async () => {
            const user = userEvent.setup();
            (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
            renderPage();
            const retryBtn = await screen.findByText('Retry');

            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                data: { content: [] },
            });
            await user.click(retryBtn);

            expect(apiClient.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('empty state', () => {
        it('shows "Discover" empty state with guide links when on default view', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [] },
            });
            renderPage();
            expect(await screen.findByText('Your Home is ready')).toBeInTheDocument();
            expect(screen.getByText('Find Clubs')).toBeInTheDocument();
            expect(screen.getByText('Browse Map')).toBeInTheDocument();
            expect(screen.getByText('Your schedule')).toBeInTheDocument();
        });

        it('shows "Following" empty state with correct guides when on following view', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [] },
            });
            render(
                <MemoryRouter initialEntries={['/home?view=following']}>
                    <FeedPage />
                </MemoryRouter>
            );
            expect(await screen.findByText('No Following Activity Yet')).toBeInTheDocument();
            expect(screen.getByText('Browse Clubs')).toBeInTheDocument();
            expect(screen.getByText('Explore Map')).toBeInTheDocument();
        });

        it('renders guide links with correct hrefs', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [] },
            });
            renderPage();
            await screen.findByText('Your Home is ready');
            expect(screen.getByText('Find Clubs').closest('a')).toHaveAttribute('href', '/clubs');
            expect(screen.getByText('Browse Map').closest('a')).toHaveAttribute('href', '/map');
            expect(screen.getByText('Your schedule').closest('a')).toHaveAttribute('href', '/calendar');
        });
    });

    describe('Home controls', () => {
        it('shows Home with the feed switch directly below the composer', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [{ id: 1 }] },
            });
            renderPage();
            await screen.findByTestId('feed-list');
            expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /Discover/i })).toHaveAttribute('href', '/home');
            expect(screen.getByRole('link', { name: /Following/i })).toHaveAttribute('href', '/home?view=following');
        });

        it('restores the previous like state and reports a failed save', async () => {
            const user = userEvent.setup();
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [{ id: 1, isLikedByMe: false, likeCount: 3 }] },
            });
            (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
            renderPage();

            await screen.findByTestId('feed-list');
            await user.click(screen.getByRole('button', { name: 'Toggle like' }));

            await waitFor(() => expect(screen.getByTestId('like-state')).toHaveTextContent('not-liked'));
            expect(screen.getByRole('alert')).toHaveTextContent('previous choice was restored');
            expect(apiClient.put).toHaveBeenCalledWith('/posts/1/like', { liked: true });
        });

        it('replaces media-viewer loading feedback with an error and retries comments', async () => {
            const user = userEvent.setup();
            const firstComments = deferred<{ data: [] }>();
            let commentAttempts = 0;
            (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
                if (url === '/posts/feed/for-you') {
                    return Promise.resolve({ data: { content: [{
                        id: 1,
                        authorName: 'Jordan Lee',
                        content: 'Training photo',
                        createdAt: '2026-09-08T08:00:00Z',
                        likeCount: 0,
                        commentCount: 0,
                        isLikedByMe: false,
                        mediaUrls: ['/uploads/training.jpg'],
                    }] } });
                }
                if (url === '/posts/1/comments') {
                    commentAttempts += 1;
                    return commentAttempts === 1 ? firstComments.promise : Promise.resolve({ data: [] });
                }
                return Promise.reject(new Error(`Unexpected request: ${url}`));
            });
            renderPage();

            await screen.findByTestId('feed-list');
            await user.click(screen.getByRole('button', { name: 'Open media' }));
            expect(await screen.findByRole('dialog', { name: 'Post by Jordan Lee' })).toBeInTheDocument();
            expect(screen.getByText('Loading comments...')).toBeInTheDocument();

            await act(async () => firstComments.reject(new Error('offline')));
            expect(await screen.findByRole('alert')).toHaveTextContent('Comments could not load.');
            expect(screen.queryByText('Loading comments...')).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Retry comments' }));
            expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
            expect(commentAttempts).toBe(2);
        });
    });

    it('shows one page at a time with timestamp cursors, deduplicates overlap, and navigates back', async () => {
        const user = userEvent.setup();
        const post = (id: number) => ({ id, createdAt: '2026-01-01T12:00:00', content: String(id) });
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: [post(5), post(4)], nextCursor: 4 } })
            .mockResolvedValueOnce({ data: { posts: [post(4), post(3), post(2)], nextCursor: 2 } })
            .mockResolvedValueOnce({ data: { posts: [post(1)], nextCursor: null } })
            .mockResolvedValueOnce({ data: { posts: [post(4), post(3), post(2)], nextCursor: 2 } })
            .mockResolvedValueOnce({ data: { posts: [post(5), post(4)], nextCursor: 4 } });
        renderPage();
        await user.click(await screen.findByRole('button', { name: 'Load more posts' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('3,2');
        expect(apiClient.get).toHaveBeenLastCalledWith('/posts/feed/for-you', expect.objectContaining({ params: { limit: 20, cursor: 4, cursorTime: '2026-01-01T12:00:00' } }));
        await user.click(screen.getByRole('button', { name: 'Load more posts' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('1');
        expect(screen.getByRole('status')).toHaveTextContent('all caught up');
        expect(screen.queryByRole('button', { name: 'Load more posts' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back to latest' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Newer posts' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('4,3,2');
        await user.click(screen.getByRole('button', { name: 'Newer posts' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('5,4');
    });

    it('treats omitted API counts and like state as zero and false, including failed-like rollback', async () => {
        const user = userEvent.setup();
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: [{ id: 1 }], nextCursor: null } });
        vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('offline'));
        renderPage();
        expect(await screen.findByTestId('like-count')).toHaveTextContent('0');
        await user.click(screen.getByRole('button', { name: 'Toggle like' }));
        await waitFor(() => expect(screen.getByTestId('like-state')).toHaveTextContent('not-liked'));
        expect(screen.getByTestId('like-count')).toHaveTextContent('0');
    });

    it('retains loaded posts and retries the same failed page', async () => {
        const user = userEvent.setup();
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: [{ id: 5, createdAt: '2026-01-01T12:00:00' }], nextCursor: 5 } })
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ data: { posts: [{ id: 4 }], nextCursor: null } });
        renderPage();
        await user.click(await screen.findByRole('button', { name: 'Load more posts' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('5');
        expect(screen.getByRole('alert')).toHaveTextContent('Older posts could not load');
        await user.click(screen.getByRole('button', { name: 'Retry older posts' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('4');
        expect(vi.mocked(apiClient.get).mock.calls[1][1]?.params).toEqual(vi.mocked(apiClient.get).mock.calls[2][1]?.params);
    });

    it.each(['resolve', 'reject'] as const)('ignores a late %s from the previous view', async outcome => {
        const user = userEvent.setup();
        const old = deferred<{ data: { posts: { id: number }[] } }>();
        vi.mocked(apiClient.get).mockReturnValueOnce(old.promise)
            .mockResolvedValueOnce({ data: { posts: [{ id: 90 }], nextCursor: null } });
        renderPage();
        await user.click(screen.getByRole('link', { name: /Following/i }));
        expect(await screen.findByTestId('post-ids')).toHaveTextContent('90');
        await act(async () => { if (outcome === 'resolve') old.resolve({ data: { posts: [{ id: 1 }] } }); else old.reject(new Error('late error')); });
        expect(screen.getByTestId('post-ids')).toHaveTextContent('90');
        expect(screen.queryByText('Home could not load')).not.toBeInTheDocument();
    });

    it('discards an in-flight older page on refresh and does not request it twice', async () => {
        const user = userEvent.setup();
        const old = deferred<{ data: { posts: { id: number }[]; nextCursor: null } }>();
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: [{ id: 5, createdAt: '2026-01-01T12:00:00' }], nextCursor: 5 } })
            .mockReturnValueOnce(old.promise)
            .mockResolvedValueOnce({ data: { posts: [{ id: 6 }], nextCursor: null } });
        renderPage();
        await user.dblClick(await screen.findByRole('button', { name: 'Load more posts' }));
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        await user.click(screen.getByRole('button', { name: 'Refresh feed' }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('6');
        await act(async () => old.resolve({ data: { posts: [{ id: 4 }], nextCursor: null } }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('6');
    });

    it('keeps posts and composer mounted while switching feeds, with one request per switch', async () => {
        const user = userEvent.setup();
        const following = deferred<{ data: { posts: { id: number }[] } }>();
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: [{ id: 1 }] } })
            .mockReturnValueOnce(following.promise)
            .mockResolvedValueOnce({ data: { posts: [{ id: 3 }] } });
        renderPage();
        const list = await screen.findByTestId('feed-list');
        const composer = screen.getByTestId('post-composer');
        await user.click(screen.getByRole('link', { name: /Following/i }));
        expect(screen.getByTestId('feed-list')).toBe(list);
        expect(screen.queryByTestId('skeleton-card')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Loading Following posts');
        expect(screen.getByRole('region', { name: 'Feed results' })).toHaveAttribute('aria-busy', 'true');
        await act(async () => following.resolve({ data: { posts: [{ id: 2 }] } }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('2');
        await user.click(screen.getByRole('link', { name: /Discover/i }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('3');
        expect(screen.getByTestId('post-composer')).toBe(composer);
        expect(apiClient.get).toHaveBeenCalledTimes(3);
    });

    it('does not flash initial skeletons again when switching away from an empty feed', async () => {
        const user = userEvent.setup();
        const next = deferred<{ data: { posts: { id: number }[] } }>();
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { posts: [] } }).mockReturnValueOnce(next.promise);
        renderPage();
        await screen.findByText('Your Home is ready');
        await user.click(screen.getByRole('link', { name: /Following/i }));
        expect(screen.queryByTestId('skeleton-card')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Loading Following posts');
        await act(async () => next.resolve({ data: { posts: [{ id: 1 }] } }));
        expect(screen.getByTestId('post-ids')).toHaveTextContent('1');
    });

    describe('PostComposer', () => {
        it('renders PostComposer', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [{ id: 1 }] },
            });
            renderPage();
            expect(await screen.findByTestId('post-composer')).toBeInTheDocument();
        });
    });
});
