import { buildNotificationDestination } from '../notifications';
import { safeNotificationLink } from '../notificationDestinations';
import type { NotificationItem } from '../../types/notifications';

const mention: NotificationItem = { id: 6, type: 'TEAM_CHAT_MENTION', scope: 'PERSONAL', entityType: 'conversation', entityId: 5, title: 'Gio მოგიხსენიათ · Pitch booking', body: '@Nino look at GK-2', isRead: false, createdAt: '2026-10-24', linkPath: '/team-work/chat?chat=5&message=17' };

it('opens the right team chat at the message a mention points to, and the chat itself for new messages or a coming deletion', () => {
    expect(buildNotificationDestination(mention)).toBe('/team-work/chat?chat=5&message=17');
    expect(buildNotificationDestination({ ...mention, type: 'TEAM_CHAT_MESSAGES', linkPath: '/team-work/chat?chat=5' })).toBe('/team-work/chat?chat=5');
    expect(buildNotificationDestination({ ...mention, type: 'TEAM_CHAT_DELETED', linkPath: '/team-work/chat?chat=5' })).toBe('/team-work/chat?chat=5');
});

it('still opens a link from when the team had one chat', () => {
    expect(safeNotificationLink('/team-work/chat?message=17')?.search).toBe('?message=17');
    expect(safeNotificationLink('/team-work/chat')?.pathname).toBe('/team-work/chat');
});

it('takes nothing else from a team chat link', () => {
    expect(safeNotificationLink('/team-work/chat?message=abc')).toBeNull();
    expect(safeNotificationLink('/team-work/chat?chat=abc')).toBeNull();
    expect(safeNotificationLink('/team-work/chat?chat=5&tab=media')).toBeNull();
    expect(safeNotificationLink('/team-work/chat?chat=5&message=17#x')).toBeNull();
    expect(safeNotificationLink('/messages?message=17')).toBeNull();
    expect(safeNotificationLink('/team-work/chats')).toBeNull();
});
