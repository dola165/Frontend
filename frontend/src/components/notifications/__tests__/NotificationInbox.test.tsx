import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { NotificationsPage } from '../../../pages/NotificationsPage';
import type { NotificationItem, NotificationQueryOptions } from '../../../types/notifications';
import '../../../i18n';

const api = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), read: vi.fn(), all: vi.fn(), navigate: vi.fn() }));
const auth = vi.hoisted(() => ({ sessionId: 'one' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ ...auth, user: undefined }) }));
vi.mock('../../../utils/authStorage', () => ({ isCurrentAuthSession: (id: string) => auth.sessionId === id }));
vi.mock('../../../api/notifications', () => ({ fetchNotifications: api.list, fetchUnreadNotificationCount: api.count, markNotificationAsRead: api.read, markAllNotificationsAsRead: api.all }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => api.navigate }));
vi.mock('../NotificationListItem', () => ({ NotificationListItem: ({ notification, onOpen }: { notification: NotificationItem; onOpen: (item: NotificationItem) => void }) => <button onClick={() => onOpen(notification)}>{notification.title} · {notification.isRead ? 'read' : 'unread'}</button> }));
vi.mock('../NotificationTarget', () => ({ NotificationTarget: () => null }));
vi.mock('../BookingNotificationTarget', () => ({ BookingNotificationTarget: () => null }));
vi.mock('../SquadConversationNotificationTarget', () => ({ SquadConversationNotificationTarget: () => null }));

const note = (id: number): NotificationItem => ({ id, type: 'TEST', scope: 'PERSONAL', title: `Synthetic notice ${id}`, body: '', createdAt: '2026-10-18T00:00:00Z', isRead: false });
let rows: NotificationItem[];
const matching = (options: NotificationQueryOptions = {}) => rows.filter(item => (!options.scope || options.scope === 'all' || item.scope.toLowerCase() === options.scope) && (options.clubId == null || item.clubId === options.clubId));
const view = (path = '/notifications') => <MemoryRouter initialEntries={[path]}><NotificationsPage /></MemoryRouter>;

beforeEach(() => {
    vi.resetAllMocks(); auth.sessionId = 'one'; rows = [note(1)];
    api.list.mockImplementation(async (options: NotificationQueryOptions = {}) => {
        const selected = matching(options), size = options.size ?? 20, page = options.page ?? 0;
        return { content: selected.slice(page * size, (page + 1) * size), pageNumber: page, pageSize: size, totalElements: selected.length };
    });
    api.count.mockImplementation(async (options: NotificationQueryOptions = {}) => ({ unreadCount: matching(options).filter(item => !item.isRead).length }));
    api.read.mockImplementation(async (id: number) => { rows = rows.map(item => item.id === id ? { ...item, isRead: true } : item); return { id, isRead: true }; });
    api.all.mockImplementation(async (options: NotificationQueryOptions) => { const ids = new Set(matching(options).map(item => item.id)); rows = rows.map(item => ids.has(item.id) ? { ...item, isRead: true } : item); return { updatedCount: ids.size }; });
});

it('reports failure with unknown counts instead of an empty fully read inbox', async () => {
    api.list.mockRejectedValue(new Error('offline')); render(view());
    await screen.findByRole('alert');
    expect(screen.queryByText('All clear right now')).not.toBeInTheDocument();
    expect(screen.queryByText('0 total')).not.toBeInTheDocument();
    expect(screen.getByText('Unread in this view').parentElement).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
});

it('reads the real unread count after bulk read, including an update arriving during it', async () => {
    api.all.mockImplementation(async () => { rows = [{ ...note(1), isRead: true }, note(2)]; return { updatedCount: 1 }; });
    render(view()); await screen.findByRole('button', { name: 'Synthetic notice 1 · unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await screen.findByRole('button', { name: 'Synthetic notice 2 · unread' });
    expect(screen.getByText('Unread in this view').parentElement).toHaveTextContent('1');
    expect(api.all).toHaveBeenCalledWith({ scope: 'all', clubId: null }, { _authSessionId: 'one' });
    expect(screen.getByRole('button', { name: 'Synthetic notice 1 · read' })).toBeInTheDocument();
});

it('does not apply an unscoped all-read event as a fabricated state change', async () => {
    render(view()); await screen.findByRole('button', { name: 'Synthetic notice 1 · unread' });
    await act(async () => { window.dispatchEvent(new CustomEvent('talanti:notifications-changed', { detail: { allRead: true } })); });
    expect(screen.getByRole('button', { name: 'Synthetic notice 1 · unread' })).toBeInTheDocument();
    expect(screen.getByText('Unread in this view').parentElement).toHaveTextContent('1');
});

it('drops old rows immediately and cannot navigate an old-login response', async () => {
    let done!: (value: { id: number; isRead: boolean }) => void;
    api.read.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const rendered = render(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Synthetic notice 1 · unread' }));
    auth.sessionId = 'two'; api.list.mockReturnValue(new Promise(() => {})); rendered.rerender(view());
    expect(screen.queryByText(/Synthetic notice/)).not.toBeInTheDocument();
    await act(async () => done({ id: 1, isRead: true }));
    expect(api.navigate).not.toHaveBeenCalled(); expect(api.read).toHaveBeenCalledWith(1, { _authSessionId: 'one' });
});

it('checks the login again before navigating an already read notice', async () => {
    rows = [{ ...note(1), isRead: true }]; const rendered = render(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Synthetic notice 1 · read' }));
    auth.sessionId = 'two'; api.list.mockReturnValue(new Promise(() => {})); rendered.rerender(view());
    await act(async () => {});
    expect(api.navigate).not.toHaveBeenCalled(); expect(api.read).not.toHaveBeenCalled();
});

it('keeps personal notices unread when marking one club view as read', async () => {
    rows.push({ ...note(2), scope: 'CLUB', clubId: 7 });
    render(view('/notifications?scope=club&clubId=7'));
    await screen.findByRole('button', { name: 'Synthetic notice 2 · unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await screen.findByRole('button', { name: 'Synthetic notice 2 · read' });
    expect(rows.find(item => item.id === 1)?.isRead).toBe(false);
    expect(api.all).toHaveBeenCalledWith({ scope: 'club', clubId: 7 }, { _authSessionId: 'one' });
    expect(screen.getByText('Unread in this view').parentElement).toHaveTextContent('0');
});

it('keeps loaded older pages and real read states after a refresh', async () => {
    rows = Array.from({ length: 21 }, (_, index) => note(index + 1));
    render(view()); await screen.findByRole('button', { name: 'Synthetic notice 1 · unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Load more notifications' }));
    await screen.findByRole('button', { name: 'Synthetic notice 21 · unread' });
    rows = rows.map(item => item.id === 21 ? { ...item, isRead: true } : item);
    await act(async () => { window.dispatchEvent(new CustomEvent('talanti:notifications-changed')); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Synthetic notice 21 · read' })).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Synthetic notice/ })).toHaveLength(21);
});
