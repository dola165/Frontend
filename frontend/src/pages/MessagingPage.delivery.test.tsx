import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MessagingPage } from './MessagingPage';
import { chatApi, type ConversationDto } from '../api/chat';
import i18n from '../i18n';

const auth = vi.hoisted(() => ({ sessionId: 'session-A', userId: '1' }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../features/squadCommunication/api', () => ({ spaces: vi.fn().mockResolvedValue([]) }));

vi.mock('@stomp/stompjs', () => ({ Client: class { activate() {} deactivate() {} connected = false; } }));
vi.mock('../api/axiosConfig', () => ({ buildWebSocketUrl: () => 'ws://localhost/ws-chat' }));
vi.mock('../utils/authStorage', () => ({ getStoredAccessToken: () => 'token', getStoredUserId: () => auth.userId, getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../components/chat/NewChatModal', () => ({ NewChatModal: () => null }));
vi.mock('../api/chat', () => ({ chatApi: {
    getConversations: vi.fn(), getConversation: vi.fn(), getMessages: vi.fn(), getMessagesAfter: vi.fn(), markAsRead: vi.fn(), sendMessage: vi.fn(), createConversation: vi.fn(), leaveConversation: vi.fn(), getPendingSuggestions: vi.fn(),
} }));
const conversation: ConversationDto = {
    id: 7, name: null, contextType: 'DIRECT', contextId: null,
    lastMessage: null, lastMessageSenderId: null, lastMessageSenderName: null, lastMessageAt: null,
    unreadCount: 0, participantCount: 2,
    participants: [{ userId: 1, displayName: 'Me', profilePictureUrl: null, role: null }, { userId: 2, displayName: 'Peer', profilePictureUrl: null, role: null }],
};
beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    auth.sessionId = 'session-A';
    auth.userId = '1';
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [conversation] } } as never);
    vi.mocked(chatApi.getConversation).mockResolvedValue({ data: conversation } as never);
    vi.mocked(chatApi.getMessages).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.getMessagesAfter).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
    vi.mocked(chatApi.getPendingSuggestions).mockResolvedValue({ data: [] } as never);
});
afterEach(async () => { await i18n.changeLanguage('en'); });
it('restores a lost-response draft after a reload and retries the same UUID once', async () => {
    const renderPage = () => render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    const first = renderPage();
    fireEvent.change(await screen.findByPlaceholderText('Write a message…'), { target: { value: 'Synthetic local integration reload retry' } });
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(new Error('lost acknowledgement'));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('alert');
    const key = vi.mocked(chatApi.sendMessage).mock.calls[0][2];
    first.unmount();
    renderPage();
    expect(await screen.findByPlaceholderText('Write a message…')).toHaveValue('Synthetic local integration reload retry');
    vi.mocked(chatApi.sendMessage).mockResolvedValueOnce({ data: { id: 12, conversationId: 7, senderId: 1,
        senderName: 'Me', content: 'Synthetic local integration reload retry', createdAt: '2026-10-17T21:00:00' } } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Write a message…')).toHaveValue(''));
    expect(chatApi.sendMessage).toHaveBeenLastCalledWith(7, 'Synthetic local integration reload retry', key);
    expect(within(screen.getByRole('log', { name: 'Conversation messages' })).getAllByText('Synthetic local integration reload retry')).toHaveLength(1);
});

it('loads conversations beyond the first page and refreshes them on reconnect', async () => {
    const rooms = Array.from({ length: 21 }, (_, index) => ({ ...conversation, id: index + 1,
        contextType: 'GROUP' as const, name: `Synthetic local integration group ${index + 1}` }));
    vi.mocked(chatApi.getConversations).mockImplementation(async (page = 0) => ({ data: {
        content: rooms.slice(page * 20, (page + 1) * 20), pageNumber: page, pageSize: 20, totalElements: 21,
    } }) as never);
    render(<MemoryRouter><MessagingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more conversations' }));
    expect(await screen.findByText('Synthetic local integration group 21')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more conversations' })).not.toBeInTheDocument();
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [], totalElements: 0 } } as never);
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByText('Synthetic local integration group 21')).not.toBeInTheDocument());
});

it('removes a revoked conversation and its cached messages when recovery is denied', async () => {
    vi.mocked(chatApi.getMessages).mockResolvedValue({ data: { content: [{ id: 12, conversationId: 7,
        senderId: 2, senderName: 'Peer', content: 'Synthetic local integration private history', createdAt: '2026-10-17T21:00:00' }] } } as never);
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    await within(await screen.findByRole('log', { name: 'Conversation messages' })).findByText('Synthetic local integration private history');
    vi.mocked(chatApi.getMessagesAfter).mockRejectedValueOnce({ response: { status: 403 } });
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [], totalElements: 0 } } as never);
    vi.mocked(chatApi.getConversation).mockRejectedValue({ response: { status: 403 } });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByPlaceholderText('Write a message…')).not.toBeInTheDocument());
    expect(screen.queryByText('Synthetic local integration private history')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('This conversation is no longer available.');
});

it('keeps the draft after a lost acknowledgement and shows it once after retry, even without live connection', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    const input = await screen.findByPlaceholderText('Write a message…');
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
    fireEvent.change(await screen.findByPlaceholderText('Write a message…'), { target: { value: 'First draft' } });
    fireEvent.click(screen.getByText('Other peer'));
    await waitFor(() => expect(screen.getByPlaceholderText('Write a message…')).toHaveValue(''));
    fireEvent.change(screen.getByPlaceholderText('Write a message…'), { target: { value: 'Second draft' } });
    fireEvent.click(screen.getByText('Peer'));
    await waitFor(() => expect(screen.getByPlaceholderText('Write a message…')).toHaveValue('First draft'));
    await act(async () => {});
});

it('opens a profile chat link when the inbox is empty', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.createConversation).mockResolvedValue({ data: conversation } as never);
    render(<MemoryRouter initialEntries={['/messages?chatWith=2']}><MessagingPage /></MemoryRouter>);
    await screen.findByPlaceholderText('Write a message…');
    expect(chatApi.createConversation).toHaveBeenCalledWith({ contextType: 'DIRECT', participantIds: [2] });
    await waitFor(() => expect(chatApi.getMessages).toHaveBeenCalledWith(7));
});

it('shows an inbox read failure and recovers without claiming there are no conversations', async () => {
    vi.mocked(chatApi.getConversations).mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><MessagingPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Conversations couldn’t load.');
    expect(screen.queryByText('No other conversations yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Peer')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('lets a failed profile conversation creation retry from the visible inbox', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.createConversation).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: conversation } as never);
    render(<MemoryRouter initialEntries={['/messages?chatWith=2']}><MessagingPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open this conversation. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByPlaceholderText('Write a message…')).toBeInTheDocument();
    expect(chatApi.createConversation).toHaveBeenCalledTimes(2);
});

it('does not carry a private message draft to another account sharing the same conversation', async () => {
    const { rerender } = render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    fireEvent.change(await screen.findByPlaceholderText('Write a message…'), { target: { value: 'Only my draft' } });
    auth.sessionId = 'session-B';
    auth.userId = '2';
    rerender(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    expect(await screen.findByPlaceholderText('Write a message…')).toHaveValue('');
});

it('shows a failed conversation deep link beside the inbox and lets it retry', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.getConversation).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: conversation } as never);
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('This conversation couldn’t load. Try again, or open another chat.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByPlaceholderText('Write a message…')).toBeInTheDocument();
});

it('renders a failed delivery in Georgian and keeps the draft across language changes', async () => {
    await i18n.changeLanguage('ka');
    vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('response lost'));
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    const input = await screen.findByRole('textbox', { name: 'დაწერეთ შეტყობინება' });
    fireEvent.change(input, { target: { value: 'Keep my words' } });
    fireEvent.click(screen.getByRole('button', { name: 'გაგზავნა' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('გაგზავნა ვერ დადასტურდა. მონახაზი შენახულია;');
    expect(input).toHaveValue('Keep my words');
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('textbox', { name: 'Write a message' })).toHaveValue('Keep my words');
    expect(screen.getByRole('alert')).toHaveTextContent('Message was not confirmed. Your draft is kept;');
    expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
});

it('reports a failed leave, preserves the conversation and prevents duplicate presses while retrying', async () => {
    const group = { ...conversation, contextType: 'GROUP' as const, name: 'Friends', participants: [{ ...conversation.participants[0], role: 'CREATOR' as const }, conversation.participants[1]] };
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [group] } } as never);
    vi.mocked(chatApi.getConversation).mockResolvedValue({ data: group } as never);
    vi.mocked(chatApi.leaveConversation).mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    await screen.findByPlaceholderText('Write a message…');
    fireEvent.click(screen.getByRole('button', { name: /Friends.*2 members/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not leave this conversation. Try again.');
    expect(screen.getByPlaceholderText('Write a message…')).toBeInTheDocument();
    let done = () => {};
    vi.mocked(chatApi.leaveConversation).mockReturnValueOnce(new Promise(resolve => { done = () => resolve({} as never); }));
    const leave = screen.getByRole('button', { name: 'Leave group' });
    fireEvent.click(leave); fireEvent.click(leave);
    expect(leave).toBeDisabled();
    expect(chatApi.leaveConversation).toHaveBeenCalledTimes(2);
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [] } } as never);
    await act(async () => done());
    await waitFor(() => expect(screen.queryByPlaceholderText('Write a message…')).not.toBeInTheDocument());
    expect(screen.queryByText('Friends')).not.toBeInTheDocument();
});

it('retries unavailable invite suggestions instead of claiming none are waiting', async () => {
    const group = { ...conversation, contextType: 'GROUP' as const, name: 'Friends', participants: [{ ...conversation.participants[0], role: 'CREATOR' as const }, conversation.participants[1]] };
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [group] } } as never);
    vi.mocked(chatApi.getConversation).mockResolvedValue({ data: group } as never);
    vi.mocked(chatApi.getPendingSuggestions).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [] } as never);
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    await screen.findByPlaceholderText('Write a message…');
    fireEvent.click(screen.getByRole('button', { name: /Friends.*2 members/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invite suggestions couldn’t load.');
    expect(screen.queryByText('No suggestions waiting.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeInTheDocument();
    expect(chatApi.getPendingSuggestions).toHaveBeenCalledTimes(2);
});

it('translates a failed profile chat without automatically retrying creation on language change', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.createConversation).mockRejectedValue(new Error('offline'));
    render(<MemoryRouter initialEntries={['/messages?chatWith=2']}><MessagingPage /></MemoryRouter>);
    await screen.findByRole('alert');
    await act(async () => { await i18n.changeLanguage('ka'); });
    expect(screen.getByRole('alert')).toHaveTextContent('საუბარი ვერ გაიხსნა. სცადეთ ხელახლა.');
    expect(screen.getByRole('button', { name: 'ხელახლა ცდა' })).toBeInTheDocument();
    expect(chatApi.createConversation).toHaveBeenCalledTimes(1);
});
