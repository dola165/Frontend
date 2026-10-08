import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InboxTab } from '../InboxTab';
import type { NotificationItem } from '../../../../types/notifications';

const notifications: NotificationItem[] = [
    { id: 1, type: 'CLUB_PERMISSION_REQUEST', scope: 'CLUB', clubId: 1, entityType: 'PLAYER', title: 'Permission required', body: 'Review this player permission.', isRead: false, createdAt: '2026-10-01T08:00:00Z' },
    { id: 2, type: 'SQUAD_ASSIGNMENT', scope: 'CLUB', clubId: 1, entityType: 'SQUAD', title: 'Squad updated', body: 'Your team has been updated.', isRead: true, createdAt: '2026-10-01T07:00:00Z' },
];
const props = () => ({ notifications, loading: false, loadingMore: false, busyId: null, hasMore: true, unreadCount: 1, onOpen: vi.fn(), onLoadMore: vi.fn(), onMarkAllRead: vi.fn(), onRetry: vi.fn() });

describe('Club inbox', () => {
    it('combines unread and area filters without changing notification destinations', () => {
        const p = props();
        render(<MemoryRouter><InboxTab {...p}/></MemoryRouter>);
        fireEvent.change(screen.getByRole('combobox', { name: 'Inbox filter' }), { target: { value: 'UNREAD' } });
        expect(screen.queryByText('Squad updated')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /^Squad/ }));
        expect(screen.getByText('No notifications match these filters.')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', { name: 'Inbox area' }), { target: { value: 'PLAYER' } });
        fireEvent.click(screen.getByRole('button', { name: /Permission required/ }));
        expect(p.onOpen).toHaveBeenCalledWith(notifications[0]);
    });
    it('keeps bulk read and pagination actions and shows partial-load errors without dropping existing notifications', () => {
        const p = props();
        render(<MemoryRouter><InboxTab {...p} error="Could not load more updates."/></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
        fireEvent.click(screen.getByRole('button', { name: 'Load more notifications' }));
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(p.onMarkAllRead).toHaveBeenCalledOnce();
        expect(p.onLoadMore).toHaveBeenCalledOnce();
        expect(p.onRetry).toHaveBeenCalledOnce();
        expect(screen.getByText('Squad updated')).toBeInTheDocument();
        expect(screen.getByText('2 shown · more available')).toBeInTheDocument();
    });
});
