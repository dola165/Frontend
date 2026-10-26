import '../../i18n';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../api/axiosConfig';
import * as api from './api';
import { DiscussButton } from './DiscussButton';
import type { LiveHandlers } from './liveChat';
import { TeamChatNavItem } from './TeamChatNavItem';
import { TeamChatPage } from './TeamChatPage';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchHome: vi.fn(), fetchUnread: vi.fn(), fetchTasks: vi.fn(), createChat: vi.fn(), fetchState: vi.fn(),
    renameChat: vi.fn(), setChatStatus: vi.fn(), deleteChat: vi.fn(), restoreChat: vi.fn(), keepFiles: vi.fn(), fetchKept: vi.fn(),
    keptPlayLink: vi.fn(), zipLink: vi.fn(), fetchPage: vi.fn(), fetchChanges: vi.fn(), sendMessage: vi.fn(), editMessage: vi.fn(),
    deleteMessage: vi.fn(), react: vi.fn(), fetchHistory: vi.fn(), markRead: vi.fn(), fetchShared: vi.fn(), searchMessages: vi.fn(),
    uploadPicture: vi.fn(), uploadVideo: vi.fn(), uploadFile: vi.fn(), cancelUpload: vi.fn(), playLink: vi.fn(),
}));
let live: LiveHandlers | null = null;
vi.mock('./liveChat', () => ({ connectLive: (_: number, handlers: LiveHandlers) => { live = handlers; return { typing: vi.fn(), close: vi.fn() }; } }));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source, protectedMediaUrl: (source?: string) => source }));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'one', user: { id: 1 } }) }));

const beqa = { id: 1, name: 'Beqa', avatarUrl: null }, gio = { id: 2, name: 'Gio', avatarUrl: null }, ilo = { id: 3, name: 'Ilo', avatarUrl: null };
const limits: api.ChatLimits = {
    pictureMb: 10, videoMb: 90, fileMb: 25, videoTypes: ['video/mp4', 'video/webm'], fileExtensions: ['pdf', 'txt'], maxLength: 2000, maxAttachments: 10,
    maxDecision: 200,
};
const minute = (n: number) => new Date(Date.now() - (60 - n) * 60_000).toISOString();
const task12: api.ChatTaskRef = {
    id: 12, key: 'GK-12', title: 'Registration', status: 'IN_PROGRESS', parentId: null, doneMeans: 'People can sign up with a code',
};
const summary = (id: number, extra: Partial<api.ChatSummary> = {}): api.ChatSummary => ({
    id, name: `Chat ${id}`, task: null, status: 'TALKING', decision: null, decidedBy: null, decidedAt: null, unreadCount: 0, unreadMentions: 0, messageCount: 2,
    lastActivityAt: minute(id - 40), lastLine: null, createdBy: beqa, createdAt: minute(1), deletesAt: null, deletedBy: null, canDelete: true,
    earlierTask: null, ...extra,
});
const registration = (extra: Partial<api.ChatSummary> = {}) =>
    summary(50, { name: 'Registration', task: task12, unreadCount: 1, lastLine: 'Gio: Morning', ...extra });
const friday = (extra: Partial<api.ChatSummary> = {}) => summary(51, { name: 'Friday plan', ...extra });
const home = (extra: Partial<api.ChatHome> = {}): api.ChatHome => ({
    me: 1, members: [beqa, gio, ilo], chats: [registration(), friday()], deleted: [], keptFiles: 0, limits,
    reactions: ['👍', '❤️', '🎉'], canModerate: false, ...extra,
});
const stateOf = (chat: api.ChatSummary, extra: Partial<api.ChatState> = {}): api.ChatState => ({
    chat, me: 1, members: [beqa, gio, ilo], firstUnreadId: null, unreadCount: 0, revision: 3,
    limits, reactions: ['👍', '❤️', '🎉'], canModerate: false, ...extra,
});
const message = (id: number, extra: Partial<api.ChatMessage> = {}): api.ChatMessage => ({
    id, senderId: 2, senderName: 'Gio', content: `message ${id}`, createdAt: minute(id), editedAt: null, deleted: false, replyTo: null,
    attachments: [], reactions: [], mentions: [], tasks: [], revision: id, clientMessageId: null, ...extra,
});
const file = (id: number, name: string): api.ChatAttachment => ({
    id, kind: 'FILE', name, contentType: 'application/pdf', sizeBytes: 4096, url: `/uploads/team-work/${id}.pdf`,
    thumbUrl: null, width: null, height: null, playUrl: null, kept: false,
});
const page = (messages: api.ChatMessage[]): api.ChatPage => ({ messages, hasOlder: false, hasNewer: false, revision: 3 });

function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname}{location.search}</output>; }
const mount = (path = '/team-work/chat') => render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/team-work/chat" element={<><TeamChatPage /><Where /></>} />
    <Route path="/team-work" element={<Where />} />
</Routes></MemoryRouter>);
const box = () => screen.getByRole('combobox', { name: 'Message the team' });
const where = () => screen.getByTestId('where');
const panel = () => screen.getByRole('complementary', { name: 'About this chat' });
/** The message whose own words are these (not a quote of it). */
const row = (text: string) => [...document.querySelectorAll<HTMLElement>('article')]
    .find(article => article.querySelector('.tc-msg__text')?.textContent?.replace(/ \(edited\)$/, '') === text) as HTMLElement;

beforeEach(() => {
    vi.resetAllMocks();
    live = null;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('gk-session-id', 'one');
    localStorage.setItem('userId', '1');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(api.fetchHome).mockResolvedValue(home());
    vi.mocked(api.fetchState).mockImplementation(async id => stateOf(id === 50 ? registration() : id === 51 ? friday() : summary(id)));
    vi.mocked(api.fetchPage).mockResolvedValue(page([
        message(1, { content: 'Morning' }),
        message(2, { senderId: 1, senderName: 'Beqa', content: '@Gio see GK-12', mentions: [2], tasks: [task12] }),
    ]));
    vi.mocked(api.fetchChanges).mockResolvedValue({ messages: [], revision: 3, more: false });
    vi.mocked(api.markRead).mockResolvedValue({ firstUnreadId: null, unreadCount: 0 });
    vi.mocked(api.fetchShared).mockResolvedValue({ items: [], more: false });
});

it('lists the chats, unread first with their task key and status, and opens the first on a wide screen', async () => {
    mount();
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(where()).toHaveTextContent('chat=50');
    const list = screen.getByRole('navigation', { name: 'Chats' });
    // Media comes first, above the chats.
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Media');
    const rows = within(list).getAllByRole('listitem').filter(row => row.classList.contains('tc-chatrow'));
    expect(rows[0]).toHaveTextContent('GK-12');
    expect(rows[0]).toHaveTextContent('Registration');
    expect(rows[0]).toHaveTextContent('Talking');
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('Friday plan');
    expect(screen.getByRole('heading', { level: 1, name: 'Team chats' })).toBeInTheDocument();
    // The conversation: mentions, and a task key as a link with its name and status.
    expect(screen.getByText('@Gio')).toHaveClass('tc-mention');
    const task = screen.getByRole('link', { name: /^GK-12/ });
    expect(task).toHaveAttribute('href', '/team-work?task=12');
    // The panel: people, the task with what done means, the status.
    expect(within(panel()).getByText('People can sign up with a code')).toBeInTheDocument();
    expect(within(panel()).getByRole('link', { name: 'Open the task' })).toHaveAttribute('href', '/team-work?task=12');
    expect(within(panel()).getByRole('button', { name: 'Talking' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel()).getByRole('region', { name: 'People' })).toHaveTextContent('Ilo');
    // Only the open chat holds a live line.
    await waitFor(() => expect(live).not.toBeNull());
});

it('opens another chat from the list', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Morning');
    vi.mocked(api.fetchPage).mockResolvedValue(page([message(7, { content: 'Pizza at seven' })]));
    await user.click(screen.getByRole('button', { name: /Friday plan/ }));
    expect(await screen.findByText('Pizza at seven')).toBeInTheDocument();
    expect(where()).toHaveTextContent('chat=51');
    expect(api.fetchPage).toHaveBeenLastCalledWith(51, {});
});

it('puts the New line where the unread messages start', async () => {
    vi.mocked(api.fetchState).mockImplementation(async () => stateOf(registration(), { firstUnreadId: 2, unreadCount: 1 }));
    mount();
    await screen.findByText('Morning');
    const line = screen.getByText('New');
    expect(line.closest('[data-unread-line]')).not.toBeNull();
    expect(line.compareDocumentPosition(screen.getByText('@Gio'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('does not exist for someone off the team', async () => {
    vi.mocked(api.fetchHome).mockRejectedValue({ response: { status: 404 } });
    mount();
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
});

it('opens an old link (from when there was one chat) in the oldest chat, at its message', async () => {
    mount('/team-work/chat?message=17');
    await waitFor(() => expect(where()).toHaveTextContent('chat=50'));
    await waitFor(() => expect(api.fetchPage).toHaveBeenCalledWith(50, { around: 17 }));
});

it('starts a chat from a task, or about a general topic', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTasks).mockResolvedValue([{ task: { id: 30, key: 'GK-30', title: 'Map markers', status: 'IN_PROGRESS', parentId: null }, chatId: null },
        { task: { id: 31, key: 'GK-31', title: 'Jobs page', status: 'PLANNED', parentId: null }, chatId: 77 }]);
    vi.mocked(api.createChat).mockImplementation(async body => summary(body.taskId ? 60 : 61, { name: body.name ?? 'Map markers' }));
    mount();
    await screen.findByText('Morning');
    await user.click(screen.getByRole('button', { name: 'Start a chat' }));
    let dialog = await screen.findByRole('dialog', { name: 'Start a chat' });
    expect(await within(dialog).findByText('has a chat')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('searchbox'), 'map');
    expect(within(dialog).queryByText('Jobs page')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /GK-30.*Map markers/ }));
    expect(api.createChat).toHaveBeenCalledWith({ taskId: 30, people: null });
    await waitFor(() => expect(where()).toHaveTextContent('chat=60'));

    await user.click(screen.getByRole('button', { name: 'Start a chat' }));
    dialog = await screen.findByRole('dialog', { name: 'Start a chat' });
    await user.click(within(dialog).getByRole('tab', { name: 'General topic' }));
    await user.type(within(dialog).getByRole('textbox'), 'Friday pizza{Enter}');
    expect(api.createChat).toHaveBeenLastCalledWith({ name: 'Friday pizza', people: null });
    await waitFor(() => expect(where()).toHaveTextContent('chat=61'));
});

it('marks a chat Decided with one line, pinned at the top and written to its task', async () => {
    const user = userEvent.setup();
    vi.mocked(api.setChatStatus).mockImplementation(async (_, status, decision) =>
        registration({ status, decision: decision ?? null, decidedBy: beqa, decidedAt: minute(59) }));
    mount();
    await screen.findByText('Morning');
    await user.click(within(panel()).getByRole('button', { name: 'Decided' }));
    const dialog = await screen.findByRole('dialog', { name: 'What was decided?' });
    expect(dialog).toHaveTextContent('written to GK-12');
    await user.type(within(dialog).getByRole('textbox'), 'Email codes, no SMS');
    await user.click(within(dialog).getByRole('button', { name: 'Mark decided' }));
    expect(api.setChatStatus).toHaveBeenCalledWith(50, 'DECIDED', 'Email codes, no SMS');
    expect(await screen.findByRole('note', { name: 'Decided' })).toHaveTextContent('Email codes, no SMS');
    expect(within(panel()).getByRole('button', { name: 'Decided' })).toHaveAttribute('aria-pressed', 'true');
    // On hold takes no line, and the last decision stays in sight.
    vi.mocked(api.setChatStatus).mockImplementation(async (_, status) =>
        registration({ status, decision: 'Email codes, no SMS', decidedBy: beqa, decidedAt: minute(59) }));
    await user.click(within(panel()).getByRole('button', { name: 'On hold' }));
    expect(api.setChatStatus).toHaveBeenLastCalledWith(50, 'ON_HOLD');
    expect(await screen.findByRole('note', { name: 'Last decision' })).toHaveTextContent('Email codes, no SMS');
});

it('deletes a chat keeping the ticked files, says when it goes, and restores it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchShared).mockResolvedValue({ more: false, items: [
        { attachment: file(9, 'budget.pdf'), messageId: 40, chatId: 50, chatName: 'Registration', sender: gio, createdAt: minute(1) },
        { attachment: file(10, 'draft.pdf'), messageId: 41, chatId: 50, chatName: 'Registration', sender: beqa, createdAt: minute(2) }] });
    vi.mocked(api.deleteChat).mockImplementation(async () => registration({ unreadCount: 0, deletesAt: '2026-11-01T10:00:00Z', deletedBy: beqa }));
    vi.mocked(api.restoreChat).mockImplementation(async () => registration({ unreadCount: 0 }));
    mount();
    await screen.findByText('Morning');
    await user.click(within(panel()).getByRole('button', { name: 'Delete chat…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete “Registration”?' });
    expect(dialog).toHaveTextContent('onto GK-12');
    expect(dialog).toHaveTextContent('7 days');
    await user.click(await within(dialog).findByRole('checkbox', { name: /budget\.pdf/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete chat, keep 1 file' }));
    expect(api.deleteChat).toHaveBeenCalledWith(50, [9]);
    expect(await screen.findByText(/This chat will be deleted on 1 November/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Message the team' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recently deleted/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(api.restoreChat).toHaveBeenCalledWith(50, 'en');
    await waitFor(() => expect(screen.queryByText(/This chat will be deleted/)).not.toBeInTheDocument());
    expect(box()).toBeInTheDocument();
});

it('leaves Delete to whoever started the chat and the team admins', async () => {
    const theirs = registration({ createdBy: gio, canDelete: false });
    vi.mocked(api.fetchHome).mockResolvedValue(home({ chats: [theirs, friday()] }));
    vi.mocked(api.fetchState).mockImplementation(async id => stateOf(id === 50 ? theirs : friday()));
    mount();
    await screen.findByText('Morning');
    expect(within(panel()).queryByRole('button', { name: 'Delete chat…' })).not.toBeInTheDocument();
    expect(panel()).toHaveTextContent('Only Gio, who started it, or a team admin can delete it.');
    expect(within(panel()).getByRole('button', { name: 'Download all files (zip)' })).toBeInTheDocument();
});

it('leaves Restore to them too, while anyone in the chat may still save its files', async () => {
    const user = userEvent.setup();
    // The team's earlier chat, which nobody started: only an admin restores it.
    const gone = registration({ createdBy: null, canDelete: false, unreadCount: 0, deletesAt: '2026-11-01T10:00:00Z', deletedBy: gio });
    vi.mocked(api.fetchHome).mockResolvedValue(home({ chats: [friday()], deleted: [gone] }));
    vi.mocked(api.fetchState).mockImplementation(async id => stateOf(id === 50 ? gone : friday()));
    mount('/team-work/chat?view=deleted');
    const view = await screen.findByRole('region', { name: 'Recently deleted' });
    expect(within(view).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(within(view).getByRole('button', { name: 'Save files' })).toBeInTheDocument();
    expect(view).toHaveTextContent('Only a team admin can restore it.');
    await user.click(within(view).getByRole('button', { name: 'Read it' }));
    const bar = (await screen.findByText(/This chat will be deleted on 1 November/)).closest('.tc-deleted') as HTMLElement;
    expect(within(bar).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Save files' })).toHaveClass('gk-btn--primary');
    expect(bar).toHaveTextContent('Only a team admin can restore it.');
});

it('shows Recently deleted with the day each chat goes, and saves files from there', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchHome).mockResolvedValue(home({ chats: [friday()], deleted: [registration({ deletesAt: '2026-11-01T10:00:00Z', deletedBy: gio })] }));
    vi.mocked(api.fetchShared).mockResolvedValue({
        more: false, items: [{ attachment: file(9, 'budget.pdf'), messageId: 40, chatId: 50, chatName: 'Registration', sender: gio, createdAt: minute(1) }],
    });
    vi.mocked(api.keepFiles).mockImplementation(async () => registration({ deletesAt: '2026-11-01T10:00:00Z', deletedBy: gio }));
    mount('/team-work/chat?view=deleted');
    const view = await screen.findByRole('region', { name: 'Recently deleted' });
    expect(within(view).getByText('Deleted for good on 1 November')).toBeInTheDocument();
    expect(view).toHaveTextContent('deleted by Gio');
    await user.click(within(view).getByRole('button', { name: 'Save files' }));
    const dialog = await screen.findByRole('dialog', { name: 'Keep files' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /budget\.pdf/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Keep 1 file' }));
    expect(api.keepFiles).toHaveBeenCalledWith(50, [9]);
});

it('shows this chat’s media by person and kind, leads back to its message, and on to all media', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchShared).mockResolvedValue({
        more: false, items: [{ attachment: file(9, 'budget.pdf'), messageId: 40, chatId: 50, chatName: 'Registration', sender: gio, createdAt: minute(1) }],
    });
    mount();
    await screen.findByText('Morning');
    await waitFor(() => expect(api.fetchShared).toHaveBeenCalledWith({ chat: 50, kind: null, from: null }, expect.anything()));
    // The panel keeps this chat's media only: everything else is on the Media page.
    expect(within(panel()).queryByRole('button', { name: 'All chats' })).not.toBeInTheDocument();
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Shared by' }), '2');
    await waitFor(() => expect(api.fetchShared).toHaveBeenLastCalledWith({ chat: 50, kind: null, from: 2 }, expect.anything()));
    await user.click(within(panel()).getByRole('button', { name: 'Files' }));
    await waitFor(() => expect(api.fetchShared).toHaveBeenLastCalledWith({ chat: 50, kind: 'FILE', from: 2 }, expect.anything()));
    expect(where()).toHaveTextContent('mkind=FILE');
    await user.click(await within(panel()).findByRole('button', { name: 'Show in chat' }));
    await waitFor(() => expect(where()).toHaveTextContent('message=40'));
    await user.click(within(panel()).getByRole('button', { name: 'All media' }));
    await waitFor(() => expect(where()).toHaveTextContent('view=media'));
    expect(where()).toHaveTextContent('in=chat-50');
});

it('sends a message once, even when the first try got no answer', async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendMessage).mockRejectedValueOnce(new Error('Network Error'))
        .mockImplementationOnce(async (_, body) =>
            message(10, { senderId: 1, senderName: 'Beqa', content: body.content, clientMessageId: body.clientMessageId }));
    mount();
    await screen.findByText('Morning');
    await user.type(box(), 'Hello team{Enter}');
    expect(await screen.findByText('Waiting for the connection…')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(api.sendMessage).mock.calls;
    expect(first[0]).toBe(50);
    expect(second[1].clientMessageId).toBe(first[1].clientMessageId);
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
    vi.mocked(api.editMessage).mockImplementation(async (_, id, content) =>
        message(id, { senderId: 1, senderName: 'Beqa', content, editedAt: new Date().toISOString(), revision: 20 }));
    vi.mocked(api.deleteMessage).mockImplementation(async (_, id) =>
        message(id, { senderId: 1, senderName: 'Beqa', content: '', deleted: true, revision: 21 }));
    mount();
    await screen.findByText('Plan at 18:00');
    await user.click(within(row('Plan at 18:00')).getByLabelText('Edit'));
    expect(box()).toHaveValue('Plan at 18:00');
    await user.clear(box());
    await user.type(box(), 'Plan at 19:00{Enter}');
    expect(api.editMessage).toHaveBeenCalledWith(50, 5, 'Plan at 19:00');
    expect(await screen.findByText('(edited)')).toBeInTheDocument();
    await user.click(within(row('Plan at 19:00')).getByLabelText('More'));
    await user.click(screen.getByRole('menuitem', { name: 'Delete for everyone' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message for everyone?' });
    expect(api.deleteMessage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(api.deleteMessage).toHaveBeenCalledWith(50, 5);
    expect(await screen.findByText('Message deleted')).toBeInTheDocument();
});

it('replies with the message quoted, and reacts', async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendMessage).mockImplementation(async (_, body) => message(11, {
        senderId: 1, senderName: 'Beqa', content: body.content, clientMessageId: body.clientMessageId,
        replyTo: { id: 1, senderId: 2, senderName: 'Gio', excerpt: 'Morning', deleted: false, attachments: 0 },
    }));
    vi.mocked(api.react).mockImplementation(async (_, id, emoji) => message(id, { content: 'Morning', reactions: [{ emoji, userIds: [1] }], revision: 30 }));
    mount();
    await screen.findByText('Morning');
    await user.click(within(row('Morning')).getByLabelText('Reply'));
    expect(screen.getByText('Replying to')).toBeInTheDocument();
    await user.type(box(), 'Morning to you{Enter}');
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith(50, expect.objectContaining({ content: 'Morning to you', replyToId: 1 })));
    await user.click(within(row('Morning')).getByLabelText('React'));
    await user.click(screen.getByRole('button', { name: '👍' }));
    expect(api.react).toHaveBeenCalledWith(50, 1, '👍', true);
    expect(await screen.findByRole('button', { name: /👍 1/ })).toHaveAttribute('aria-pressed', 'true');
});

it('catches up when the live line says something changed', async () => {
    mount();
    await screen.findByText('Morning');
    await waitFor(() => expect(live).not.toBeNull());
    vi.mocked(api.fetchChanges).mockResolvedValue({ messages: [message(4, { content: 'Fresh news', revision: 4 })], revision: 4, more: false });
    act(() => live?.onChanged());
    expect(await screen.findByText('Fresh news')).toBeInTheDocument();
    expect(api.fetchChanges).toHaveBeenLastCalledWith(50, 3);
});

it('uploads a file before sending it with the message, and refuses kinds the team does not keep', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const plan = file(70, 'plan.pdf');
    vi.mocked(api.uploadFile).mockResolvedValue(plan);
    vi.mocked(api.sendMessage).mockImplementation(async (_, body) =>
        message(12, { senderId: 1, senderName: 'Beqa', content: body.content, attachments: [plan], clientMessageId: body.clientMessageId }));
    const { container } = mount();
    await screen.findByText('Morning');
    const input = container.querySelector<HTMLInputElement>('.tc-composer input[type=file]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'tool.exe', { type: 'application/x-msdownload' }));
    expect(screen.getByRole('alert')).toHaveTextContent('“tool.exe”: not a kind of file the team keeps');
    await user.upload(input, new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('plan.pdf')).toBeInTheDocument();
    expect(api.uploadFile).toHaveBeenCalledWith(50, expect.any(File), expect.any(Function), expect.anything());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith(50, expect.objectContaining({ content: '', attachmentIds: [70] })));
});

it('searches the chat and opens a result at its message', async () => {
    const user = userEvent.setup();
    vi.mocked(api.searchMessages).mockResolvedValue({ more: false, messages: [message(1, { content: 'Morning, the pitch is booked' })] });
    mount('/team-work/chat?chat=50&find=1');
    await screen.findByText('Morning');
    await user.type(screen.getByRole('searchbox', { name: 'Search words' }), 'pitch');
    await waitFor(() => expect(api.searchMessages).toHaveBeenCalledWith(50, expect.objectContaining({ q: 'pitch' }), expect.anything()));
    await user.click(await screen.findByRole('button', { name: /the pitch is booked/ }));
    await waitFor(() => expect(where()).toHaveTextContent('message=1'));
    expect(screen.queryByRole('searchbox', { name: 'Search words' })).not.toBeInTheDocument();
});

it('shows Team work how many messages wait in all chats, without opening any', async () => {
    vi.mocked(api.fetchUnread).mockResolvedValue({ unreadCount: 3, unreadMentions: 1, chats: [{ chatId: 50, unreadCount: 3, unreadMentions: 1 }] });
    render(<MemoryRouter><ul><TeamChatNavItem /></ul></MemoryRouter>);
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(api.fetchState).not.toHaveBeenCalled();
});

it('says the true reason when a delete or a restore is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteChat).mockRejectedValue({ response: { status: 403 } });
    mount();
    await screen.findByText('Morning');
    await user.click(within(panel()).getByRole('button', { name: 'Delete chat…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete “Registration”?' });
    expect(dialog).toHaveTextContent('the person who started it or a team admin can restore it');
    expect(dialog).not.toHaveTextContent('anyone can restore it');
    await user.click(within(dialog).getByRole('button', { name: 'Delete chat' }));
    expect(await within(dialog).findByRole('alert'))
        .toHaveTextContent('The chat was not deleted. Only the person who started this chat or a team admin can delete it.');
});

it('restores in the person’s language, and says why a refused restore is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchHome).mockResolvedValue(home({ chats: [friday()], deleted: [registration({ deletesAt: '2026-11-01T10:00:00Z', deletedBy: gio })] }));
    vi.mocked(api.restoreChat).mockRejectedValue({ response: { status: 403 } });
    mount('/team-work/chat?view=deleted');
    const view = await screen.findByRole('region', { name: 'Recently deleted' });
    await user.click(within(view).getByRole('button', { name: 'Restore' }));
    expect(api.restoreChat).toHaveBeenCalledWith(50, 'en');
    expect(await within(view).findByRole('alert'))
        .toHaveTextContent('The chat was not restored. Only the person who started this chat or a team admin can restore it.');
});

it('downloads the zip through its one-time link, so it never sits in the page', async () => {
    const user = userEvent.setup();
    vi.mocked(api.zipLink).mockResolvedValue({ url: '/api/team-chat/zip?t=abc', expiresAt: minute(59) });
    const opened: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { opened.push(this.href); });
    try {
        mount();
        await screen.findByText('Morning');
        await user.click(within(panel()).getByRole('button', { name: 'Download all files (zip)' }));
        await waitFor(() => expect(opened).toEqual([new URL(`${API_BASE_URL.replace(/\/$/, '')}/team-chat/zip?t=abc`, window.location.origin).href]));
        expect(api.zipLink).toHaveBeenCalledWith(50);
    } finally {
        click.mockRestore();
    }
});

it('shows an earlier chat as a general topic that names the task it was about', async () => {
    const earlier = summary(52, { name: 'Registration (earlier)', earlierTask: task12 });
    vi.mocked(api.fetchHome).mockResolvedValue(home({ chats: [registration(), friday(), earlier] }));
    vi.mocked(api.fetchState).mockImplementation(async id => stateOf(id === 52 ? earlier : id === 50 ? registration() : friday()));
    mount('/team-work/chat?chat=52');
    await screen.findByText('Morning');
    expect(panel()).toHaveTextContent('An earlier chat about GK-12, a general topic now: the task’s newer chat is its chat.'.replace('’', "'"));
    expect(within(panel()).getByRole('link', { name: 'Open the task' })).toHaveAttribute('href', '/team-work?task=12');
});

it('keeps the panel’s Media up to date as files come into the open chat', async () => {
    mount();
    await screen.findByText('Morning');
    await waitFor(() => expect(api.fetchShared).toHaveBeenCalledTimes(1));
    vi.mocked(api.fetchChanges).mockResolvedValueOnce({ messages: [message(3, { attachments: [file(9, 'plan.pdf')] })], revision: 4, more: false });
    vi.mocked(api.fetchShared).mockResolvedValue({ more: false, items: [
        { attachment: file(9, 'plan.pdf'), messageId: 3, chatId: 50, chatName: 'Registration', sender: gio, createdAt: minute(3) }] });
    act(() => live?.onChanged());
    expect(await within(panel()).findByText('plan.pdf', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(api.fetchShared).toHaveBeenCalledTimes(2);
});

it('shows a compact Discuss error where it can be seen, and lets it go', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createChat).mockRejectedValue({ response: { status: 500 } });
    render(<MemoryRouter><DiscussButton compact task={{ id: 12, key: 'GK-12' }} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Discuss GK-12 in a chat' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The chat could not open. The server had a problem; try again.');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('Discuss opens a task’s chat, or starts it named after the task', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createChat).mockResolvedValue(summary(90, { name: 'Map markers' }));
    const discuss = (task: { id: number; key: string; chatId?: number | null; chatMessages?: number }) =>
        render(<MemoryRouter initialEntries={['/team-work']}><Routes>
            <Route path="/team-work" element={<DiscussButton task={task} />} />
            <Route path="/team-work/chat" element={<Where />} />
        </Routes></MemoryRouter>);
    const first = discuss({ id: 30, key: 'GK-30', chatId: 77, chatMessages: 12 });
    await user.click(screen.getByRole('button', { name: 'Discuss GK-30: 12 messages' }));
    expect(where()).toHaveTextContent('/team-work/chat?chat=77');
    expect(api.createChat).not.toHaveBeenCalled();
    first.unmount();
    discuss({ id: 31, key: 'GK-31', chatId: null, chatMessages: 0 });
    await user.click(screen.getByRole('button', { name: 'Discuss GK-31 in a chat' }));
    expect(api.createChat).toHaveBeenCalledWith({ taskId: 31 });
    await waitFor(() => expect(where()).toHaveTextContent('/team-work/chat?chat=90'));
});
