import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PageView } from '../../../features/pages/api';
import { makePage } from '../../../features/pages/__tests__/fixtures';
import { OrganizationPage } from '../../../features/pages/OrganizationPage';
import { LivePanel } from '../../../features/pages/edit/panels/LivePanel';
import { PostComposer } from '../PostComposer';
import { FeedPost } from '../FeedPost';

const state = vi.hoisted(() => ({ page: null as PageView | null, post: vi.fn(), get: vi.fn(), feed: vi.fn(), created: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: state.post, get: state.get }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' } }));
vi.mock('../../../features/pages/edit/context', () => ({ usePageEdit: () => ({ page: state.page, failed: false, retry: vi.fn(), editing: false, panel: null, closePanel: vi.fn(), openPanel: vi.fn() }) }));
vi.mock('../../../features/pages/PageDocument', () => ({ PageDocument: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../../../features/pages/edit/PagePanels', () => ({ PagePanels: () => null }));
vi.mock('../../../features/pages/boxes/defaultBoxes', () => ({ defaultBoxes: {} }));
vi.mock('../../../features/pages/copy', () => ({ usePagesCopy: () => (key: string) => key }));
vi.mock('../../../features/squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (key: string) => key }));
vi.mock('../../../features/profiles/useProfilePostFeed', () => ({ useProfilePostFeed: state.feed }));
vi.mock('../../../features/profiles/ProfilePosts', () => ({ ProfilePosts: ({ composer }: { composer?: React.ReactNode }) => <div>{composer}</div> }));
vi.mock('../../ui/MediaImage', () => ({ MediaImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const open = (element: React.ReactNode) => render(<MemoryRouter>{element}</MemoryRouter>);
const composer = () => <PostComposer organizationId={7002} authorName="Owner06 synthetic page" onPostCreated={state.created} />;
beforeEach(() => {
    vi.clearAllMocks();localStorage.clear();sessionStorage.clear();localStorage.setItem('userId', '1');localStorage.setItem('gk-session-id', 'owner06-posts');
    state.page = makePage({ status: 'LIVE' });
    state.feed.mockReturnValue({ pages: { refresh: vi.fn() }, posts: [] });
    state.post.mockResolvedValue({ data: { postId: 71 } });
});

it('does not mount a feed or composer for a reserved draft organization', () => {
    state.page = makePage({ status: 'DRAFT' });open(<OrganizationPage />);
    expect(screen.getByText('Publish this page before posting')).toBeInTheDocument();
    expect(state.feed).not.toHaveBeenCalled();expect(state.get).not.toHaveBeenCalled();expect(screen.queryByRole('textbox')).toBeNull();
});

it('does not fetch organization0 while the page is unavailable', () => {
    state.page = null;open(<OrganizationPage />);expect(state.feed).not.toHaveBeenCalled();expect(state.get).not.toHaveBeenCalled();
});

it('loads the live organization feed and exposes posting only to confirmed owner/admin authority', () => {
    const first=open(<OrganizationPage />);expect(state.feed).toHaveBeenCalledWith('/posts/organization/7002');
    expect(screen.getByRole('textbox', { name: 'Create a page post' })).toBeInTheDocument();first.unmount();
    state.page = makePage({ status: 'LIVE', viewer: { role: 'COACH', canEdit: true, editable: 'ALL', canClaim: false } });
    open(<OrganizationPage />);expect(screen.queryByRole('textbox', { name: 'Create a page post' })).toBeNull();
});

it('recovers the exact organization post after remount without falling back to personal authorship', async () => {
    state.post.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue({ data: { postId: 71 } });
    const first=open(composer());fireEvent.change(screen.getByRole('textbox', { name: 'Create a page post' }), { target: { value: 'Synthetic original organization post' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Publish post' })); });
    expect(state.created).not.toHaveBeenCalled();expect(screen.getByRole('textbox', { name: 'Create a page post' })).toBeDisabled();
    const original=state.post.mock.calls[0];expect(original[1]).toEqual({ content: 'Synthetic original organization post', clubId: null, organizationId: 7002, isPublic: true, mediaIds: [] });
    expect(original[2].headers['Idempotency-Key']).toEqual(expect.any(String));first.unmount();open(composer());
    expect(state.post).toHaveBeenCalledTimes(1);expect(screen.getByRole('textbox', { name: 'Create a page post' })).toHaveValue('Synthetic original organization post');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry original post' })); });
    expect(state.post.mock.calls[1][1]).toEqual(original[1]);expect(state.post.mock.calls[1][2].headers).toEqual(original[2].headers);
    expect(state.created).toHaveBeenCalledWith(71);expect(screen.getByRole('textbox', { name: 'Create a page post' })).toHaveValue('');
});

it('retains an unconfirmed organization result when the reply has no saved postId', async () => {
    state.post.mockResolvedValueOnce({ data: {} });open(composer());
    fireEvent.change(screen.getByRole('textbox', { name: 'Create a page post' }), { target: { value: 'Synthetic unconfirmed post' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Publish post' })); });
    expect(state.created).not.toHaveBeenCalled();expect(screen.getByRole('button', { name: 'Retry original post' })).toBeInTheDocument();
});

it('rejects ambiguous club plus organization authors before any request', async () => {
    open(<PostComposer clubId={8} organizationId={7002} onPostCreated={state.created} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Create a club post' }), { target: { value: 'Synthetic ambiguous' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Publish post' })); });
    expect(state.post).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Choose either a club or a page author.');
});

it('generic first-post action holds its exact request across remount and marks Posted only after confirmation', async () => {
    state.post.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ data: { postId: 81 } });
    const first=open(<LivePanel />);fireEvent.change(screen.getByRole('textbox', { name: 'Your first post' }), { target: { value: 'Synthetic first page update' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post it' })); });
    expect(screen.queryByText('Posted')).toBeNull();const original=state.post.mock.calls[0];first.unmount();open(<LivePanel />);
    expect(screen.getByRole('textbox', { name: 'Your first post' })).toHaveValue('Synthetic first page update');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry original post' })); });
    expect(await screen.findByText('Posted')).toBeInTheDocument();expect(state.post.mock.calls[1][1]).toEqual(original[1]);
    expect(state.post.mock.calls[1][2].headers).toEqual(original[2].headers);
});

it('a draft first-post action has no publication control and sends nothing', () => {
    state.page = makePage({ status: 'DRAFT' });open(<LivePanel />);
    expect(screen.getByText('Publish this page before posting.')).toBeInTheDocument();expect(screen.queryByRole('button', { name: 'Post it' })).toBeNull();expect(state.post).not.toHaveBeenCalled();
});

it('retains the existing club first-post request', async () => {
    state.page = makePage({ kind: 'CLUB', clubId: 8, status: 'LIVE' });open(<LivePanel />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your first post' }), { target: { value: 'Synthetic club first post' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post it' })); });
    expect(state.post).toHaveBeenCalledWith('/posts', { content: 'Synthetic club first post', clubId: 8, organizationId: null, isPublic: true, mediaIds: [] });
});

it('links an organization post to its page rather than the underlying personal author', async () => {
    open(<FeedPost post={{ id: 4, content: 'Synthetic public post', createdAt: '2026-10-18T00:00:00Z', authorId: 9, authorName: 'Private actor name', organizationId: 7002, organizationName: 'Owner06 synthetic page', likeCount: 0, commentCount: 0, isLikedByMe: false }} isCommentsOpen={false} onLikeToggle={vi.fn()} onToggleComments={vi.fn()} onSubmitComment={vi.fn()} onImageClick={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'View Owner06 synthetic page profile' })).toHaveAttribute('href', '/organizations/7002'));
    expect(screen.queryByText('Private actor name')).toBeNull();
});
