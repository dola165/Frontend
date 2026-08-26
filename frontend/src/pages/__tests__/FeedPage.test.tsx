import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FeedPage } from '../../pages/FeedPage';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
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
    FeedList: ({ posts, emptyState }: { posts: any[]; emptyState: React.ReactNode }) =>
        posts.length === 0 ? <>{emptyState}</> : <div data-testid="feed-list">{posts.length} posts</div>,
}));

vi.mock('../../components/PostTheaterModal', () => ({
    PostTheaterModal: () => <div data-testid="theater-modal" />,
}));

import { apiClient } from '../../api/axiosConfig';

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/feed']}>
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
            expect(await screen.findByText('Failed to load feed')).toBeInTheDocument();
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
            expect(await screen.findByText('Your feed is waiting')).toBeInTheDocument();
            expect(screen.getByText('Find Clubs')).toBeInTheDocument();
            expect(screen.getByText('Browse Map')).toBeInTheDocument();
            expect(screen.getByText('Discover Events')).toBeInTheDocument();
        });

        it('shows "Following" empty state with correct guides when on following view', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [] },
            });
            render(
                <MemoryRouter initialEntries={['/feed?view=following']}>
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
            await screen.findByText('Your feed is waiting');
            expect(screen.getByText('Find Clubs').closest('a')).toHaveAttribute('href', '/clubs');
            expect(screen.getByText('Browse Map').closest('a')).toHaveAttribute('href', '/map');
            expect(screen.getByText('Discover Events').closest('a')).toHaveAttribute('href', '/tournaments');
        });
    });

    describe('welcome banner', () => {
        it('shows welcome banner on first visit', async () => {
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [{ id: 1 }] },
            });
            renderPage();
            expect(await screen.findByText('Welcome to your feed')).toBeInTheDocument();
        });

        it('hides welcome banner after clicking Got it', async () => {
            const user = userEvent.setup();
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [{ id: 1 }] },
            });
            renderPage();
            const gotItBtn = await screen.findByText('Got it');
            await user.click(gotItBtn);
            expect(screen.queryByText('Welcome to your feed')).not.toBeInTheDocument();
            expect(localStorage.getItem('hasSeenWelcomeBanner')).toBe('1');
        });

        it('does not show welcome banner if already dismissed', async () => {
            localStorage.setItem('hasSeenWelcomeBanner', '1');
            (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { content: [{ id: 1 }] },
            });
            renderPage();
            await screen.findByTestId('feed-list');
            expect(screen.queryByText('Welcome to your feed')).not.toBeInTheDocument();
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
