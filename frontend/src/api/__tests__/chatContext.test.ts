import { chatApi, type ConversationDto } from '../chat';
import { apiClient } from '../axiosConfig';

vi.mock('../axiosConfig', () => ({ apiClient: { get: vi.fn() } }));

const conversation = (id: number, contextId: number | null): ConversationDto => ({
  id, name: `Conversation ${id}`, contextType: 'MATCH_CHALLENGE', contextId, lastMessage: null, lastMessageSenderId: null,
  lastMessageSenderName: null, lastMessageAt: null, unreadCount: 0, participantCount: 2, participants: [],
});

it('pages through existing conversations to find the exact match context', async () => {
  vi.mocked(apiClient.get)
    .mockResolvedValueOnce({ data: { content: [conversation(1, 3)], pageNumber: 0, pageSize: 50, totalElements: 51 } })
    .mockResolvedValueOnce({ data: { content: [conversation(77, 12)], pageNumber: 1, pageSize: 50, totalElements: 51 } });
  await expect(chatApi.findConversationByContext('MATCH_CHALLENGE', 12)).resolves.toMatchObject({ id: 77 });
  expect(apiClient.get).toHaveBeenNthCalledWith(2, '/chat/conversations', expect.objectContaining({ params: { page: 1, size: 50 } }));
});
