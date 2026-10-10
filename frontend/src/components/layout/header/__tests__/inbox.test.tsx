import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestItem, RequestPage } from '../../../../features/requests/api';
import type { NotificationItem } from '../../../../types/notifications';
import { InboxButton } from '../inbox/InboxButton';
import { InboxPanel } from '../inbox/InboxPanel';
import { inboxBadge, inboxLabel, type InboxCounts } from '../inbox/useInbox';

const api = vi.hoisted(() => ({
    requests: vi.fn(),
    fetchNotifications: vi.fn(),
    fetchUnreadNotificationCount: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
}));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-1' }) }));
vi.mock('../../../../features/requests/api', () => ({ requests: api.requests, requestDestination: (value: string) => value.startsWith('/') ? value : null }));
vi.mock('../../../../api/notifications', () => ({
    fetchNotifications: api.fetchNotifications,
    fetchUnreadNotificationCount: api.fetchUnreadNotificationCount,
    markNotificationAsRead: api.markNotificationAsRead,
    markAllNotificationsAsRead: api.markAllNotificationsAsRead,
}));
vi.mock('../../../../features/mapPlanning/JourneyReminderActions', () => ({ JourneyReminderActions: () => null }));

const english = (en: string) => en;
const request = (overrides: Partial<RequestItem> = {}): RequestItem => ({
    key: 'membership:1', family: 'CLUB_MEMBERSHIP_APPLICATION', id: 1, title: 'Membership application · U14', context: 'Davit Kvirikashvili',
    status: 'PENDING', direction: 'INCOMING', actionable: true, updatedAt: '2026-10-09T10:00:00Z', destination: '/clubs/1/workspace?tab=applications', actionLabel: 'Review', ...overrides,
});
const page = (items: RequestItem[], actionable: number, unavailableSources: string[] = []): RequestPage => ({
    items, counts: { incoming: items.length, actionable, outgoing: 0, history: 0 }, total: items.length, hasMore: false, unavailableSources,
});
const update = (id: number, isRead = false): NotificationItem => ({ id, type: 'SQUAD_UPDATE', scope: 'PERSONAL', title: `Training moved ${id}`, body: 'Pitch 2', isRead, createdAt: '2026-10-09T10:00:00Z', linkPath: '/squads/105' });
const counts = (overrides: Partial<InboxCounts> = {}): InboxCounts => ({ needsYou: 0, needsYouPartial: false, updates: 0, ...overrides });

function panel(value: InboxCounts, onNavigate = vi.fn()) {
    render(
        <MemoryRouter initialEntries={['/home']}>
            <Routes>
                <Route path="/home" element={<InboxPanel counts={value} titleId="inbox" onNavigate={onNavigate} />} />
                <Route path="*" element={<p>Opened elsewhere</p>} />
            </Routes>
        </MemoryRouter>,
    );
    return onNavigate;
}

beforeEach(() => {
    api.requests.mockResolvedValue(page([], 0));
    api.fetchNotifications.mockResolvedValue({ content: [] });
    api.fetchUnreadNotificationCount.mockResolvedValue({ unreadCount: 0 });
    api.markNotificationAsRead.mockResolvedValue({});
    api.markAllNotificationsAsRead.mockResolvedValue({});
});
afterEach(() => vi.clearAllMocks());

describe('inbox badge and name', () => {
    it('counts decisions only, and shows unread updates as a dot', () => {
        expect(inboxBadge(counts({ needsYou: 3, updates: 7 }))).toEqual({ count: 3, atLeast: false });
        expect(inboxBadge(counts({ needsYou: 0, updates: 7 }))).toBe('dot');
        expect(inboxBadge(counts())).toBeNull();
    });

    it('marks a count that may be higher, and never turns an unknown count into zero', () => {
        expect(inboxBadge(counts({ needsYou: 3, needsYouPartial: true }))).toEqual({ count: 3, atLeast: true });
        expect(inboxLabel(counts({ needsYou: 3, needsYouPartial: true, updates: 7 }), english)).toBe('Inbox: at least 3 need you, some requests could not load, 7 unread updates');
        expect(inboxLabel(counts({ needsYou: null, updates: 2 }), english)).toBe('Inbox: requests could not load, 2 unread updates');
        expect(inboxLabel(counts({ needsYou: null, updates: 2 }), english)).not.toMatch(/\b0 need you/);
        expect(inboxLabel(counts({ needsYou: 1, updates: null }), english)).toBe('Inbox: 1 need you');
    });
});

describe('Inbox button', () => {
    const renderButton = () => render(<MemoryRouter><InboxButton /></MemoryRouter>);

    it('shows "2+" when some request types could not load', async () => {
        api.requests.mockResolvedValue(page([], 2, ['tournaments']));
        api.fetchUnreadNotificationCount.mockResolvedValue({ unreadCount: 5 });
        renderButton();
        const button = await screen.findByRole('button', { name: 'Inbox: at least 2 need you, some requests could not load, 5 unread updates' });
        expect(within(button).getByText('2+')).toBeInTheDocument();
    });

    it('shows no number when requests fail, only the dot for unread updates', async () => {
        api.requests.mockRejectedValue(new Error('offline'));
        api.fetchUnreadNotificationCount.mockResolvedValue({ unreadCount: 4 });
        renderButton();
        const button = await screen.findByRole('button', { name: 'Inbox: requests could not load, 4 unread updates' });
        expect(button.querySelector('.gk-count')).toBeNull();
        expect(button.querySelector('.gk-hdot')).not.toBeNull();
    });
});

describe('Inbox panel', () => {
    it('lists decisions waiting for the person', async () => {
        api.requests.mockResolvedValue(page([request()], 1));
        panel(counts({ needsYou: 1 }));
        expect(await screen.findByRole('link', { name: /Membership application · U14/ })).toHaveAttribute('href', '/clubs/1/workspace?tab=applications');
    });

    it('never says "nothing needs you" next to a waiting count', async () => {
        api.requests.mockResolvedValue(page([request({ actionable: false })], 4));
        panel(counts({ needsYou: 4 }));
        expect(await screen.findByText('4 waiting for you')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open requests' })).toHaveAttribute('href', '/requests?view=INCOMING');
        expect(screen.queryByText('Nothing needs you right now')).not.toBeInTheDocument();
    });

    it('says nothing needs you only when every request type loaded and none wait', async () => {
        panel(counts());
        expect(await screen.findByText('Nothing needs you right now')).toBeInTheDocument();
    });

    it('says when some request types could not load instead of claiming an empty inbox', async () => {
        api.requests.mockResolvedValue(page([], 0, ['tournaments']));
        panel(counts({ needsYouPartial: true }));
        expect(await screen.findByText(/Some request types could not load/)).toBeInTheDocument();
        expect(screen.queryByText('Nothing needs you right now')).not.toBeInTheDocument();
    });

    it('keeps "Mark all as read" busy while it runs and reports a failure', async () => {
        let fail: (error: Error) => void = () => {};
        api.fetchNotifications.mockResolvedValue({ content: [update(1), update(2)] });
        api.markAllNotificationsAsRead.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
        panel(counts({ updates: 2 }));
        fireEvent.click(screen.getByRole('tab', { name: /Updates/ }));
        await screen.findByRole('button', { name: /Training moved 1/ });
        const markAll = screen.getByRole('button', { name: 'Mark all as read' });
        fireEvent.click(markAll);
        expect(markAll).toBeDisabled();
        expect(markAll).toHaveAttribute('aria-busy', 'true');
        await act(async () => fail(new Error('offline')));
        expect(screen.getByRole('alert')).toHaveTextContent('Could not mark updates as read. Try again.');
        expect(markAll).not.toBeDisabled();
    });

    it('opens an update once, even when pressed twice', async () => {
        let done: () => void = () => {};
        api.fetchNotifications.mockResolvedValue({ content: [update(7)] });
        api.markNotificationAsRead.mockReturnValue(new Promise<void>(resolve => { done = resolve; }));
        const onNavigate = panel(counts({ updates: 1 }));
        fireEvent.click(screen.getByRole('tab', { name: /Updates/ }));
        const row = await screen.findByRole('button', { name: 'Unread: Training moved 7' });
        fireEvent.click(row);
        fireEvent.click(row);
        await act(async () => done());
        await waitFor(() => expect(screen.getByText('Opened elsewhere')).toBeInTheDocument());
        expect(api.markNotificationAsRead).toHaveBeenCalledTimes(1);
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('connects each tab to its panel', async () => {
        panel(counts({ needsYou: 0, updates: 0 }));
        const tab = screen.getByRole('tab', { name: /Needs you/ });
        expect(tab).toHaveAttribute('aria-controls', 'inbox-tab-needs-you-panel');
        expect(screen.getByRole('tabpanel', { name: /Needs you/ })).toHaveAttribute('id', 'inbox-tab-needs-you-panel');
    });
});
