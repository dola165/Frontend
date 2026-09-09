import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useChatWebSocket, mergeMessages } from './useChatWebSocket';
import { chatApi, type ChatMessageResponse } from '../api/chat';

const state = vi.hoisted(() => ({ client: null as unknown as FakeClient, token: 'first-token' }));
type Frame = { body: string };
type Options = { beforeConnect: () => void; onConnect: () => void; onWebSocketClose: () => void };
class FakeClient {
    connected = false;
    connectHeaders = {};
    options: Options;
    handlers: ((frame: Frame) => void)[] = [];
    unsubscribe = vi.fn();
    subscribe = vi.fn((_topic: string, handler: (frame: Frame) => void) => { this.handlers.push(handler); return { unsubscribe: this.unsubscribe }; });
    activate = vi.fn();
    deactivate = vi.fn();
    constructor(options: Options) { this.options = options; state.client = this; }
}
vi.mock('@stomp/stompjs', () => ({ Client: class {
    constructor(options: Options) { return new FakeClient(options); }
} }));
vi.mock('../api/axiosConfig', () => ({ buildWebSocketUrl: () => 'ws://localhost/ws-chat' }));
vi.mock('../utils/authStorage', () => ({ getStoredAccessToken: () => state.token, getStoredUserId: () => '1' }));
vi.mock('../api/chat', () => ({ chatApi: { getMessages: vi.fn(), getMessagesAfter: vi.fn(), getMessagesBefore: vi.fn(), markAsRead: vi.fn(), sendMessage: vi.fn() } }));
const message = (id: number, conversationId = 7): ChatMessageResponse => ({ id, conversationId, senderId: 2, senderName: 'Peer', content: `message ${id}`, createdAt: '2026-09-09T12:00:00' });
const response = (items: ChatMessageResponse[]) => ({ data: { content: items } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(() => {
    vi.clearAllMocks();
    state.token = 'first-token';
    vi.mocked(chatApi.getMessages).mockResolvedValue(response([]) as never);
    vi.mocked(chatApi.getMessagesAfter).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.getMessagesBefore).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
});
afterEach(() => { vi.useRealTimers(); });

describe('reliable chat transport', () => {
    it('loads multiple older pages without changing the forward recovery cursor or marking history read', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response(Array.from({ length: 50 }, (_, i) => message(i + 56))) as never);
        vi.mocked(chatApi.getMessagesBefore)
            .mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, i) => message(i + 6)) } as never)
            .mockResolvedValueOnce({ data: Array.from({ length: 5 }, (_, i) => message(i + 1)) } as never);
        let received: ChatMessageResponse[] = [];
        const { result } = renderHook(() => useChatWebSocket(item => { received = mergeMessages(received, [item]); }));
        await act(async () => { await result.current.setActiveConversation(7); });
        expect(result.current.hasOlder).toBe(true);
        await act(async () => { await result.current.loadOlder(); });
        expect(chatApi.getMessagesBefore).toHaveBeenLastCalledWith(7, 56);
        expect(result.current.hasOlder).toBe(true);
        vi.mocked(chatApi.getMessagesAfter).mockResolvedValueOnce({ data: [message(106)] } as never);
        await act(async () => { await result.current.catchUp(); });
        expect(chatApi.getMessagesAfter).toHaveBeenLastCalledWith(7, 105);
        await act(async () => { await result.current.loadOlder(); });
        expect(chatApi.getMessagesBefore).toHaveBeenLastCalledWith(7, 6);
        expect(result.current.hasOlder).toBe(false);
        expect(received.map(item => item.id)).toEqual(Array.from({ length: 106 }, (_, i) => i + 1));
        expect(chatApi.markAsRead).not.toHaveBeenCalled();
    });

    it('retries a failed older page with the same cursor and suppresses simultaneous loads', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response(Array.from({ length: 50 }, (_, i) => message(i + 51))) as never);
        const pending = deferred<{ data: ChatMessageResponse[] }>();
        vi.mocked(chatApi.getMessagesBefore).mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(pending.promise as never);
        const { result } = renderHook(() => useChatWebSocket(vi.fn()));
        await act(async () => { await result.current.setActiveConversation(7); await result.current.loadOlder(); });
        expect(result.current.historyError).toContain('try again');
        act(() => { void result.current.loadOlder(); void result.current.loadOlder(); });
        expect(chatApi.getMessagesBefore).toHaveBeenCalledTimes(2);
        expect(chatApi.getMessagesBefore).toHaveBeenLastCalledWith(7, 51);
        await act(async () => { pending.resolve({ data: [] }); });
        expect(result.current.historyError).toBeNull();
        expect(result.current.loadingOlder).toBe(false);
    });

    it('ignores an older page when selection changes and preserves cached history state on return', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValueOnce(response(Array.from({ length: 50 }, (_, i) => message(i + 51))) as never).mockResolvedValueOnce(response([]) as never);
        const pending = deferred<{ data: ChatMessageResponse[] }>();
        vi.mocked(chatApi.getMessagesBefore).mockReturnValueOnce(pending.promise as never);
        const incoming = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(incoming));
        await act(async () => { await result.current.setActiveConversation(7); });
        act(() => { void result.current.loadOlder(); });
        await act(async () => { await result.current.setActiveConversation(8); });
        await act(async () => { pending.resolve({ data: [message(1)] }); });
        expect(incoming).toHaveBeenCalledTimes(50);
        expect(result.current.hasOlder).toBe(false);
        await act(async () => { await result.current.setActiveConversation(7); });
        expect(result.current.hasOlder).toBe(true);
    });

    it('clears history when access to an older page has been revoked', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response(Array.from({ length: 50 }, (_, i) => message(i + 51))) as never);
        vi.mocked(chatApi.getMessagesBefore).mockRejectedValueOnce({ response: { status: 403 } });
        const unavailable = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(vi.fn(), unavailable));
        await act(async () => { await result.current.setActiveConversation(7); await result.current.loadOlder(); });
        expect(unavailable).toHaveBeenCalledWith(7);
        expect(result.current.hasOlder).toBe(false);
    });

    it('discards an older response still in flight when forward recovery discovers revocation', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response(Array.from({ length: 50 }, (_, i) => message(i + 51))) as never);
        const pending = deferred<{ data: ChatMessageResponse[] }>();
        vi.mocked(chatApi.getMessagesBefore).mockReturnValueOnce(pending.promise as never);
        const incoming = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(incoming, vi.fn()));
        await act(async () => { await result.current.setActiveConversation(7); });
        act(() => { void result.current.loadOlder(); });
        vi.mocked(chatApi.getMessagesAfter).mockRejectedValueOnce({ response: { status: 403 } });
        await act(async () => { await result.current.catchUp(); });
        await act(async () => { pending.resolve({ data: [message(1)] }); });
        expect(incoming).toHaveBeenCalledTimes(50);
        expect(result.current.loadingOlder).toBe(false);
        expect(result.current.hasOlder).toBe(false);
    });

    it('subscribes when selection precedes CONNECT and resubscribes with fresh credentials', async () => {
        const { result, unmount } = renderHook(() => useChatWebSocket(vi.fn()));
        await act(async () => { await result.current.setActiveConversation(7); });
        expect(state.client.subscribe).not.toHaveBeenCalled();
        await act(async () => { state.client.connected = true; state.client.options.onConnect(); });
        expect(state.client.subscribe).toHaveBeenLastCalledWith('/topic/chat.7', expect.any(Function));
        act(() => { state.client.connected = false; state.client.options.onWebSocketClose(); });
        expect(result.current.connected).toBe(false);
        state.token = 'refreshed-token';
        state.client.options.beforeConnect();
        expect(state.client.connectHeaders).toEqual({ Authorization: 'Bearer refreshed-token' });
        await act(async () => { state.client.connected = true; state.client.options.onConnect(); });
        expect(state.client.subscribe).toHaveBeenCalledTimes(2);
        unmount();
        expect(state.client.unsubscribe).toHaveBeenCalledTimes(1);
        expect(state.client.deactivate).toHaveBeenCalledTimes(1);
    });

    it('recovers missing IDs even if a newer live message arrives first and deduplicates', async () => {
        let received: ChatMessageResponse[] = [];
        const onMessage = (item: ChatMessageResponse) => { received = mergeMessages(received, [item]); };
        vi.mocked(chatApi.getMessages).mockResolvedValue(response([message(10)]) as never);
        const { result } = renderHook(() => useChatWebSocket(onMessage));
        await act(async () => { await result.current.setActiveConversation(7); });
        await act(async () => { state.client.connected = true; state.client.options.onConnect(); });
        act(() => { state.client.handlers.at(-1)?.({ body: JSON.stringify(message(12)) }); });
        vi.mocked(chatApi.getMessagesAfter).mockResolvedValueOnce({ data: [message(11), message(12)] } as never);
        await act(async () => { await result.current.catchUp(); });
        expect(chatApi.getMessagesAfter).toHaveBeenLastCalledWith(7, 10);
        expect(received.map(item => item.id)).toEqual([10, 11, 12]);
    });

    it('continues through a full recovery page', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response([message(1)]) as never);
        vi.mocked(chatApi.getMessagesAfter)
            .mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => message(index + 2)) } as never)
            .mockResolvedValueOnce({ data: [message(102)] } as never);
        const incoming = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(incoming));
        await act(async () => { await result.current.setActiveConversation(7); });
        expect(chatApi.getMessagesAfter).toHaveBeenNthCalledWith(2, 7, 101);
        expect(incoming).toHaveBeenCalledTimes(102);
        expect(chatApi.markAsRead).not.toHaveBeenCalled();
    });

    it('keeps unread state after the bounded recovery pass, including messages not yet recovered', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response([message(1)]) as never);
        vi.mocked(chatApi.getMessagesAfter).mockImplementation(async (_id, after) => ({ data: Array.from({ length: 100 }, (_, index) => message(after + index + 1)) }) as never);
        const incoming = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(incoming));
        await act(async () => { await result.current.setActiveConversation(7); });
        expect(chatApi.getMessagesAfter).toHaveBeenCalledTimes(10);
        expect(incoming).toHaveBeenCalledTimes(1001);
        expect(chatApi.markAsRead).not.toHaveBeenCalled();
    });

    it('ignores a history response from a previously selected conversation', async () => {
        const old = deferred<ReturnType<typeof response>>();
        vi.mocked(chatApi.getMessages).mockReturnValueOnce(old.promise as never).mockResolvedValueOnce(response([message(50, 8)]) as never);
        const incoming = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(incoming));
        act(() => { void result.current.setActiveConversation(7); });
        await act(async () => { await result.current.setActiveConversation(8); });
        await act(async () => { old.resolve(response([message(1)])); });
        expect(incoming).toHaveBeenCalledTimes(1);
        expect(incoming).toHaveBeenCalledWith(message(50, 8));
    });

    it('resumes the confirmed cursor when returning to a cached full conversation', async () => {
        vi.mocked(chatApi.getMessages).mockResolvedValue(response([message(10)]) as never);
        const { result } = renderHook(() => useChatWebSocket(vi.fn()));
        await act(async () => { await result.current.setActiveConversation(7); });
        await act(async () => { await result.current.setActiveConversation(null); });
        await act(async () => { await result.current.setActiveConversation(7); });
        expect(chatApi.getMessages).toHaveBeenCalledTimes(1);
        expect(chatApi.getMessagesAfter).toHaveBeenLastCalledWith(7, 10);
    });

    it('sends without a socket, retains the request identity on ambiguous failure, and waits for REST acknowledgement', async () => {
        const incoming = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(incoming));
        await act(async () => { await result.current.setActiveConversation(7); });
        vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(new Error('response lost'));
        let sent = true;
        await act(async () => { sent = await result.current.sendMessage(7, 'hello'); });
        expect(sent).toBe(false);
        expect(result.current.error).toContain('draft is kept');
        const firstKey = vi.mocked(chatApi.sendMessage).mock.calls[0][2];
        expect(incoming).not.toHaveBeenCalled();
        vi.mocked(chatApi.sendMessage).mockResolvedValueOnce({ data: message(20) } as never);
        await act(async () => { sent = await result.current.sendMessage(7, 'hello'); });
        expect(sent).toBe(true);
        expect(chatApi.sendMessage).toHaveBeenLastCalledWith(7, 'hello', firstKey);
        expect(incoming).toHaveBeenCalledWith(message(20));
        expect(result.current.error).toBeNull();
    });

    it('clears inaccessible history and stops its live subscription', async () => {
        const unavailable = vi.fn();
        const { result } = renderHook(() => useChatWebSocket(vi.fn(), unavailable));
        await act(async () => { state.client.connected = true; state.client.options.onConnect(); await result.current.setActiveConversation(7); });
        vi.mocked(chatApi.getMessagesAfter).mockRejectedValueOnce({ response: { status: 403 } });
        await act(async () => { await result.current.catchUp(); });
        expect(unavailable).toHaveBeenCalledWith(7);
        expect(state.client.unsubscribe).toHaveBeenCalled();
    });
});
