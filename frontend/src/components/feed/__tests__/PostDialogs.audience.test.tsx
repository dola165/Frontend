import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PostAuthor } from '../../../features/feed/postAuthors';
import type { FeedPostDto } from '../FeedPost';

let authors: PostAuthor[] = [];
vi.mock('../../../features/feed/postAuthors', () => ({ usePostAuthors: () => ({ authors, loaded: true }) }));
const { EditPostDialog } = await import('../PostDialogs');
afterEach(cleanup);

const clubPost = { id: 5, content: 'Kit day on Friday', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', squadId: 105, isPublic: true, createdAt: '2026-10-29T08:00:00Z' } as unknown as FeedPostDto;
const edit = (post: FeedPostDto) => render(<MemoryRouter><EditPostDialog post={post} onClose={() => {}} onSaved={() => {}} /></MemoryRouter>);
const club = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', squadId: null, name: 'FC Dinamo Tbilisi Academy' };

it('offers Club leadership only to the club’s Owner and Admins; a coach or the Media officer keeps it public', () => {
    authors = [{ ...club, squadId: 105, name: 'U16 Boys', leadership: false }];
    edit(clubPost);
    expect(screen.queryByRole('combobox', { name: 'Audience' })).toBeNull();
    cleanup();
    authors = [{ ...club, leadership: false }];
    edit(clubPost);
    expect(screen.queryByRole('combobox', { name: 'Audience' })).toBeNull();
    cleanup();
    authors = [{ ...club, leadership: true }];
    edit(clubPost);
    expect(screen.getByRole('option', { name: 'Club leadership' })).toBeInTheDocument();
});

it('keeps the choice on a personal post', () => {
    authors = [];
    edit({ ...clubPost, clubId: null, clubName: null, squadId: null } as unknown as FeedPostDto);
    expect(screen.getByRole('option', { name: 'Only me' })).toBeInTheDocument();
});
