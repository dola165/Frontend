import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordPostCard } from './RecordPostCard';
import type { FeedPostDto } from '../../components/feed/FeedPost';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'session', user: { id: 7 } }) }));
vi.mock('../actions/useAction', () => ({ useAction: () => ({ allowed: true, loading: false }) }));
vi.mock('../actions/follow', () => ({ FOLLOW_SETTLED: 'gk-follow-settled', setFollowing: vi.fn(async (_subject: unknown, following: boolean) => following) }));
afterEach(cleanup);

const newClub = (following: boolean) => ({
    id: 70, content: '', clubId: 3, clubName: 'Saburtalo Youth Lab Academy', authorId: null, createdAt: '2026-11-02T08:02:00Z',
    record: { kind: 'CLUB', moment: 'OPENED', recordId: 3, title: 'Saburtalo Youth Lab Academy', placeName: 'Tbilisi', ages: ['U14'], action: 'FOLLOW', following, line: null, hidden: false, canChange: false, version: 1 },
}) as unknown as FeedPostDto;
const card = (post: FeedPostDto) => <MemoryRouter><RecordPostCard post={post} /></MemoryRouter>;

it('takes the club’s follow state from Home loaded again, though the post on screen keeps its id', () => {
    // The welcome followed the club while this card sat under it; Home then loads the same post with the new state.
    const view = render(card(newClub(false)));
    expect(screen.getByRole('button', { name: 'Follow Saburtalo Youth Lab Academy' })).toBeInTheDocument();
    view.rerender(card(newClub(true)));
    expect(screen.getByRole('button', { name: 'Following Saburtalo Youth Lab Academy' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps a tap made on the card itself until the server says otherwise', async () => {
    const view = render(card(newClub(false)));
    screen.getByRole('button', { name: 'Follow Saburtalo Youth Lab Academy' }).click();
    expect(await screen.findByRole('button', { name: 'Following Saburtalo Youth Lab Academy' })).toBeInTheDocument();
    view.rerender(card(newClub(false)));
    expect(screen.getByRole('button', { name: 'Following Saburtalo Youth Lab Academy' })).toBeInTheDocument();
});
