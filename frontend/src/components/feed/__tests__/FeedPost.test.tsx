import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FeedPost, type FeedPostDto } from '../FeedPost';

const basePost: FeedPostDto = {
    id: 1,
    authorId: 22,
    authorName: 'Jordan Lee',
    authorAvatarUrl: null,
    clubId: null,
    clubName: null,
    content: 'Training update',
    createdAt: '2026-09-02T08:00:00Z',
    likeCount: 3,
    commentCount: 1,
    isLikedByMe: false
};

const renderPost = (post: FeedPostDto) =>
    render(
        <MemoryRouter>
            <FeedPost
                post={post}
                isCommentsOpen={false}
                onLikeToggle={vi.fn()}
                onToggleComments={vi.fn()}
                onSubmitComment={vi.fn()}
                onImageClick={vi.fn()}
            />
        </MemoryRouter>
);

const renderInteractivePost = (overrides: Partial<React.ComponentProps<typeof FeedPost>> = {}) => {
    const props: React.ComponentProps<typeof FeedPost> = {
        post: basePost,
        isCommentsOpen: true,
        commentsData: [],
        onLikeToggle: vi.fn().mockResolvedValue(undefined),
        onToggleComments: vi.fn(),
        onSubmitComment: vi.fn().mockResolvedValue(undefined),
        onImageClick: vi.fn(),
        ...overrides,
    };
    render(<MemoryRouter><FeedPost {...props} /></MemoryRouter>);
    return props;
};

describe('FeedPost author navigation', () => {
    it('opens the displayed club profile for a club-authored post', () => {
        renderPost({ ...basePost, clubId: 7, clubName: 'Northside Academy' });

        expect(screen.getByRole('link', { name: 'View Northside Academy profile' })).toHaveAttribute('href', '/clubs/7');
    });

    it('opens the user profile for a person-authored post', () => {
        renderPost(basePost);

        expect(screen.getByRole('link', { name: 'View Jordan Lee profile' })).toHaveAttribute('href', '/profile/22');
    });
});

describe('FeedPost mutation feedback', () => {
    it('keeps a comment draft and explains the failure when posting is denied', async () => {
        const user = userEvent.setup();
        renderInteractivePost({ onSubmitComment: vi.fn().mockRejectedValue(new Error('offline')) });

        const input = screen.getByPlaceholderText('Write a comment...');
        await user.type(input, 'Keep this draft');
        await user.click(screen.getByRole('button', { name: 'Post comment' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here');
        expect(input).toHaveValue('Keep this draft');
    });

    it('copies a stable post link instead of the current feed address', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        renderInteractivePost();

        await user.click(screen.getByRole('button', { name: 'Share' }));

        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/1`);
        expect(await screen.findByText('Post link copied.')).toBeInTheDocument();
    });
});
