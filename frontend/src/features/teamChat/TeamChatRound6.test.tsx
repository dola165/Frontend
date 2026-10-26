import '../../i18n';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import * as work from '../teamWork/api';
import { DiscussButton } from './DiscussButton';
import type { LiveHandlers } from './liveChat';
import { TeamChatPage } from './TeamChatPage';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), fetchHome: vi.fn(), fetchUnread: vi.fn(), fetchTasks: vi.fn(), createChat: vi.fn(), fetchState: vi.fn(),
    renameChat: vi.fn(), setChatStatus: vi.fn(), deleteChat: vi.fn(), restoreChat: vi.fn(), keepFiles: vi.fn(), fetchKept: vi.fn(),
    keptPlayLink: vi.fn(), zipLink: vi.fn(), fetchPage: vi.fn(), fetchChanges: vi.fn(), sendMessage: vi.fn(), editMessage: vi.fn(),
    deleteMessage: vi.fn(), react: vi.fn(), fetchHistory: vi.fn(), markRead: vi.fn(), fetchShared: vi.fn(), searchMessages: vi.fn(),
    uploadPicture: vi.fn(), uploadVideo: vi.fn(), uploadFile: vi.fn(), cancelUpload: vi.fn(), playLink: vi.fn(),
    setAudience: vi.fn(), addPeople: vi.fn(), removePerson: vi.fn(), fetchMedia: vi.fn(), fetchTags: vi.fn(), labelMedia: vi.fn(),
}));
vi.mock('../teamWork/api', async importOriginal => ({ ...await importOriginal<typeof work>(), fetchBoard: vi.fn(), fetchNow: vi.fn() }));
vi.mock('./liveChat', () => ({ connectLive: (_: number, handlers: LiveHandlers) => { void handlers; return { typing: vi.fn(), close: vi.fn() }; } }));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source, protectedMediaUrl: (source?: string) => source }));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'one', user: { id: 1 } }) }));

const beqa = { id: 1, name: 'Beqa', avatarUrl: null }, gio = { id: 2, name: 'Gio', avatarUrl: null }, ilo = { id: 3, name: 'Ilo', avatarUrl: null };
const limits: api.ChatLimits = {
    pictureMb: 10, videoMb: 90, fileMb: 25, videoTypes: ['video/mp4', 'video/webm'], fileExtensions: ['pdf', 'txt'], maxLength: 2000, maxAttachments: 10, maxDecision: 200,
};
const minute = (n: number) => new Date(Date.now() - (60 - n) * 60_000).toISOString();
const task12: api.ChatTaskRef = { id: 12, key: 'GK-12', title: 'Registration', status: 'IN_PROGRESS', parentId: null, doneMeans: null };
const summary = (id: number, extra: Partial<api.ChatSummary> = {}): api.ChatSummary => ({
    id, name: `Chat ${id}`, task: null, status: 'TALKING', decision: null, decidedBy: null, decidedAt: null, unreadCount: 0, unreadMentions: 0, messageCount: 2,
    lastActivityAt: minute(id - 40), lastLine: null, createdBy: beqa, createdAt: minute(1), deletesAt: null, deletedBy: null, canDelete: true,
    earlierTask: null, audience: 'EVERYONE', canManagePeople: true, ...extra,
});
const registration = (extra: Partial<api.ChatSummary> = {}) => summary(50, { name: 'Registration', task: task12, unreadCount: 1, lastLine: 'Gio: Morning', ...extra });
const friday = (extra: Partial<api.ChatSummary> = {}) => summary(51, { name: 'Friday plan', ...extra });
const home = (extra: Partial<api.ChatHome> = {}): api.ChatHome => ({
    me: 1, members: [beqa, gio, ilo], chats: [registration(), friday()], deleted: [], keptFiles: 0, limits, reactions: ['👍', '❤️'], canModerate: false, ...extra,
});
const stateOf = (chat: api.ChatSummary, extra: Partial<api.ChatState> = {}): api.ChatState => ({
    chat, me: 1, members: [beqa, gio, ilo], firstUnreadId: null, unreadCount: 0, revision: 3, limits, reactions: ['👍', '❤️'], canModerate: false, ...extra,
});
const message = (id: number, extra: Partial<api.ChatMessage> = {}): api.ChatMessage => ({
    id, senderId: 2, senderName: 'Gio', content: `message ${id}`, createdAt: minute(id), editedAt: null, deleted: false, replyTo: null,
    attachments: [], reactions: [], mentions: [], tasks: [], revision: id, clientMessageId: null, ...extra,
});
const picture = (id: number, extra: Partial<api.ChatAttachment> = {}): api.ChatAttachment => ({
    id, kind: 'IMAGE', name: `IMG_${id}.jpg`, contentType: 'image/jpeg', sizeBytes: 4096, url: `/uploads/team-work/${id}.jpg`,
    thumbUrl: null, width: 640, height: 480, playUrl: null, kept: false, title: null, tags: [], labelledBy: null, labelledAt: null, ...extra,
});
const item = (source: api.MediaSource, attachment: api.ChatAttachment, extra: Partial<api.MediaItem> = {}): api.MediaItem => ({
    source, attachment, sender: gio, at: minute(5), chatId: source === 'CHAT' ? 51 : null, chatName: source === 'CHAT' ? 'Friday plan' : null,
    messageId: source === 'CHAT' ? 40 : null, task: source === 'TASK' ? task12 : null, keptFrom: source === 'KEPT' ? 'Old chat' : null, ...extra,
});
const page = (messages: api.ChatMessage[]): api.ChatPage => ({ messages, hasOlder: false, hasNewer: false, revision: 3 });

function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname}{location.search}</output>; }
const mount = (path = '/team-work/chat') => render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/team-work/chat" element={<><TeamChatPage /><Where /></>} />
    <Route path="/team-work" element={<Where />} />
</Routes></MemoryRouter>);
const where = () => screen.getByTestId('where');
const panel = () => screen.getByRole('complementary', { name: 'About this chat' });
const menu = () => screen.getByRole('menu');
const rightClick = (element: Element) => fireEvent.contextMenu(element, { clientX: 20, clientY: 20 });

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('gk-session-id', 'one');
    localStorage.setItem('userId', '1');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(api.fetchHome).mockResolvedValue(home());
    vi.mocked(api.fetchState).mockImplementation(async id => stateOf(id === 50 ? registration() : id === 51 ? friday() : summary(id)));
    vi.mocked(api.fetchPage).mockResolvedValue(page([message(1, { content: 'Morning' })]));
    vi.mocked(api.fetchChanges).mockResolvedValue({ messages: [], revision: 3, more: false });
    vi.mocked(api.markRead).mockResolvedValue({ firstUnreadId: null, unreadCount: 0 });
    vi.mocked(api.fetchShared).mockResolvedValue({ items: [], more: false });
    vi.mocked(api.fetchTags).mockResolvedValue([{ tag: 'stadium', uses: 3 }, { tag: 'kit', uses: 1 }]);
    vi.mocked(api.fetchMedia).mockResolvedValue({ items: [], next: null });
    vi.mocked(api.fetchTasks).mockResolvedValue([]);
});

it('opens Media above the chats, with every filter in the address', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchMedia).mockResolvedValue({
        next: null, items: [
            item('CHAT', picture(7, { title: 'Dinamo arena entrance', tags: ['stadium'] })),
            item('TASK', picture(8)),
        ],
    });
    mount();
    await screen.findByText('Morning');
    await user.click(within(screen.getByRole('navigation', { name: 'Chats' })).getByRole('button', { name: /^Media/ }));
    await waitFor(() => expect(where()).toHaveTextContent('view=media'));
    expect(where()).not.toHaveTextContent('chat=50');
    const media = await screen.findByRole('region', { name: 'Media' });
    expect(await within(media).findByText('Dinamo arena entrance')).toBeInTheDocument();
    expect(within(media).getByText('stadium')).toBeInTheDocument();
    expect(within(media).getByText('IMG_8.jpg')).toBeInTheDocument();
    expect(api.fetchMedia).toHaveBeenLastCalledWith({ chat: null, place: 'ALL', kind: null, from: null, tag: null, q: null }, null, expect.anything());

    await user.selectOptions(within(media).getByRole('combobox', { name: 'Where' }), 'chat-51');
    await waitFor(() => expect(where()).toHaveTextContent('in=chat-51'));
    expect(api.fetchMedia).toHaveBeenLastCalledWith(expect.objectContaining({ chat: 51, place: 'CHATS' }), null, expect.anything());
    await user.selectOptions(within(media).getByRole('combobox', { name: 'Shared by' }), '2');
    await user.click(within(media).getByRole('button', { name: 'Pictures' }));
    await waitFor(() => expect(where()).toHaveTextContent('mkind=IMAGE'));
    expect(where()).toHaveTextContent('mfrom=2');
    await user.type(within(media).getByRole('searchbox', { name: 'Name' }), 'arena');
    await waitFor(() => expect(where()).toHaveTextContent('mq=arena'));
    await user.type(within(media).getByRole('combobox', { name: 'Tag' }), 'stadium');
    await waitFor(() => expect(where()).toHaveTextContent('mtag=stadium'));
    expect(api.fetchMedia).toHaveBeenLastCalledWith({ chat: 51, place: 'CHATS', kind: 'IMAGE', from: 2, tag: 'stadium', q: 'arena' }, null, expect.anything());
    await user.click(within(media).getByRole('button', { name: 'Show everything' }));
    await waitFor(() => expect(where()).not.toHaveTextContent('mq='));
    expect(where()).not.toHaveTextContent('in=');
});

it('right-click a picture to go where it lives, name it, or edit it; a kept one says why it stays as it is', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchMedia).mockResolvedValue({
        next: null, items: [item('CHAT', picture(7)), item('TASK', picture(8)), item('KEPT', picture(9))],
    });
    mount('/team-work/chat?view=media');
    const media = await screen.findByRole('region', { name: 'Media' });
    rightClick(await within(media).findByRole('button', { name: /IMG_7\.jpg/ }));
    expect(within(menu()).getAllByRole('menuitem').map(entry => entry.textContent)).toEqual(['Open', 'Show in chat', 'Name and tags…', 'Download', 'Edit picture']);
    await user.keyboard('{Escape}');
    rightClick(within(media).getByRole('button', { name: /IMG_8\.jpg/ }));
    expect(within(menu()).getByRole('menuitem', { name: 'Open the task' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    rightClick(within(media).getByRole('button', { name: /IMG_9\.jpg/ }));
    const edit = within(menu()).getByRole('menuitem', { name: /Edit picture/ });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit).toHaveAccessibleDescription('A kept picture stays as it was kept.');
    await user.keyboard('{Escape}');
    rightClick(within(media).getByRole('button', { name: /IMG_7\.jpg/ }));
    await user.click(within(menu()).getByRole('menuitem', { name: 'Show in chat' }));
    await waitFor(() => expect(where()).toHaveTextContent('chat=51'));
    expect(where()).toHaveTextContent('message=40');
    expect(where()).not.toHaveTextContent('view=media');
});

it('names and tags a picture, with tags suggested from those in use', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchMedia).mockResolvedValue({ next: null, items: [item('CHAT', picture(7, { tags: ['old'] }))] });
    vi.mocked(api.labelMedia).mockResolvedValue({ title: 'Gate', tags: ['old', 'dinamo arena', 'stadium'], labelledBy: beqa, labelledAt: minute(9) });
    mount('/team-work/chat?view=media');
    const media = await screen.findByRole('region', { name: 'Media' });
    rightClick(await within(media).findByRole('button', { name: /IMG_7\.jpg/ }));
    await user.click(within(menu()).getByRole('menuitem', { name: 'Name and tags…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Name and tags' });
    expect(dialog).toHaveTextContent('IMG_7.jpg');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Gate');
    await user.type(within(dialog).getByRole('textbox', { name: /Tags/ }), '#Dinamo  Arena,');
    expect(within(dialog).getByRole('list', { name: 'Its tags' })).toHaveTextContent('dinamo arena');
    await user.click(await within(dialog).findByRole('button', { name: /stadium/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(api.labelMedia).toHaveBeenCalledWith('CHAT', 7, { title: 'Gate', tags: ['old', 'dinamo arena', 'stadium'] });
    expect(await within(media).findByText('Gate')).toBeInTheDocument();
    expect(within(media).getByText('dinamo arena')).toBeInTheDocument();
});

it('starts a chat for everyone, or for the people chosen', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTasks).mockResolvedValue([]);
    vi.mocked(api.createChat).mockResolvedValue(summary(60, { name: 'Salaries', audience: 'CHOSEN' }));
    mount('/team-work/chat?start=topic');
    const dialog = await screen.findByRole('dialog', { name: 'Start a chat' });
    expect(within(dialog).getByRole('radio', { name: /Everyone on the team/ })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: /Chosen people/ }));
    expect(within(dialog).queryByRole('checkbox', { name: 'Beqa' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Gio' }));
    await user.type(within(dialog).getByRole('textbox'), 'Salaries{Enter}');
    expect(api.createChat).toHaveBeenCalledWith({ name: 'Salaries', people: [2] });
    await waitFor(() => expect(where()).toHaveTextContent('chat=60'));
    expect(where()).not.toHaveTextContent('start=');
});

it('closes the start dialog once the chat is started, even when it is the first chat', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTasks).mockResolvedValue([]);
    vi.mocked(api.fetchHome).mockResolvedValueOnce(home({ chats: [] })).mockResolvedValue(home({ chats: [summary(60, { name: 'First' })] }));
    vi.mocked(api.fetchState).mockResolvedValue(stateOf(summary(60, { name: 'First' })));
    vi.mocked(api.createChat).mockResolvedValue(summary(60, { name: 'First' }));
    mount('/team-work/chat?start=topic');
    const dialog = await screen.findByRole('dialog', { name: 'Start a chat' });
    await user.type(within(dialog).getByRole('textbox'), 'First{Enter}');
    await waitFor(() => expect(where()).toHaveTextContent('chat=60'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Start a chat' })).not.toBeInTheDocument());
    expect(where()).not.toHaveTextContent('start=');
});

it('chooses who is in a chat: remove with a check first, add team members, open it to everyone, leave it', async () => {
    const user = userEvent.setup();
    const chosen = registration({ audience: 'CHOSEN' });
    vi.mocked(api.fetchState).mockResolvedValue(stateOf(chosen, { members: [beqa, gio] }));
    vi.mocked(api.removePerson).mockResolvedValueOnce({ chat: chosen, members: [beqa] });
    vi.mocked(api.addPeople).mockResolvedValue({ chat: chosen, members: [beqa, ilo] });
    mount('/team-work/chat?chat=50');
    await screen.findByText('Morning');
    const people = within(panel()).getByRole('region', { name: 'People' });
    expect(people).toHaveTextContent('Chosen people');
    await user.click(within(people).getByRole('button', { name: 'Remove Gio from the chat' }));
    let check = await screen.findByRole('alertdialog', { name: 'Remove Gio from the chat?' });
    await user.click(within(check).getByRole('button', { name: 'Remove' }));
    expect(api.removePerson).toHaveBeenCalledWith(50, 2);
    await waitFor(() => expect(within(people).queryByText('Gio')).not.toBeInTheDocument());
    // The last one stays.
    expect(within(people).getByRole('button', { name: 'Leave the chat' })).toBeDisabled();
    await user.click(within(people).getByRole('button', { name: 'Add people…' }));
    const adding = await screen.findByRole('dialog', { name: 'Add people' });
    expect(within(adding).queryByRole('checkbox', { name: 'Beqa' })).not.toBeInTheDocument();
    await user.click(within(adding).getByRole('checkbox', { name: 'Ilo' }));
    await user.click(within(adding).getByRole('button', { name: 'Add 1' }));
    expect(api.addPeople).toHaveBeenCalledWith(50, [3]);
    expect(await within(people).findByText('Ilo')).toBeInTheDocument();
    vi.mocked(api.setAudience).mockResolvedValue({ chat: registration(), members: [beqa, gio, ilo] });
    await user.click(within(people).getByRole('button', { name: 'Open to everyone' }));
    check = await screen.findByRole('alertdialog', { name: 'Open this chat to everyone on the team?' });
    await user.click(within(check).getByRole('button', { name: 'Open to everyone' }));
    expect(api.setAudience).toHaveBeenCalledWith(50, 'EVERYONE');
    await waitFor(() => expect(people).toHaveTextContent('Everyone on the team'));
    expect(within(people).getByRole('button', { name: 'Choose people' })).toBeInTheDocument();
});

it('says a chosen task chat’s kept files stay with its people on the shelf, never on the task', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchState).mockResolvedValue(stateOf(registration({ audience: 'CHOSEN' }), { members: [beqa, gio] }));
    mount('/team-work/chat?chat=50');
    await screen.findByText('Morning');
    await user.click(within(panel()).getByRole('button', { name: 'Delete chat…' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Delete/ });
    expect(dialog).toHaveTextContent('onto the Kept files shelf, for this chat’s people only, never onto its task');
    expect(dialog).not.toHaveTextContent('onto GK-12');
});

it('leaves a chat for chosen people and goes back to the chats', async () => {
    const user = userEvent.setup();
    const chosen = friday({ audience: 'CHOSEN', canManagePeople: false, createdBy: gio });
    vi.mocked(api.fetchState).mockResolvedValue(stateOf(chosen, { members: [beqa, gio] }));
    vi.mocked(api.removePerson).mockResolvedValue(null);
    mount('/team-work/chat?chat=51');
    await screen.findByText('Morning');
    const people = within(panel()).getByRole('region', { name: 'People' });
    expect(people).toHaveTextContent('Only Gio, who started it, or a team admin chooses who is in it.');
    expect(within(people).queryByRole('button', { name: 'Add people…' })).not.toBeInTheDocument();
    await user.click(within(people).getByRole('button', { name: 'Leave the chat' }));
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Leave this chat?' })).getByRole('button', { name: 'Leave' }));
    expect(api.removePerson).toHaveBeenCalledWith(51, 1);
    await waitFor(() => expect(where()).not.toHaveTextContent('chat=51'));
});

it('right-click a person for their profile, tasks or Now note in a sheet; Back and Escape return to the chat', async () => {
    const user = userEvent.setup();
    vi.mocked(work.fetchBoard).mockResolvedValue({
        items: [{ id: 30, key: 'GK-30', title: 'Map markers', status: 'IN_PROGRESS', people: [{ id: 2, name: 'Gio' }], parentId: null, updatedAt: minute(3), openQuestions: 0 } as unknown as work.WorkItem],
        trail: [], canManageTeam: false, team: [{ userId: 2, name: 'Gio', email: 'gio@example.test', admin: false, addedAt: null, pending: false, responsibility: 'Maps', now: 'Markers today', nowAt: minute(2) }],
    });
    mount('/team-work/chat?chat=50');
    await screen.findByText('Morning');
    rightClick(within(panel()).getByRole('button', { name: 'Gio' }));
    expect(within(menu()).getByRole('menuitem', { name: 'Remove from the chat' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(menu()).getByRole('menuitem', { name: 'See their Team work tasks' }));
    await waitFor(() => expect(where()).toHaveTextContent('person=2'));
    expect(where()).toHaveTextContent('ptab=tasks');
    const sheet = await screen.findByRole('dialog', { name: /Gio/ });
    expect(await within(sheet).findByText('Map markers')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('tab', { name: 'Profile' }));
    expect(await within(sheet).findByText('Markers today')).toBeInTheDocument();
    expect(where()).toHaveTextContent('ptab=profile');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Gio/ })).not.toBeInTheDocument());
    expect(where()).not.toHaveTextContent('person=');
    expect(where()).toHaveTextContent('chat=50');
    expect(screen.getByText('Morning')).toBeInTheDocument();
});

it('right-click a chat to mark it read, set its status or delete it; a task’s chat is renamed with its task', async () => {
    const user = userEvent.setup();
    vi.mocked(api.setChatStatus).mockResolvedValue(registration({ status: 'ON_HOLD' }));
    mount('/team-work/chat?chat=51');
    await screen.findByText('Morning');
    const list = screen.getByRole('navigation', { name: 'Chats' });
    rightClick(within(list).getByRole('button', { name: /^Registration/ }));
    expect(within(menu()).getByRole('menuitem', { name: /Rename/ })).toHaveAccessibleDescription('Named after GK-12; rename the task.');
    await user.click(within(menu()).getByRole('menuitem', { name: 'Mark as read' }));
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith(50, Number.MAX_SAFE_INTEGER));
    rightClick(within(list).getByRole('button', { name: /^Registration/ }));
    await user.click(within(menu()).getByRole('menuitem', { name: 'Status: On hold' }));
    expect(api.setChatStatus).toHaveBeenCalledWith(50, 'ON_HOLD');
    rightClick(within(list).getByRole('button', { name: /^Friday plan/ }));
    expect(within(menu()).getByRole('menuitem', { name: 'Mark as read' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    // The empty column starts a chat.
    rightClick(within(list).getByRole('heading', { name: 'Chats' }));
    await user.click(within(menu()).getByRole('menuitem', { name: 'Start a chat about a task' }));
    await waitFor(() => expect(where()).toHaveTextContent('start=task'));
});

it('right-click a message: reply, copy, and moderators delete anyone’s; the chat’s own lines are quiet and worded for the reader', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchState).mockResolvedValue(stateOf(registration(), { canModerate: true }));
    vi.mocked(api.fetchPage).mockResolvedValue(page([
        message(1, { content: 'Morning' }),
        message(2, { senderId: 1, senderName: 'Beqa', content: '', event: { kind: 'ADDED', by: beqa, people: [ilo] } }),
        message(3, { content: 'Welcome Ilo', senderId: 2 }),
    ]));
    mount('/team-work/chat?chat=50');
    expect(await screen.findByText('You added Ilo')).toBeInTheDocument();
    const welcome = screen.getByText('Welcome Ilo').closest('article') as HTMLElement;
    rightClick(welcome);
    const items = within(menu()).getAllByRole('menuitem').map(entry => entry.textContent);
    expect(items).toEqual(['Reply', 'React…', 'Copy text', 'Copy link', 'Delete for everyone (moderator)']);
    await user.click(within(menu()).getByRole('menuitem', { name: 'Reply' }));
    expect(await screen.findByText('Replying to')).toHaveTextContent('Replying to Gio');
    // The chat's own line has no menu of its own, and is never grouped with a message.
    expect(screen.getByText('You added Ilo').closest('article')).toBeNull();
});

it('a task’s chat for chosen people you are not in says so instead of opening', () => {
    render(<MemoryRouter><DiscussButton task={{ id: 30, key: 'GK-30', chatPrivate: true }} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /GK-30: This task’s chat is for the people chosen for it/ });
    expect(button).toBeDisabled();
    act(() => { button.click(); });
    expect(api.createChat).not.toHaveBeenCalled();
});
