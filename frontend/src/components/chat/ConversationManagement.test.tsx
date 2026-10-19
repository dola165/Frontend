import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { MessagingPage } from '../../pages/MessagingPage';
import { chatApi, type ConversationDto, type UserSearchResult } from '../../api/chat';

const auth = vi.hoisted(() => ({ sessionId: 'session-A', userId: '1' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../features/squadCommunication/api', () => ({ spaces: vi.fn().mockResolvedValue([]) }));
vi.mock('@stomp/stompjs', () => ({ Client: class { activate() {} deactivate() {} connected = false; } }));
vi.mock('../../api/axiosConfig', () => ({ buildWebSocketUrl: () => 'ws://localhost/ws-chat' }));
vi.mock('../../utils/authStorage', () => ({ getStoredAccessToken: () => 'token', getStoredUserId: () => auth.userId, getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('./NewChatModal', () => ({ NewChatModal: () => null }));
vi.mock('../../api/chat', () => ({ chatApi: {
    getConversations: vi.fn(), getConversation: vi.fn(), getMessages: vi.fn(), getMessagesAfter: vi.fn(), markAsRead: vi.fn(), getPendingSuggestions: vi.fn(),
    removeParticipant: vi.fn(), blockUser: vi.fn(), addParticipants: vi.fn(), suggestInvite: vi.fn(), searchUsers: vi.fn(),
} }));

const person = (userId: number, displayName: string, role: 'CREATOR' | null = null) => ({ userId, displayName, profilePictureUrl: null, role });
const group = (creatorId: number): ConversationDto => ({
    id: 7, name: 'Friends', contextType: 'GROUP', contextId: null,
    lastMessage: null, lastMessageSenderId: null, lastMessageSenderName: null, lastMessageAt: null, unreadCount: 0, participantCount: 3,
    participants: [person(1, 'Me', creatorId === 1 ? 'CREATOR' : null), person(2, 'Peer', creatorId === 2 ? 'CREATOR' : null), person(3, 'Third')],
});
const found = (id: number, fullName: string, isMinor = false): UserSearchResult =>
    ({ id, fullName, username: fullName.toLowerCase(), position: null, userType: 'PLAYER', avatarUrl: null, isMinor });

const openGroupInfo = async (conversation: ConversationDto) => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [conversation] } } as never);
    vi.mocked(chatApi.getConversation).mockResolvedValue({ data: conversation } as never);
    render(<MemoryRouter initialEntries={['/messages?conversationId=7']}><MessagingPage /></MemoryRouter>);
    await screen.findByPlaceholderText('Write a message…');
    fireEvent.click(screen.getByRole('button', { name: /Friends.*3 members/ }));
};

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(chatApi.getMessages).mockResolvedValue({ data: { content: [] } } as never);
    vi.mocked(chatApi.getMessagesAfter).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
    vi.mocked(chatApi.getPendingSuggestions).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.searchUsers).mockResolvedValue({ data: { content: [found(2, 'Peer'), found(5, 'Nika'), found(6, 'Nino', true)] } } as never);
});

it('lets the creator remove and block members, keeping a member whose removal failed', async () => {
    await openGroupInfo(group(1));
    vi.mocked(chatApi.removeParticipant).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({} as never);
    vi.mocked(chatApi.blockUser).mockResolvedValueOnce({} as never);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to remove Peer.');
    expect(screen.getByText('Peer')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await waitFor(() => expect(screen.queryByText('Peer')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Friends.*2 members/ })).toBeInTheDocument();
    expect(chatApi.removeParticipant).toHaveBeenLastCalledWith(7, 2);

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() => expect(screen.queryByText('Third')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Friends.*1 member$/ })).toBeInTheDocument();
    expect(chatApi.blockUser).toHaveBeenCalledWith(7, 3);
});

it('adds people from the creator search, leaving out members and minors', async () => {
    await openGroupInfo(group(1));
    vi.mocked(chatApi.addParticipants).mockResolvedValueOnce({} as never);
    fireEvent.click(screen.getByRole('button', { name: 'Add people' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search people' }), { target: { value: 'ni' } });
    const nika = await screen.findByRole('button', { name: /Nika/ });
    const results = nika.parentElement as HTMLElement;
    expect(within(results).queryByText('Nino')).not.toBeInTheDocument();
    expect(within(results).queryByText('Peer')).not.toBeInTheDocument();
    const reads = vi.mocked(chatApi.getConversations).mock.calls.length;
    fireEvent.click(nika);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search people' })).toHaveValue(''));
    expect(chatApi.addParticipants).toHaveBeenCalledWith(7, [5]);
    expect(vi.mocked(chatApi.getConversations).mock.calls.length).toBeGreaterThan(reads);
});

it('lets a member suggest someone and closes the search once the suggestion is sent', async () => {
    await openGroupInfo(group(2));
    expect(screen.queryByRole('button', { name: 'Add people' })).not.toBeInTheDocument();
    vi.mocked(chatApi.suggestInvite).mockResolvedValueOnce({} as never);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest someone' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search people' }), { target: { value: 'ni' } });
    fireEvent.click(await screen.findByRole('button', { name: /Nika/ }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Search people' })).not.toBeInTheDocument());
    expect(chatApi.suggestInvite).toHaveBeenCalledWith(7, 5);
    expect(chatApi.addParticipants).not.toHaveBeenCalled();
});
