import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '../NotificationBell';

const api = vi.hoisted(() => ({ fetchNotifications: vi.fn(), fetchUnreadNotificationCount: vi.fn(), markAllNotificationsAsRead: vi.fn(), markNotificationAsRead: vi.fn() }));
vi.mock('../../../api/notifications', () => api);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: () => 'Notifications' }) }));

describe('notification dropdown bulk read', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        api.fetchUnreadNotificationCount.mockResolvedValue({ unreadCount: 17 });
        api.fetchNotifications.mockResolvedValue({ content: [{ id: 1, type: 'TEST', scope: 'PERSONAL', title: 'Club update', body: 'Training reminder', isRead: false, createdAt: '2026-09-30T10:00:00Z' }] });
    });

    const open = async () => {
        render(<MemoryRouter><NotificationBell enabled /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
        const button = await screen.findByRole('button', { name: 'Mark all as read' });
        await waitFor(() => expect(button).toBeEnabled());
        return button;
    };

    it('marks the complete inbox read, blocks repeat clicks, and keeps the dropdown open', async () => {
        let finish: () => void = () => undefined;
        api.markAllNotificationsAsRead.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
        const changed = vi.fn();
        window.addEventListener('talanti:notifications-changed', changed);
        try {
            const button = await open();
            fireEvent.click(button);
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('aria-busy', 'true');
            fireEvent.click(button);
            expect(api.markAllNotificationsAsRead).toHaveBeenCalledExactlyOnceWith();
            api.fetchUnreadNotificationCount.mockResolvedValue({ unreadCount: 0 });
            api.fetchNotifications.mockResolvedValue({ content: [{ id: 1, type: 'TEST', scope: 'PERSONAL', title: 'Club update', body: 'Training reminder', isRead: true, createdAt: '2026-09-30T10:00:00Z' }] });
            await act(async () => finish());
            expect(await screen.findByText('0 unread')).toBeInTheDocument();
            expect(button).toBeDisabled();
            expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/notifications');
            expect(changed.mock.calls[0][0].detail).toEqual({ allRead: true });
        } finally {
            window.removeEventListener('talanti:notifications-changed', changed);
        }
    });

    it('retains unread state and allows retry after a failed request', async () => {
        api.markAllNotificationsAsRead.mockRejectedValue(new Error('offline'));
        const button = await open();
        fireEvent.click(button);
        expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
        expect(screen.getByText('17 unread')).toBeInTheDocument();
        expect(button).toBeEnabled();
    });

    it('disables the action when there are no unread notifications', async () => {
        api.fetchUnreadNotificationCount.mockResolvedValue({ unreadCount: 0 });
        render(<MemoryRouter><NotificationBell enabled /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
        expect(await screen.findByText('0 unread')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
        expect(api.markAllNotificationsAsRead).not.toHaveBeenCalled();
    });
});
