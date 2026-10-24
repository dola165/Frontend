import '../../i18n';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import type { LiveHandlers } from './liveChat';
import { TeamChatNavItem } from './TeamChatNavItem';
import { TeamChatPage } from './TeamChatPage';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchState: vi.fn(), fetchUnread: vi.fn(), fetchPage: vi.fn(), fetchChanges: vi.fn(), sendMessage: vi.fn(),
    editMessage: vi.fn(), deleteMessage: vi.fn(), react: vi.fn(), fetchHistory: vi.fn(), markRead: vi.fn(), fetchShared: vi.fn(), searchMessages: vi.fn(),
    uploadPicture: vi.fn(), uploadVideo: vi.fn(), uploadFile: vi.fn(), cancelUpload: vi.fn(), playLink: vi.fn(),
}));
let live: LiveHandlers | null = null;
vi.mock('./liveChat', () => ({ connectLive: (_: number, handlers: LiveHandlers) => { live = handlers; return { typing: vi.fn(), close: vi.fn() }; } }));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source, protectedMediaUrl: (source?: string) => source }));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'one', user: { id: 1 } }) }));

const beqa = { id: 1, name: 'Beqa', avatarUrl: null }, gio = { id: 2, name: 'Gio', avatarUrl: null }, ilo = { id: 3, name: 'Ilo', avatarUrl: null };
const limits: api.ChatLimits = { pictureMb: 10, videoMb: 90, fileMb: 25, videoTypes: ['video/mp4', 'video/webm'], fileExtensions: ['pdf', 'txt'], maxLength: 2000, maxAttachments: 10 };
const state = (extra: Partial<api.ChatState> = {}): api.ChatState => ({ conversationId: 50, me: 1, members: [beqa, gio, ilo], firstUnreadId: null, unreadCount: 0, revision: 3, limits,
    reactions: ['👍', '❤️', '🎉'], canModerate: false, ...extra });
const minute = (n: number) => new Date(Date.now() - (60 - n) * 60_000).toISOString();
const message = (id: number, extra: Partial<api.ChatMessage> = {}): api.ChatMessage => ({
    id, senderId: 2, senderName: 'Gio', content: `message ${id}`, createdAt: minute(id), editedAt: null, deleted: false, replyTo: null,
    attachments: [], reactions: [], mentions: [], tasks: [], revision: id, clientMessageId: null, ...extra,
});
const page = (messages: api.ChatMessage[]): api.ChatPage => ({ messages, hasOlder: false, hasNewer: false, revision: 3 });

function Where() { const location = useLocation(); return <output data-testid="where">{location.search}</output>; }
const mount = (path = '/team-work/chat') => render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/team-work/chat" element={<><TeamChatPage /><Where /></>} />
</Routes></MemoryRouter>);
const box = () => screen.getByRole('combobox', { name: 'Message the team' });
/** The message whose own words are these (not a quote of it). */
const row = (text: string) => [...document.querySelectorAll<HTMLElement>('article')].find(article => article.querySelector('.tc-msg__text')?.textContent?.replace(/ \(edited\)$/, '') === text) as HTMLElement;

beforeEach(() => {
    vi.resetAllMocks();
    live = null;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('gk-session-id', 'one');
    localStorage.setItem('userId', '1');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(api.fetchState).mockResolvedValue(state());
    vi.mocked(api.fetchPage).mockResolvedValue(page([message(1, { content: 'Morning' }), message(2, { senderId: 1, senderName: 'Beqa', content: '@Gio see GK-12', mentions: [2],
        tasks: [{ id: 12, key: 'GK-12', title: 'Registration', status: 'IN_PROGRESS', parentId: null }] })]));
    vi.mocked(api.fetchChanges).mockResolvedValue({ messages: [], revision: 3, more: false });
    vi.mocked(api.markRead).mockResolvedValue({ firstUnreadId: null, unreadCount: 0 });
});

it('shows the conversation: who wrote what, mentions, a task key as a link with its name and status', async () => {
    mount();
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    const mention = screen.getByText('@Gio');
    expect(mention).toHaveClass('tc-mention');
    const task = screen.getByRole('link', { name: /GK-12/ });
    expect(task).toHaveAttribute('href', '/team-work?task=12');
    expect(within(task).getByRole('tooltip', { hidden: true })).toHaveTextContent('In progress');
    expect(within(task).getByRole('tooltip', { hidden: true })).toHaveTextContent('Registration');
    expect(screen.getByRole('heading', { name: 'Team chat' })).toBeInTheDocument();
});

it('puts the New line where the unread messages start', async () => {
    vi.mocked(api.fetchState).mockResolvedValue(state({ firstUnreadId: 2, unreadCount: 1 }));
    mount();
    await screen.findByText('Morning');
    const line = screen.getByText('New');
    expect(line.closest('[data-unread-line]')).not.toBeNull();
    expect(line.compareDocumentPosition(screen.getByText('@Gio'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('does not exist for someone off the team', async () => {
    vi.mocked(api.fetchState).mockRejectedValue({ response: { status: 404 } });
    mount();
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
});

it('sends a message once, even when the first try got no answer', async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendMessage).mockRejectedValueOnce(new Error('Network Error'))
        .mockImplementationOnce(async body => message(10, { senderId: 1, senderName: 'Beqa', content: body.content, clientMessageId: body.clientMessageId }));
    mount();
    await screen.findByText('Morning');
    await user.type(box(), 'Hello team{Enter}');
    expect(await screen.findByText('Waiting for the connection…')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(api.sendMessage).mock.calls.map(([body]) => body);
    expect(second.clientMessageId).toBe(first.clientMessageId);
    await waitFor(() => expect(screen.queryByText('Waiting for the connection…')).not.toBeInTheDocument());
    expect(screen.getAllByText('Hello team')).toHaveLength(1);
});

it('says why a message was refused, and it can be tried again or removed', async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendMessage).mockRejectedValue({ response: { status: 400 } });
    mount();
    await screen.findByText('Morning');
    await user.type(box(), 'Not this{Enter}');
    expect(await screen.findByText('Not sent')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Not this')).not.toBeInTheDocument();
});

it('edits your own message, then deletes it for everyone after asking', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPage).mockResolvedValue(page([message(5, { senderId: 1, senderName: 'Beqa', content: 'Plan at 18:00' })]));
    vi.mocked(api.editMessage).mockImplementation(async (id, content) => message(id, { senderId: 1, senderName: 'Beqa', content, editedAt: new Date().toISOString(), revision: 20 }));
    vi.mocked(api.deleteMessage).mockImplementation(async id => message(id, { senderId: 1, senderName: 'Beqa', content: '', deleted: true, revision: 21 }));
    mount();
    await screen.findByText('Plan at 18:00');
    await user.click(within(row('Plan at 18:00')).getByLabelText('Edit'));
    expect(box()).toHaveValue('Plan at 18:00');
    await user.clear(box());
    await user.type(box(), 'Plan at 19:00{Enter}');
    expect(api.editMessage).toHaveBeenCalledWith(5, 'Plan at 19:00');
    expect(await screen.findByText('(edited)')).toBeInTheDocument();
    await user.click(within(row('Plan at 19:00')).getByLabelText('More'));
    await user.click(screen.getByRole('menuitem', { name: 'Delete for everyone' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message for everyone?' });
    expect(api.deleteMessage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(api.deleteMessage).toHaveBeenCalledWith(5);
    expect(await screen.findByText('Message deleted')).toBeInTheDocument();
});

it('replies with the message quoted, and reacts', async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendMessage).mockImplementation(async body => message(11, { senderId: 1, senderName: 'Beqa', content: body.content, clientMessageId: body.clientMessageId,
        replyTo: { id: 1, senderId: 2, senderName: 'Gio', excerpt: 'Morning', deleted: false, attachments: 0 } }));
    vi.mocked(api.react).mockImplementation(async (id, emoji) => message(id, { content: 'Morning', reactions: [{ emoji, userIds: [1] }], revision: 30 }));
    mount();
    await screen.findByText('Morning');
    await user.click(within(row('Morning')).getByLabelText('Reply'));
    expect(screen.getByText('Replying to')).toBeInTheDocument();
    await user.type(box(), 'Morning to you{Enter}');
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'Morning to you', replyToId: 1 })));
    await user.click(within(row('Morning')).getByLabelText('React'));
    await user.click(screen.getByRole('button', { name: '👍' }));
    expect(api.react).toHaveBeenCalledWith(1, '👍', true);
    expect(await screen.findByRole('button', { name: /👍 1/ })).toHaveAttribute('aria-pressed', 'true');
});

it('catches up when the live line says something changed', async () => {
    mount();
    await screen.findByText('Morning');
    await waitFor(() => expect(live).not.toBeNull());
    vi.mocked(api.fetchChanges).mockResolvedValue({ messages: [message(4, { content: 'Fresh news', revision: 4 })], revision: 4, more: false });
    act(() => live?.onChanged());
    expect(await screen.findByText('Fresh news')).toBeInTheDocument();
});

it('uploads a file before sending it with the message, and refuses kinds the team does not keep', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const file: api.ChatAttachment = { id: 70, kind: 'FILE', name: 'plan.pdf', contentType: 'application/pdf', sizeBytes: 2048, url: '/uploads/team-work/x.pdf', thumbUrl: null, width: null, height: null, playUrl: null };
    vi.mocked(api.uploadFile).mockResolvedValue(file);
    vi.mocked(api.sendMessage).mockImplementation(async body => message(12, { senderId: 1, senderName: 'Beqa', content: body.content, attachments: [file], clientMessageId: body.clientMessageId }));
    const { container } = mount();
    await screen.findByText('Morning');
    const input = container.querySelector<HTMLInputElement>('input[type=file]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'tool.exe', { type: 'application/x-msdownload' }));
    expect(screen.getByRole('alert')).toHaveTextContent('“tool.exe”: not a kind of file the team keeps');
    await user.upload(input, new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('plan.pdf')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: '', attachmentIds: [70] })));
});

it('lists what was shared and leads back to its message', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchShared).mockResolvedValue({ more: false, items: [{ messageId: 40, sender: gio, createdAt: minute(1),
        attachment: { id: 9, kind: 'FILE', name: 'budget.pdf', contentType: 'application/pdf', sizeBytes: 4096, url: '/uploads/team-work/b.pdf', thumbUrl: null, width: null, height: null, playUrl: null } }] });
    mount('/team-work/chat?tab=media');
    expect(await screen.findByText('budget.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Files' }));
    await waitFor(() => expect(api.fetchShared).toHaveBeenLastCalledWith('FILE', undefined, expect.anything()));
    await user.click(await screen.findByRole('button', { name: 'Show in chat' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('message=40'));
    expect(api.fetchPage).toHaveBeenLastCalledWith({ around: 40 });
});

it('searches the chat and opens a result at its message', async () => {
    const user = userEvent.setup();
    vi.mocked(api.searchMessages).mockResolvedValue({ more: false, messages: [message(1, { content: 'Morning, the pitch is booked' })] });
    mount('/team-work/chat?find=1');
    await screen.findByText('Morning');
    await user.type(screen.getByRole('searchbox', { name: 'Search words' }), 'pitch');
    await waitFor(() => expect(api.searchMessages).toHaveBeenCalledWith(expect.objectContaining({ q: 'pitch' }), expect.anything()));
    await user.click(await screen.findByRole('button', { name: /the pitch is booked/ }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('message=1'));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

it('shows Team work how many messages wait, without opening the chat', async () => {
    vi.mocked(api.fetchUnread).mockResolvedValue({ firstUnreadId: 7, unreadCount: 3 });
    render(<MemoryRouter><ul><TeamChatNavItem /></ul></MemoryRouter>);
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(api.fetchState).not.toHaveBeenCalled();
});
