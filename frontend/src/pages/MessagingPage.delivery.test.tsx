import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MessagingPage } from './MessagingPage';
import { chatApi, type ConversationDto } from '../api/chat';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-A' }) }));
vi.mock('../features/squadCommunication/api', () => ({ spaces: vi.fn().mockResolvedValue([]) }));

vi.mock('@stomp/stompjs', () => ({ Client: class { activate() {} deactivate() {} connected = false; } }));
vi.mock('../api/axiosConfig', () => ({ buildWebSocketUrl: () => 'ws://localhost/ws-chat' }));
vi.mock('../utils/authStorage', () => ({ getStoredAccessToken: () => 'token', getStoredUserId: () => '1', getAuthSessionId: () => 'session-A', isCurrentAuthSession: (id: string) => id === 'session-A' }));
vi.mock('../components/chat/NewChatModal', () => ({ NewChatModal: () => null }));
vi.mock('../api/chat', () => ({ chatApi: {
    getConversations: vi.fn(), getConversation: vi.fn(), getMessages: vi.fn(), getMessagesAfter: vi.fn(), markAsRead: vi.fn(), sendMessage: vi.fn(), createConversation: vi.fn(),
} }));
const conversation: ConversationDto = {
    id: 7, name: null, contextType: 'DIRECT', contextId: null,
    lastMessage: null, lastMessageSenderId: null, lastMessageSenderName: null, lastMessageAt: null,
    unreadCount: 0, participantCount: 2,
    participants: [{ userId: 1, displayName: 'Me', profilePictureUrl: null, role: null }, { userId: 2, displayName: 'Peer', profilePictureUrl: null, role: null }],
};
beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [conversation] } } as never);
    vi.mocked(chatApi.getConversation).mockResolvedValue({ data: conversation } as never);
    vi.mocked(chatApi.getMessages).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.getMessagesAfter).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
});
it('keeps the draft after a lost acknowledgement and shows it once after retry, even without live connection', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    const input = await screen.findByPlaceholderText('Type a message...');
    await screen.findByText('No messages yet. Say hello!');
    await user.type(input, 'Keep this draft');
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(new Error('response lost'));
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('alert');
    expect(input).toHaveValue('Keep this draft');
    const key = vi.mocked(chatApi.sendMessage).mock.calls[0][2];
    vi.mocked(chatApi.sendMessage).mockResolvedValueOnce({ data: { id: 12, conversationId: 7, senderId: 1, senderName: 'Me', content: 'Keep this draft', createdAt: '2026-09-09T12:00:00' } } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(chatApi.sendMessage).toHaveBeenLastCalledWith(7, 'Keep this draft', key);
    expect(within(screen.getByRole('log', { name: 'Conversation messages' })).getAllByText('Keep this draft')).toHaveLength(1);
});
it('retains each conversation draft when switching', async () => {
    const second = { ...conversation, id: 8, participants: [conversation.participants[0], { ...conversation.participants[1], userId: 3, displayName: 'Other peer' }] };
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [conversation, second] } } as never);
    render(<MemoryRouter><MessagingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Peer'));
    fireEvent.change(await screen.findByPlaceholderText('Type a message...'), { target: { value: 'First draft' } });
    fireEvent.click(screen.getByText('Other peer'));
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toHaveValue(''));
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'Second draft' } });
    fireEvent.click(screen.getByText('Peer'));
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toHaveValue('First draft'));
    await act(async () => {});
});

it('opens a profile chat link when the inbox is empty', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.createConversation).mockResolvedValue({ data: conversation } as never);
    render(<MemoryRouter initialEntries={['/messages?chatWith=2']}><MessagingPage /></MemoryRouter>);
    await screen.findByPlaceholderText('Type a message...');
    expect(chatApi.createConversation).toHaveBeenCalledWith({ contextType: 'DIRECT', participantIds: [2] });
    await waitFor(() => expect(chatApi.getMessages).toHaveBeenCalledWith(7));
});
