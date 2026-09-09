import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { chatHandlers } from './chat';
import { conversations, messages, resetChatStore } from '../data/chatStore';
import type { ChatMessageResponse, ConversationDto } from '../../api/chat';

vi.mock('../data/store', () => ({ currentUserId: () => 1, users: () => new Map() }));
vi.mock('../utils', async importOriginal => ({ ...await importOriginal<typeof import('../utils')>(), simulateLatency: async () => {} }));
const server = setupServer(...chatHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { resetChatStore(); server.resetHandlers(); });
afterAll(() => server.close());
const get = (suffix: string) => fetch('http://localhost/api/chat/conversations/7/messages' + suffix);
const message = (id: number): ChatMessageResponse => ({ id, conversationId: 7, senderId: 2, senderName: 'Peer', content: String(id), createdAt: '2026-09-09T12:00:00' });
function seed() {
    conversations().set(7, { id: 7, participants: [{ userId: 1, displayName: 'Me', role: 'MEMBER', profilePictureUrl: null }], unreadCount: 105 } as ConversationDto);
    messages().set(7, Array.from({ length: 105 }, (_, i) => message(i + 1)));
}

it('mock demo matches newest-first history and stable before/after paging without reading', async () => {
    seed();
    const initial = await (await get('?size=50')).json();
    expect(initial.content.map((item: ChatMessageResponse) => item.id)).toEqual(Array.from({ length: 50 }, (_, i) => 105 - i));
    messages().get(7)!.push(message(106));
    const older = await (await get('/before?beforeId=56&size=50')).json();
    expect(older.map((item: ChatMessageResponse) => item.id)).toEqual(Array.from({ length: 50 }, (_, i) => 55 - i));
    const oldest = await (await get('/before?beforeId=6&size=50')).json();
    expect(oldest.map((item: ChatMessageResponse) => item.id)).toEqual([5, 4, 3, 2, 1]);
    expect(await (await get('/after?afterId=105')).json()).toEqual([message(106)]);
    expect(conversations().get(7)!.unreadCount).toBe(105);
});

it('rejects invalid history requests and revoked membership in the mock demo', async () => {
    seed();
    expect((await get('/before?beforeId=0')).status).toBe(400);
    expect((await get('/before?beforeId=56&size=101')).status).toBe(400);
    conversations().get(7)!.participants = [];
    expect((await get('/before?beforeId=56')).status).toBe(403);
});
