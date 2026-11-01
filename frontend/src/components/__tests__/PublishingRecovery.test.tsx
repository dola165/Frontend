import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PostPage } from '../../pages/PostPage';
import { FeedPage } from '../../pages/FeedPage';
import { type CommentDto, type FeedPostDto } from '../feed/FeedPost';
import { ProfilePosts as ProfilePostList } from '../../features/profiles/ProfilePosts';
import { useProfilePostFeed } from '../../features/profiles/useProfilePostFeed';
import { clearStoredAuth, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 42 } }) }));
vi.mock('../../features/start/WelcomeHost', () => ({ WelcomeHost: () => null }));
vi.mock('../../features/feed/WaitingOnYou', () => ({ WaitingOnYou: () => null }));
vi.mock('../../features/feed/HomeHelperDetails', () => ({ HomeHelperDetails: () => null }));
vi.mock('../feed/PostComposer', () => ({ PostComposer: () => null }));

const createdAt = '2026-10-30T08:00:00Z';
const ownComment = (): CommentDto => ({ id: 10, authorName: 'Coach', content: 'Saved time', createdAt, version: 0, canEdit: true });
const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
};
let post: FeedPostDto, comments: CommentDto[], denied: boolean, failComments: boolean;
let readGate: ReturnType<typeof deferred> | undefined, commentsGate: ReturnType<typeof deferred> | undefined;
let receipts: Map<string, CommentDto>, loseAcknowledgement: boolean;
const copy = <T,>(value: T): T => structuredClone(value);
const unavailable = () => ({ response: { status: 404 } });

beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    clearStoredAuth(); setStoredUserId(42); setStoredAccessToken('synthetic-recovery-only');
    vi.clearAllMocks(); denied = false; failComments = false; readGate = undefined; commentsGate = undefined;
    receipts = new Map(); loseAcknowledgement = false; comments = [ownComment()];
    post = { id: 1, authorId: 42, authorName: 'Coach', content: 'Training update', createdAt, likeCount: 0, commentCount: 1, isLikedByMe: false, mediaUrls: ['/uploads/current.jpg'] };
    api.get.mockImplementation(async (url: string) => {
        if (url === '/posts/authors') return { data: [] };
        if (url.includes('/uploads/')) return { data: new Blob(['synthetic']) };
        await readGate?.promise;
        if (denied) throw unavailable();
        if (url.endsWith('/comments')) {
            await commentsGate?.promise;
            if (failComments) throw { response: { status: 503 } };
            return { data: copy(comments) };
        }
        if (url === '/posts/1') return { data: copy(post) };
        if (url.startsWith('/posts/feed/') || url === '/posts/user/42') return { data: { posts: [copy(post)], nextCursor: null } };
        throw Error('Unexpected synthetic read ' + url);
    });
    api.put.mockImplementation(async (_url: string, body: { content: string; expectedVersion: number }) => {
        if (denied) throw unavailable();
        if (body.expectedVersion !== comments[0].version) throw { response: { status: 409 } };
        comments[0] = { ...comments[0], content: body.content, version: body.expectedVersion + 1, editedAt: createdAt };
        return { data: copy(comments[0]) };
    });
    api.post.mockImplementation(async (_url: string, body: { content: string }, config: { headers: Record<string, string> }) => {
        const key = config.headers['Idempotency-Key'];
        if (!receipts.has(key)) {
            const saved = { ...ownComment(), id: 99, content: body.content };
            receipts.set(key, saved); comments.push(saved); post.commentCount = comments.length;
        }
        if (loseAcknowledgement) { loseAcknowledgement = false; throw Error('Acknowledgement lost'); }
        return { data: copy(receipts.get(key)) };
    });
});
afterEach(() => { cleanup(); clearStoredAuth(); vi.restoreAllMocks(); });

function ProfilePosts() {
    const feed = useProfilePostFeed('/posts/user/42');
    return <ProfilePostList feed={feed} empty={{ title: 'No posts' }} />;
}
function visit(view: 'direct' | 'feed' | 'profile' = 'direct', media = false) {
    return render(<MemoryRouter initialEntries={[view === 'direct' ? `/posts/1${media ? '?media=0' : ''}` : '/home']}>
        <Routes><Route path="/posts/:postId" element={<PostPage />} /><Route path="/home" element={view === 'profile' ? <ProfilePosts /> : <FeedPage user={{ id: 42 }} />} /></Routes>
    </MemoryRouter>);
}
const viewer = async () => within(await screen.findByRole('dialog', { name: 'Post by Coach' }));
async function editInViewer() {
    const user = userEvent.setup(); const dialog = await viewer();
    await user.click(await dialog.findByRole('button', { name: 'Edit' }));
    await user.clear(dialog.getByRole('textbox', { name: 'Edit comment' }));
    await user.type(dialog.getByRole('textbox', { name: 'Edit comment' }), 'My unfinished correction');
    return { user, dialog };
}

it('reloads the theater projection after conflict, keeps the buffer and saves with the explicitly reloaded version', async () => {
    visit('direct', true); const { user, dialog } = await editInViewer();
    comments[0] = { ...comments[0], content: 'Other tab correction', version: 1 };
    await user.click(dialog.getByRole('button', { name: 'Save comment' })); await dialog.findByRole('alert');
    await user.click(dialog.getByRole('button', { name: 'Reload comment' }));
    const refreshed = await viewer();
    expect(await refreshed.findByRole('textbox', { name: 'Edit comment' })).toHaveValue('My unfinished correction');
    await user.click(refreshed.getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(comments[0].content).toBe('My unfinished correction'));
    expect(api.put).toHaveBeenLastCalledWith('/posts/1/comments/10', { content: 'My unfinished correction', expectedVersion: 1 }, expect.any(Object));
    expect(await (await viewer()).findByText('My unfinished correction')).toBeVisible();
});

it.each([false, true].flatMap(conflicted => ['pageshow', 'visibilitychange'].map(event => ({ conflicted, event }))))('keeps an unfinished edit/version through foreground replacement (conflicted=$conflicted, $event)', async ({ conflicted, event }) => {
    visit('direct', true); const { user, dialog } = await editInViewer();
    if (conflicted) {
        comments[0] = { ...comments[0], content: 'Concurrent saved body', version: 1 };
        await user.click(dialog.getByRole('button', { name: 'Save comment' })); await dialog.findByRole('alert');
    }
    const gate = deferred(); readGate = gate;
    act(() => fireEvent(event === 'pageshow' ? window : document, new Event(event)));
    const checking = within(await screen.findByRole('dialog', { name: 'Open post media' }));
    expect(checking.queryByRole('img')).toBeNull(); expect(checking.queryByText('Coach')).toBeNull();
    expect(checking.queryByRole('textbox', { name: 'Edit comment' })).toBeNull();
    await act(async () => { readGate = undefined; gate.resolve(); });
    const resumed = await viewer();
    expect(await resumed.findByRole('textbox', { name: 'Edit comment' })).toHaveValue('My unfinished correction');
    await user.click(resumed.getByRole('button', { name: 'Save comment' }));
    expect(api.put).toHaveBeenLastCalledWith('/posts/1/comments/10', { content: 'My unfinished correction', expectedVersion: 0 }, expect.any(Object));
    if (conflicted) { await resumed.findByRole('alert'); await user.click(resumed.getByRole('button', { name: 'Cancel' })); expect(resumed.getByText('Concurrent saved body')).toBeVisible(); }
});

it.each(['deleted', 'denied'] as const)('reload honors current %s state without displaying the old editor or identity', async state => {
    visit('direct', true); const { user, dialog } = await editInViewer();
    comments[0] = { ...comments[0], version: 1 };
    await user.click(dialog.getByRole('button', { name: 'Save comment' })); await dialog.findByRole('alert');
    if (state === 'deleted') comments[0] = { ...comments[0], deleted: true, content: '', authorName: null, version: 2 };
    else denied = true;
    await user.click(dialog.getByRole('button', { name: 'Reload comment' }));
    if (state === 'deleted') expect(await (await viewer()).findByText('Comment removed')).toBeVisible();
    else expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toHaveTextContent('unavailable');
    expect(within(screen.getByRole('dialog')).queryByRole('textbox', { name: 'Edit comment' })).toBeNull();
    expect(within(screen.getByRole('dialog')).queryByText('Saved time')).toBeNull();
});

it.each((['direct', 'feed', 'profile'] as const).flatMap(view => ([false, true] as const).map(failed => ({ view, failed }))))('reconciles a resumed lost acknowledgement in $view (failed comments=$failed)', async ({ view, failed }) => {
    comments = []; post.commentCount = 0; loseAcknowledgement = true; const user = userEvent.setup(); let page = visit(view);
    await screen.findByText('Training update');
    await user.click(screen.getByRole('button', { name: /^Comment(?:,|$)/ }));
    await user.type(screen.getByRole('textbox', { name: /^Write a comment/ }), 'Already committed once');
    await user.click(screen.getByRole('button', { name: 'Post comment' })); await screen.findByRole('button', { name: 'Retry comment' });
    page.unmount(); const gate = deferred(); if (failed) failComments = true; else commentsGate = gate; page = visit(view);
    await screen.findByText('Training update'); const card = () => page.container.querySelector('.feed-post')!;
    expect(card()).toHaveTextContent('1 comment');
    await user.click(screen.getByRole('button', { name: /^Comment(?:,|$)/ }));
    if (failed) { await screen.findByRole('button', { name: 'Retry' }); comments.push({ ...ownComment(), id: 101 }, { ...ownComment(), id: 102 }); post.commentCount = 3; }
    const expectedCount = failed ? '3 comments' : '1 comment';
    const beforeRead = api.get.mock.calls.filter(([url]) => url === '/posts/1').length;
    await user.click(screen.getByRole('button', { name: 'Retry comment' }));
    await waitFor(() => expect(api.get.mock.calls.filter(([url]) => url === '/posts/1').length).toBeGreaterThan(beforeRead));
    await waitFor(() => expect(card()).toHaveTextContent(expectedCount)); expect(card()).not.toHaveTextContent('2 comments');
    expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]); expect(receipts.size).toBe(1);
    if (failed) { failComments = false; await user.click(screen.getByRole('button', { name: 'Retry' })); }
    else await act(async () => { commentsGate = undefined; gate.resolve(); });
    expect(await screen.findAllByText('Already committed once')).toHaveLength(1);
    expect(card()).toHaveTextContent(expectedCount);
});

it('retains the private edit through denial/retry but never transfers it to another login', async () => {
    visit('direct', true); const { user } = await editInViewer();
    denied = true; act(() => fireEvent(window, new Event('pageshow')));
    const unavailableDialog = within(await screen.findByRole('dialog', { name: 'Open post media' }));
    await unavailableDialog.findByRole('alert');
    expect(unavailableDialog.queryByRole('textbox')).toBeNull(); expect(unavailableDialog.queryByRole('img')).toBeNull();
    denied = false; await user.click(unavailableDialog.getByRole('button', { name: 'Retry' }));
    expect(await (await viewer()).findByRole('textbox', { name: 'Edit comment' })).toHaveValue('My unfinished correction');
    const gate = deferred(); readGate = gate;
    act(() => fireEvent(window, new Event('pageshow')));
    act(() => { clearStoredAuth(); setStoredUserId(43); setStoredAccessToken('next-synthetic-login'); });
    comments[0] = { ...comments[0], canEdit: false, authorName: null, authorAvatarUrl: null };
    await act(async () => { readGate = undefined; gate.resolve(); });
    const next = await viewer(); await next.findByRole('article', { name: 'Comment by Member' });
    expect(next.queryByRole('textbox', { name: 'Edit comment' })).toBeNull();
    expect(next.queryByText('My unfinished correction')).toBeNull();
});

it.each(['direct', 'feed', 'profile'] as const)('explicit reload adopts the current version while retaining the inline edit in %s', async view => {
    visit(view); const user = userEvent.setup(); await screen.findByText('Training update');
    await user.click(screen.getByRole('button', { name: /^Comment(?:,|$)/ }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByRole('textbox', { name: 'Edit comment' }));
    await user.type(screen.getByRole('textbox', { name: 'Edit comment' }), 'Retained inline correction');
    comments[0] = { ...comments[0], content: 'Concurrent saved edit', version: 1 };
    await user.click(screen.getByRole('button', { name: 'Save comment' })); await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Reload comment' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save comment' })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: 'Edit comment' })).toHaveValue('Retained inline correction');
    await user.click(screen.getByRole('button', { name: 'Save comment' }));
    expect(api.put).toHaveBeenLastCalledWith('/posts/1/comments/10', { content: 'Retained inline correction', expectedVersion: 1 }, expect.any(Object));
    expect(await screen.findByText('Retained inline correction')).toBeVisible();
});
