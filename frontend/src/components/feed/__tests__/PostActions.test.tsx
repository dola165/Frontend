import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FeedPost, type FeedPostDto } from '../FeedPost';
import { EditPostDialog, SharePostDialog } from '../PostDialogs';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
const post: FeedPostDto = { id: 7, authorId: 20, authorName: 'Academy Coach', content: 'Training today', createdAt: '2026-09-30T00:00:00', likeCount: 0, commentCount: 0, isLikedByMe: false, isPublic: true };
const mount = (element: React.ReactNode) => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('userId', '20'); api.get.mockResolvedValue({ data: { content: [{ id: 9, name: 'Dinamo staff', contextType: 'GROUP', participants: [] }], totalElements: 1 } }); });
const card = (overrides: Partial<FeedPostDto> = {}) => <FeedPost post={{ ...post, ...overrides }} isCommentsOpen={false} onLikeToggle={vi.fn()} onToggleComments={vi.fn()} onSubmitComment={vi.fn()} onImageClick={vi.fn()} />;
it('puts own edit and delete in a visible menu without offering a self-report', async () => {
    const user = userEvent.setup(); mount(card({ canEdit: true })); await user.click(screen.getByLabelText('Actions for post by Academy Coach'));
    expect(screen.getByRole('button', { name: 'Edit post' })).toBeVisible(); expect(screen.getByRole('button', { name: 'Delete post' })).toBeVisible(); expect(screen.queryByRole('button', { name: 'Report post' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit post' })); expect(screen.getByRole('dialog', { name: 'Edit post' })).toBeVisible();
    await user.keyboard('{Escape}'); expect(screen.getByLabelText('Actions for post by Academy Coach')).toHaveFocus();
});
it('reports another post only after reason selection and explicit submission', async () => {
    const user = userEvent.setup(); api.post.mockResolvedValue({ data: { id: 55 } }); mount(card({ authorId: 21 }));
    expect(screen.getByRole('button', { name: 'Report post' })).not.toBeVisible(); await user.click(screen.getByLabelText('Actions for post by Academy Coach')); await user.click(screen.getByRole('button', { name: 'Report post' }));
    expect(api.post).not.toHaveBeenCalled(); await user.click(screen.getByLabelText('Spam or unwanted promotion')); await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(api.post).toHaveBeenCalledWith('/reports', expect.objectContaining({ targetType: 'POST', targetId: 7, reason: 'SPAM', requestId: expect.any(String) })); expect(await screen.findByRole('link', { name: 'View report receipt' })).toHaveAttribute('href', '/reports?itemId=55');
});
it('keeps an edit draft when a newer saved edit conflicts', async () => {
    const user = userEvent.setup(); api.put.mockRejectedValue(new Error('conflict')); const saved = vi.fn(); mount(<EditPostDialog post={post} onClose={vi.fn()} onSaved={saved} />);
    await user.clear(screen.getByLabelText('Post text')); await user.type(screen.getByLabelText('Post text'), 'My edit'); await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.getByLabelText('Post text')).toHaveValue('My edit'); expect(saved).not.toHaveBeenCalled(); expect(api.put).toHaveBeenCalledWith('/posts/7', expect.objectContaining({ content: 'My edit', expectedContent: 'Training today', expectedPublic: true }));
});
it('shares a caption with the selected audience and reuses its request key on retry', async () => {
    const user = userEvent.setup(); api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { postId: 80 } }); const shared = vi.fn(); mount(<SharePostDialog post={post} onClose={vi.fn()} onShared={shared} />);
    await user.type(screen.getByLabelText('Say something about this post'), 'Worth a look'); await user.selectOptions(screen.getByLabelText('Audience'), 'false'); await user.click(screen.getByRole('button', { name: 'Share now' })); await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: 'Share now' }));
    await waitFor(() => expect(shared).toHaveBeenCalledOnce()); expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]); expect(api.post).toHaveBeenCalledWith('/posts/7/shares', expect.objectContaining({ content: 'Worth a look', isPublic: false }));
});
it('sends to an actual recent conversation with a safe retry key', async () => {
    const user = userEvent.setup(); api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { id: 33 } }); mount(<SharePostDialog post={post} onClose={vi.fn()} onShared={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Send to Dinamo staff' })); await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: 'Send to Dinamo staff' }));
    expect(await screen.findByRole('button', { name: 'Sent to Dinamo staff' })).toBeDisabled(); expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]); expect(api.post).toHaveBeenCalledWith('/chat/conversations/9/messages', expect.objectContaining({ content: `${window.location.origin}/posts/7`, clientMessageId: expect.any(String) }));
});
it('protects a restricted audience from reposting and chat sharing', async () => {
    mount(<SharePostDialog post={{ ...post, isPublic: false }} onClose={vi.fn()} onShared={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Share now' })).toBeDisabled(); expect(await screen.findByRole('button', { name: 'Send to Dinamo staff' })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
});
