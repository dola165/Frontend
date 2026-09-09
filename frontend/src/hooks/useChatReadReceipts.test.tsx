import { useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useChatReadReceipts } from './useChatReadReceipts';
import { chatApi, type ChatMessageResponse } from '../api/chat';
import { emitNotificationsChanged } from '../utils/notifications';

vi.mock('../api/chat', () => ({ chatApi: { markAsRead: vi.fn() } }));
vi.mock('../utils/authStorage', () => ({ getStoredUserId: () => '1' }));
vi.mock('../utils/notifications', () => ({ emitNotificationsChanged: vi.fn() }));

const observers: FakeObserver[] = [];
class FakeObserver {
    elements: Element[] = [];
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this); }
    observe(element: Element) { this.elements.push(element); }
    disconnect() {}
    show(ids: number[]) {
        this.callback(this.elements.map(target => ({ target, isIntersecting: ids.includes(Number((target as HTMLElement).dataset.chatMessageId)) })) as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
    }
}
const message = (id: number, conversationId = 7, senderId = 2): ChatMessageResponse => ({ id, conversationId, senderId, senderName: 'Peer', content: `Message ${id}`, createdAt: '2026-09-09T12:00:00' });
function Chat({ id = 7, enabled = true, messages = [message(10)] }: { id?: number; enabled?: boolean; messages?: ChatMessageResponse[] }) {
    const viewport = useRef<HTMLDivElement>(null);
    useChatReadReceipts(id, enabled, messages, viewport);
    return <div ref={viewport}>{messages.map(item => <div key={item.id} data-chat-message-id={item.id}>{item.content}</div>)}</div>;
}
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(210); });

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('acknowledges only visible incoming IDs, leaving unfetched or offscreen history alone', async () => {
    render(<Chat messages={[message(10), message(12), message(13, 7, 1)]} />);
    expect(observers.at(-1)?.elements).toHaveLength(2);
    observers.at(-1)?.show([12, 13]);
    await tick();
    expect(chatApi.markAsRead).toHaveBeenCalledExactlyOnceWith(7, [12]);
    expect(emitNotificationsChanged).toHaveBeenCalledTimes(1);
    observers.at(-1)?.show([10, 12]);
    await tick();
    expect(chatApi.markAsRead).toHaveBeenLastCalledWith(7, [10]);
});

it('does not read during minimization, then reads visible content after restore', async () => {
    const view = render(<Chat enabled={false} />);
    expect(observers).toHaveLength(0);
    window.dispatchEvent(new Event('focus'));
    await tick();
    expect(chatApi.markAsRead).not.toHaveBeenCalled();
    view.rerender(<Chat enabled />);
    observers.at(-1)?.show([10]);
    await tick();
    expect(chatApi.markAsRead).toHaveBeenCalledExactlyOnceWith(7, [10]);
});

it('keeps background and unfocused windows unread until they become visible and focused', async () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<Chat />);
    observers.at(-1)?.show([10]);
    await tick();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await tick();
    expect(chatApi.markAsRead).not.toHaveBeenCalled();
    vi.mocked(document.hasFocus).mockReturnValue(true);
    window.dispatchEvent(new Event('focus'));
    await tick();
    expect(chatApi.markAsRead).toHaveBeenCalledExactlyOnceWith(7, [10]);
});

it('does not acknowledge a bubble that scrolls out of view before the acknowledgement', async () => {
    render(<Chat />);
    observers.at(-1)?.show([10]);
    vi.mocked(Element.prototype.getBoundingClientRect).mockReturnValue({ top: 2000, bottom: 2100, left: 0, right: 100, width: 100, height: 100 } as DOMRect);
    await tick();
    expect(chatApi.markAsRead).not.toHaveBeenCalled();
});

it('cancels queued reads when the conversation is hidden or replaced', async () => {
    const view = render(<Chat />);
    observers.at(-1)?.show([10]);
    view.rerender(<Chat enabled={false} />);
    await tick();
    expect(chatApi.markAsRead).not.toHaveBeenCalled();
    view.rerender(<Chat id={8} messages={[message(20, 8)]} />);
    observers.at(-1)?.show([20]);
    await tick();
    expect(chatApi.markAsRead).toHaveBeenCalledExactlyOnceWith(8, [20]);
});

it('retains unread feedback after failure and retries the same visible IDs on reconnect', async () => {
    vi.mocked(chatApi.markAsRead).mockRejectedValueOnce(new Error('offline'));
    render(<Chat />);
    observers.at(-1)?.show([10]);
    await tick();
    expect(emitNotificationsChanged).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    await tick();
    expect(chatApi.markAsRead).toHaveBeenNthCalledWith(2, 7, [10]);
    expect(emitNotificationsChanged).toHaveBeenCalledTimes(1);
});

it('only refreshes badges after the captured read request succeeds, even if a new message arrives', async () => {
    let confirm!: (value: never) => void;
    vi.mocked(chatApi.markAsRead).mockReturnValueOnce(new Promise(resolve => { confirm = resolve; }));
    const view = render(<Chat />);
    observers.at(-1)?.show([10]);
    await tick();
    expect(emitNotificationsChanged).not.toHaveBeenCalled();
    view.rerender(<Chat messages={[message(10), message(11)]} enabled={false} />);
    await act(async () => { confirm({} as never); });
    expect(chatApi.markAsRead).toHaveBeenCalledExactlyOnceWith(7, [10]);
    expect(emitNotificationsChanged).toHaveBeenCalledTimes(1);
});
