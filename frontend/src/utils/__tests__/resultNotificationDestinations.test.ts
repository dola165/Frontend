import { buildNotificationDestination } from '../notifications';
import { safeNotificationLink } from '../notificationDestinations';
import type { NotificationItem } from '../../types/notifications';

const item: NotificationItem = { id: 9, type: 'SCHEDULE_EVENT_UPDATED', scope: 'PERSONAL', entityType: 'match_result_suggestion', entityId: 90, title: 'Suggestion reviewed', body: 'Review the result', isRead: false, createdAt: '2026-09-22', linkPath: '/match-exchange/12#result', eventId: 12 };
it('uses the result event metadata rather than mistaking the audit ID for a match ID', () => {
  expect(buildNotificationDestination(item)).toBe('/match-exchange/12#result');
  expect(buildNotificationDestination({ ...item, entityType: 'match_result' })).toBe('/match-exchange/12#result');
});
it('rejects mismatched event metadata while retaining safe legacy result links and rejecting unsafe anchors', () => {
  expect(buildNotificationDestination({ ...item, eventId: 13 })).toBe('/notifications?itemId=9');
  expect(buildNotificationDestination({ ...item, eventId: undefined })).toBe('/match-exchange/12#result');
  expect(safeNotificationLink('/match-exchange/12#unsafe')).toBeNull();
});
