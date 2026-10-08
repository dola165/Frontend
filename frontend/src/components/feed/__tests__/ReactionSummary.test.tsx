import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { ReactionSummary } from '../ReactionSummary';
import type { FeedPostDto } from '../FeedPost';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const post: FeedPostDto = { id: 5, authorName: 'Author', content: 'Post', createdAt: '', likeCount: 3,
    reactionCount: 3, reactionCounts: { LOVE: 2, LIKE: 1 }, isLikedByMe: false, commentCount: 0 };
const people = [
    { userId: 12, name: 'Jordan Lee', avatarUrl: null, reaction: 'LOVE' },
    { userId: 13, name: 'Alex Green', avatarUrl: null, reaction: 'LIKE' },
];
const page = { people, totalCount: 3, reactionCounts: { LOVE: 2, LIKE: 1 }, availableCount: 3, nextCursor: 13, hasMore: true };
const get = vi.mocked(apiClient.get);
beforeEach(() => { get.mockReset(); localStorage.clear(); get.mockResolvedValue({ data: page }); });
const mount = (value = post) => render(<MemoryRouter><ReactionSummary post={value} /></MemoryRouter>);

it('fetches names only on hover, keeps the preview open under the pointer and dismisses on Escape', async () => {
    const user = userEvent.setup(); mount();
    expect(get).not.toHaveBeenCalled();
    const summary = screen.getByRole('button', { name: 'Liked by 3 people' });
    await user.hover(summary);
    const preview = await screen.findByRole('tooltip');
    expect(await within(preview).findByText('Jordan Lee')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/posts/5/reactions', expect.objectContaining({ params: { limit: 8 } }));
    await user.hover(preview);
    await new Promise(resolve => setTimeout(resolve, 160));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('opens an accessible people list, filters with the keyboard and links to real profiles', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Liked by 3 people' }));
    const dialog = screen.getByRole('dialog', { name: 'Reactions' });
    const link = await within(dialog).findByRole('link', { name: /Jordan Lee/ });
    expect(link).toHaveAttribute('href', '/profile/12');
    const all = within(dialog).getByRole('tab', { name: 'All, 3 reactions' });
    all.focus();
    get.mockResolvedValueOnce({ data: { ...page, people: [people[0]], availableCount: 2, hasMore: false, nextCursor: null } });
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: 'Love, 2 reactions' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/posts/5/reactions', expect.objectContaining({ params: { limit: 20, reaction: 'LOVE' } })));
    expect(await within(dialog).findByText('Jordan Lee')).toBeInTheDocument();
    expect(within(dialog).queryByText('Alex Green')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Liked by 3 people' })).toHaveFocus();
});

it('paginates without duplicates and retries the failed page', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Liked by 3 people' }));
    await screen.findByText('Jordan Lee');
    get.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load reactions');
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    get.mockResolvedValueOnce({ data: { ...page, people: [people[1], { ...people[0], userId: 14, name: 'Sam Brown' }], hasMore: false, nextCursor: null } });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Sam Brown')).toBeInTheDocument();
    expect(screen.getAllByText('Alex Green')).toHaveLength(1);
    expect(get).toHaveBeenLastCalledWith('/posts/5/reactions', expect.objectContaining({ params: { limit: 20, cursor: 13 } }));
});

it('discards loaded people when access is revoked on the next page', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Liked by 3 people' }));
    await screen.findByText('Jordan Lee');
    get.mockRejectedValueOnce({ response: { status: 404 } });
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
});

it('aborts an old account request and never renders its late names after a session change', async () => {
    localStorage.setItem('gk-session-id', 'first');
    let finish!: (response: { data: typeof page }) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Liked by 3 people' }));
    const signal = get.mock.calls[0][1]?.signal;
    act(() => { localStorage.setItem('gk-session-id', 'second'); window.dispatchEvent(new Event('gk-auth-changed')); });
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish({ data: page }); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument();
});

it('ignores a late result from a previous filter', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Liked by 3 people' }));
    await screen.findByText('Jordan Lee');
    let finish!: (response: { data: typeof page }) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await user.click(screen.getByRole('tab', { name: 'Love, 2 reactions' }));
    get.mockResolvedValueOnce({ data: { ...page, people: [people[1]], hasMore: false } });
    await user.click(screen.getByRole('tab', { name: 'Like, 1 reactions' }));
    await screen.findByText('Alex Green');
    await act(async () => finish({ data: page }));
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument();
});

it('does not display a summary or fetch for an unreacted post', () => {
    mount({ ...post, likeCount: 0, reactionCount: 0, reactionCounts: {} });
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); expect(get).not.toHaveBeenCalled();
});
