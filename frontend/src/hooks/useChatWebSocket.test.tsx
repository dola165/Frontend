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
vi.mock('../api/chat', () => ({ chatApi: { getMessages: vi.fn(), getMessagesAfter: vi.fn(), markAsRead: vi.fn(), sendMessage: vi.fn() } }));
const message = (id: number, conversationId = 7): ChatMessageResponse => ({ id, conversationId, senderId: 2, senderName: 'Peer', content: `message ${id}`, createdAt: '2026-09-09T12:00:00' });
const response = (items: ChatMessageResponse[]) => ({ data: { content: items } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(() => {
    vi.clearAllMocks();
    state.token = 'first-token';
    vi.mocked(chatApi.getMessages).mockResolvedValue(response([]) as never);
    vi.mocked(chatApi.getMessagesAfter).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
});
afterEach(() => { vi.useRealTimers(); });

describe('reliable chat transport', () => {
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
