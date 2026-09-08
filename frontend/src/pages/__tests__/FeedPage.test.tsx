import { render, screen, waitFor } from '@testing-library/react';
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
    FeedList: ({ posts, emptyState, onLikeToggle, likeErrors }: {
        posts: FeedPostDto[];
        emptyState: React.ReactNode;
        onLikeToggle: (postId: number) => Promise<void>;
        likeErrors: Record<number, string | null>;
    }) => posts.length === 0 ? <>{emptyState}</> : (
        <div data-testid="feed-list">
            <span data-testid="like-state">{posts[0].isLikedByMe ? 'liked' : 'not-liked'}</span>
            <button type="button" onClick={() => void onLikeToggle(posts[0].id)}>Toggle like</button>
            {likeErrors[posts[0].id] && <span role="alert">{likeErrors[posts[0].id]}</span>}
        </div>
    ),
}));

vi.mock('../../components/PostTheaterModal', () => ({
    PostTheaterModal: () => <div data-testid="theater-modal" />,
}));

import { apiClient } from '../../api/axiosConfig';

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/home']}>
            <FeedPage />
        </MemoryRouter>
    );

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
        it('shows "For You" empty state with guide links when on default view', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [] },
            });
            renderPage();
            expect(await screen.findByText('Your Home is ready')).toBeInTheDocument();
            expect(screen.getByText('Find Clubs')).toBeInTheDocument();
            expect(screen.getByText('Browse Map')).toBeInTheDocument();
            expect(screen.getByText('Discover Events')).toBeInTheDocument();
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
            expect(screen.getByText('Discover Events').closest('a')).toHaveAttribute('href', '/tournaments');
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
            expect(screen.getByRole('link', { name: /For You/i })).toHaveAttribute('href', '/home');
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
