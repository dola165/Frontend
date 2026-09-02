import { render, screen } from '@testing-library/react';
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
