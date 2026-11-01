import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostComments } from '../PostComments';
import { clearStoredAuth, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), delete: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
import { apiClient } from '../../../api/axiosConfig';
const comment = { id: 10, content: 'Training begins at ten', authorName: 'Coach', createdAt: '2026-10-30T10:00:00Z', version: 3, canEdit: true, likeCount: 0 };
const open = (submit = vi.fn().mockResolvedValue(undefined)) => render(<PostComments postId={7} author="Dinamo" comments={[comment]} submit={submit} retry={vi.fn()} />);
beforeEach(() => { setStoredUserId(42); setStoredAccessToken('synthetic-only'); vi.clearAllMocks(); });
afterEach(() => { cleanup(); clearStoredAuth(); });

it('retains one draft between feed, media and a later visit in this login', async () => {
    const user = userEvent.setup(); const first = open();
    await user.type(screen.getByPlaceholderText('Write a comment…'), 'Keep this thought');
    first.unmount(); open();
    expect(screen.getByPlaceholderText('Write a comment…')).toHaveValue('Keep this thought');
    act(() => { clearStoredAuth(); setStoredUserId(43); setStoredAccessToken('next-synthetic-login'); });
    expect(screen.getByPlaceholderText('Write a comment…')).toHaveValue('');
});

it('retries the same payload and identity after an uncertain reply without duplicate submission', async () => {
    const user = userEvent.setup(); const submit = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined); open(submit);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByPlaceholderText('Write a comment…'), 'I will be there');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('draft is still here');
    expect(screen.getByPlaceholderText('Write a comment…')).toBeDisabled();
    expect(submit.mock.calls[0]).toEqual([7, 'I will be there', expect.objectContaining({ parentId: 10, requestId: expect.any(String) })]);
    await user.click(screen.getByRole('button', { name: 'Retry comment' }));
    expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
    expect(screen.getByPlaceholderText('Write a comment…')).toHaveValue('');
});

it('cancel reply retains the body and sends a top-level comment deliberately', async () => {
    const user = userEvent.setup(); const submit = vi.fn().mockResolvedValue(undefined); open(submit);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByPlaceholderText('Write a comment…'), 'Useful detail');
    await user.click(screen.getByRole('button', { name: 'Cancel reply' }));
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(submit.mock.calls[0][2].parentId).toBeUndefined();
});

it('keeps a conflicting edit draft, while Cancel restores the currently saved body', async () => {
    const user = userEvent.setup(); vi.mocked(apiClient.put).mockRejectedValue(new Error('conflict')); open();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const editor = screen.getByRole('textbox', { name: 'Edit comment' }); await user.clear(editor); await user.type(editor, 'A corrected time');
    await user.click(screen.getByRole('button', { name: 'Save comment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('draft is still here');
    expect(editor).toHaveValue('A corrected time');
    expect(apiClient.put).toHaveBeenCalledWith('/posts/7/comments/10', { content: 'A corrected time', expectedVersion: 3 }, expect.any(Object));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(comment.content)).toBeVisible();
});

it('shows a reaction only after acknowledgement and requires explicit deletion', async () => {
    const user = userEvent.setup(); vi.mocked(apiClient.put).mockResolvedValue({ data: { ...comment, likeCount: 1, isLikedByMe: true } });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { ...comment, content: '', version: 4, deleted: true, likeCount: 0 } }); open();
    await user.click(screen.getByRole('button', { name: 'Like 0' }));
    expect(await screen.findByRole('button', { name: 'Like 1' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Delete' })); expect(apiClient.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete comment' }));
    expect(await screen.findByText('Comment removed')).toBeVisible();
    expect(screen.queryByText(comment.content)).not.toBeInTheDocument();
    expect(apiClient.delete).toHaveBeenCalledWith('/posts/7/comments/10', expect.objectContaining({ params: { expectedVersion: 3 } }));
});

it('cannot leak the old parent text or identity through a reply label', () => {
    render(<PostComments postId={7} author="Dinamo" comments={[{ ...comment, parentId: 999 }]} submit={vi.fn()} />);
    expect(screen.getByText('Reply to an unavailable comment')).toBeVisible();
});

it('keeps a later login draft intact when the retired login write finishes', async () => {
    let resolve!: () => void; const submit = vi.fn(() => new Promise<void>(done => { resolve = done; })); const user = userEvent.setup(); const first = open(submit);
    await user.type(screen.getByPlaceholderText('Write a comment…'), 'Old session'); await user.click(screen.getByRole('button', { name: 'Post comment' }));
    first.unmount(); act(() => { clearStoredAuth(); setStoredUserId(43); setStoredAccessToken('new-session'); }); open();
    await user.type(screen.getByPlaceholderText('Write a comment…'), 'New session draft');
    await act(async () => resolve());
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Comments' })).getByRole('textbox')).toHaveValue('New session draft'));
});

it('unlocks a definitively rejected reply without losing its text', async () => {
    const user = userEvent.setup(); const submit = vi.fn().mockRejectedValue({ response: { status: 404 } }); open(submit);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByPlaceholderText('Write a comment…'), 'Keep this after the parent disappears');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    await screen.findByRole('alert');
    expect(screen.getByPlaceholderText('Write a comment…')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel reply' }));
    expect(screen.getByPlaceholderText('Write a comment…')).toHaveValue('Keep this after the parent disappears');
});
