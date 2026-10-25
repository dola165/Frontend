import '../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as chatApi from '../teamChat/api';
import { TeamChatPage } from '../teamChat/TeamChatPage';
import type { SavedCopy } from './api';

/**
 * The chat hand-off end to end on the real chat page: Edit in a chat's picture viewer, Save as new, and the copy waits
 * in that chat's message box as a ready file answering the original, the box focused; Send carries both. A chat in
 * Recently deleted offers no Edit. The editor itself (which needs a real canvas) is a stand-in that saves at once.
 */
vi.mock('../teamChat/api', async importOriginal => ({
    ...await importOriginal<typeof chatApi>(), fetchHome: vi.fn(), fetchUnread: vi.fn(), fetchTasks: vi.fn(), createChat: vi.fn(), fetchState: vi.fn(), renameChat: vi.fn(),
    setChatStatus: vi.fn(), deleteChat: vi.fn(), restoreChat: vi.fn(), keepFiles: vi.fn(), fetchKept: vi.fn(), keptPlayLink: vi.fn(), fetchPage: vi.fn(), fetchChanges: vi.fn(),
    sendMessage: vi.fn(), editMessage: vi.fn(), deleteMessage: vi.fn(), react: vi.fn(), fetchHistory: vi.fn(), markRead: vi.fn(), fetchShared: vi.fn(), searchMessages: vi.fn(),
    uploadPicture: vi.fn(), uploadVideo: vi.fn(), uploadFile: vi.fn(), cancelUpload: vi.fn(), playLink: vi.fn(),
}));
vi.mock('../teamChat/liveChat', () => ({ connectLive: () => ({ typing: vi.fn(), close: vi.fn() }) }));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source, protectedMediaUrl: (source?: string) => source }));
vi.mock('../../pages/RouteRecoveryPage', () => ({ RouteRecoveryPage: () => <p>Page not found</p> }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'one', user: { id: 1 } }) }));
vi.mock('./api', () => ({ saveCopy: vi.fn(), editsOf: vi.fn(async () => []) }));

const draft: chatApi.ChatAttachment = { id: 99, kind: 'IMAGE', name: 'pitch-edited.jpg', contentType: 'image/jpeg', sizeBytes: 52_000, url: '/uploads/team-work/copy.jpg',
    thumbUrl: null, width: 640, height: 480, playUrl: null, kept: false };
const savedCopy: SavedCopy = { url: draft.url, thumbUrl: null, originalUrl: '/uploads/pitch.jpg', place: 'CHAT', itemId: null, chatId: 51, replyToId: 12, attachment: draft,
    editedBy: { id: 1, name: 'Beqa' }, editedAt: new Date().toISOString() };
const editorPlace = vi.hoisted(() => ({ last: null as unknown }));
vi.mock('./editorLoader', () => ({
    loadEditor: async () => ({ default: ({ media, onSaved, onClose }: { media: { place?: unknown }; onSaved: (saved: SavedCopy, file: File) => void; onClose: () => void }) => {
        editorPlace.last = media.place;
        return <div role="dialog" aria-label="Edit picture"><button type="button" onClick={() => { onSaved(savedCopy, new File(['x'], 'pitch-edited.jpg', { type: 'image/jpeg' })); onClose(); }}>Save as new</button></div>;
    } }),
}));

const beqa = { id: 1, name: 'Beqa', avatarUrl: null }, gio = { id: 2, name: 'Gio', avatarUrl: null };
const limits: chatApi.ChatLimits = { pictureMb: 10, videoMb: 90, fileMb: 25, videoTypes: ['video/mp4'], fileExtensions: ['pdf'], maxLength: 2000, maxAttachments: 10, maxDecision: 200 };
const at = new Date().toISOString();
const chat = (extra: Partial<chatApi.ChatSummary> = {}): chatApi.ChatSummary => ({
    id: 51, name: 'Kit', task: null, status: 'TALKING', decision: null, decidedBy: null, decidedAt: null, unreadCount: 0, unreadMentions: 0, messageCount: 1,
    lastActivityAt: at, lastLine: null, createdBy: beqa, createdAt: at, deletesAt: null, deletedBy: null, canDelete: true, ...extra,
});
const picture: chatApi.ChatAttachment = { id: 7, kind: 'IMAGE', name: 'pitch.jpg', contentType: 'image/jpeg', sizeBytes: 80_000, url: '/uploads/pitch.jpg', thumbUrl: null,
    width: 640, height: 480, playUrl: null, kept: false };
const original: chatApi.ChatMessage = { id: 12, senderId: 2, senderName: 'Gio', content: 'Saturday list', createdAt: at, editedAt: null, deleted: false, replyTo: null,
    attachments: [picture], reactions: [], mentions: [], tasks: [], revision: 12, clientMessageId: null };

const mount = (summary: chatApi.ChatSummary) => {
    vi.mocked(chatApi.fetchHome).mockResolvedValue({ me: 1, members: [beqa, gio], chats: summary.deletesAt ? [] : [summary], deleted: summary.deletesAt ? [summary] : [], keptFiles: 0,
        limits, reactions: ['👍'], canModerate: false });
    vi.mocked(chatApi.fetchState).mockResolvedValue({ chat: summary, me: 1, members: [beqa, gio], firstUnreadId: null, unreadCount: 0, revision: 12, limits, reactions: ['👍'], canModerate: false });
    return render(<MemoryRouter initialEntries={['/team-work/chat?chat=51']}><Routes><Route path="/team-work/chat" element={<TeamChatPage />} /></Routes></MemoryRouter>);
};

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    localStorage.setItem('gk-session-id', 'one');
    localStorage.setItem('userId', '1');
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(chatApi.fetchPage).mockResolvedValue({ messages: [original], hasOlder: false, hasNewer: false, revision: 12 });
    vi.mocked(chatApi.fetchChanges).mockResolvedValue({ messages: [], revision: 12, more: false });
    vi.mocked(chatApi.markRead).mockResolvedValue({ firstUnreadId: null, unreadCount: 0 });
    vi.mocked(chatApi.fetchShared).mockResolvedValue({ items: [], more: false });
    vi.mocked(chatApi.sendMessage).mockImplementation(async (_chat, body) => ({ ...original, id: 13, senderId: 1, senderName: 'Beqa', content: body.content, replyTo: null, attachments: [draft], clientMessageId: body.clientMessageId }));
});

it('puts the saved copy in the chat’s message box as a ready reply to the original, the box focused, and sends both', async () => {
    mount(chat());
    await userEvent.click(await screen.findByRole('button', { name: 'Open pitch.jpg' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save as new' }));
    expect(editorPlace.last).toEqual({ messageId: 12 });

    const tray = await screen.findByRole('list', { name: 'Files to send' });
    expect(within(tray).getByText('pitch-edited.jpg')).toBeInTheDocument();
    expect(screen.getByText('Replying to')).toBeInTheDocument();
    const box = screen.getByRole('combobox', { name: 'Message the team' });
    await waitFor(() => expect(box).toHaveFocus());
    expect(chatApi.sendMessage).not.toHaveBeenCalled();

    await userEvent.type(box, 'Names hidden{Enter}');
    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalled());
    expect(vi.mocked(chatApi.sendMessage).mock.calls[0][1]).toMatchObject({ content: 'Names hidden', replyToId: 12, attachmentIds: [99] });
});

it('offers no Edit for a picture in a chat waiting in Recently deleted', async () => {
    mount(chat({ deletesAt: new Date(Date.now() + 86_400_000).toISOString(), deletedBy: beqa }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open pitch.jpg' }));
    expect(await screen.findByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
});
