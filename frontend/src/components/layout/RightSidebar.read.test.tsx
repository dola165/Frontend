import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RightSidebar } from './RightSidebar';
import { chatApi } from '../../api/chat';

const auth = vi.hoisted(() => ({ isAuthenticated: true, sessionId: 'session-A' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

vi.mock('@stomp/stompjs', () => ({ Client: class { activate() {} deactivate() {} connected = false; } }));
vi.mock('../../api/axiosConfig', () => ({ buildWebSocketUrl: () => 'ws://localhost/ws-chat', DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../utils/authStorage', () => ({ getStoredAccessToken: () => 'token', getStoredUserId: () => '1', getAuthSessionId: () => 'session-A', isCurrentAuthSession: (id: string) => id === 'session-A' }));
vi.mock('../../api/chat', () => ({ chatApi: { getConversations: vi.fn(), getMessages: vi.fn(), getMessagesAfter: vi.fn(), markAsRead: vi.fn() } }));
let observer: { callback: IntersectionObserverCallback; elements: Element[] };
beforeEach(() => {
    auth.isAuthenticated = true;
    auth.sessionId = 'session-A';
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => document.querySelector('[data-chat-message-content]') ?? document.querySelector('[data-chat-message-id]')) });
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect);
    vi.stubGlobal('IntersectionObserver', class {
        elements: Element[] = [];
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) { this.callback = callback; observer = { callback, elements: this.elements }; }
        observe(element: Element) { this.elements.push(element); }
        disconnect() {}
    });
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: { content: [{ id: 7, participants: [{ userId: 2, displayName: 'Peer', profilePictureUrl: null }] }] } } as never);
    vi.mocked(chatApi.getMessages).mockResolvedValue({ data: { content: [{ id: 10, conversationId: 7, senderId: 2, content: 'Unread message', createdAt: '2026-09-09T12:00:00' }] } } as never);
    vi.mocked(chatApi.getMessagesAfter).mockResolvedValue({ data: [] } as never);
    vi.mocked(chatApi.markAsRead).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('does not request conversations while anonymous or bootstrapping', () => {
    auth.isAuthenticated = false;
    render(<MemoryRouter><RightSidebar /></MemoryRouter>);
    expect(chatApi.getConversations).not.toHaveBeenCalled();
});

it('aborts and discards old conversations on logout and account replacement', async () => {
    const view = render(<MemoryRouter><RightSidebar /></MemoryRouter>);
    await screen.findByRole('button', { name: /Peer/ });
    const firstSignal = vi.mocked(chatApi.getConversations).mock.calls[0][2]!.signal!;
    auth.isAuthenticated = false;
    view.rerender(<MemoryRouter><RightSidebar /></MemoryRouter>);
    expect(firstSignal.aborted).toBe(true);
    expect(screen.queryByRole('button', { name: /Peer/ })).not.toBeInTheDocument();
    expect(chatApi.getConversations).toHaveBeenCalledTimes(1);
    auth.isAuthenticated = true;
    auth.sessionId = 'session-B';
    view.rerender(<MemoryRouter><RightSidebar /></MemoryRouter>);
    expect(chatApi.getConversations).toHaveBeenLastCalledWith(0, 8, expect.objectContaining({ _authSessionId: 'session-B' }));
    expect(screen.queryByRole('button', { name: /Peer/ })).not.toBeInTheDocument();
});

it('minimizing quick chat cancels a pending read; recovery stays unread until restoration', async () => {
    render(<MemoryRouter><RightSidebar /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Peer/ }));
    await screen.findByText('Unread message');
    await waitFor(() => expect(observer?.elements.length).toBeGreaterThan(0));
    vi.useFakeTimers();
    observer.callback(observer.elements.map(target => ({ target, isIntersecting: true })) as IntersectionObserverEntry[], {} as IntersectionObserver);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(300); });
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(chatApi.markAsRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore chat' }));
    expect(within(screen.getByRole('log')).getByText('Unread message')).toBeVisible();
    observer.callback(observer.elements.map(target => ({ target, isIntersecting: true })) as IntersectionObserverEntry[], {} as IntersectionObserver);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(chatApi.markAsRead).toHaveBeenCalledExactlyOnceWith(7, [10]);
});
