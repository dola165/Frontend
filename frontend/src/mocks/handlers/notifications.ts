import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency, paginate } from '../utils';

const API = '*/api';

export const notificationHandlers: HttpHandler[] = [

  // -- GET /notifications (returns PageResult<NotificationDto>) --
  http.get(`${API}/notifications`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    const items = [
      { id: 1, type: 'CLUB_INVITE', scope: 'PERSONAL', clubId: 2, clubName: 'Metro United Academy', entityType: 'CLUB', entityId: 2, title: 'Club Invitation', body: 'You have been invited to join Metro United Academy as a Player.', isRead: false, createdAt: new Date(Date.now() - 3600000).toISOString(), linkPath: '/clubs/2' },
      { id: 2, type: 'EVENT_REMINDER', scope: 'CLUB', clubId: 1, clubName: 'Creekside FC', entityType: 'EVENT', entityId: 1, title: 'Match Tomorrow', body: 'Your match against Westbrook is tomorrow at 15:00.', isRead: false, createdAt: new Date(Date.now() - 7200000).toISOString(), linkPath: '/calendar' },
      { id: 3, type: 'POST_LIKE', scope: 'PERSONAL', entityType: 'POST', entityId: 4, title: 'New Like', body: 'Sarah Chen liked your post.', isRead: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 4, type: 'COMMENT', scope: 'PERSONAL', entityType: 'POST', entityId: 4, title: 'New Comment', body: 'James Wilson commented on your post.', isRead: true, createdAt: new Date(Date.now() - 172800000).toISOString() },
      { id: 5, type: 'TOURNAMENT_INVITE', scope: 'CLUB', clubId: 3, clubName: 'Lakeside Athletic', entityType: 'TOURNAMENT', entityId: 1, title: 'Tournament Invitation', body: 'You have been invited to the Summer Cup 2026.', isRead: false, createdAt: new Date().toISOString(), linkPath: '/tournaments/1' },
      // Phase A2 — a decision notification carrying trial instructions.
      { id: 6, type: 'CLUB_APPLICATION_ACCEPTED', scope: 'PERSONAL', clubId: 1, clubName: 'Creekside FC', entityType: 'CLUB', entityId: 1, title: 'Club application update', body: "You've been invited to trial at Creekside FC — Thursday 18:00, pitch 2. Bring boots, shin pads and water. Parents must attend.", isRead: false, createdAt: new Date(Date.now() - 900000).toISOString(), linkPath: '/clubs/1' },
    ];

    return HttpResponse.json(paginate(items, page, size));
  }),

  // -- GET /notifications/unread-count (returns NotificationUnreadCountDto) --
  http.get(`${API}/notifications/unread-count`, async () => {
    await simulateLatency();
    return HttpResponse.json({ unreadCount: 3 });
  }),

  // -- PATCH /notifications/:id/read (returns NotificationReadStateDto) --
  http.patch(`${API}/notifications/:id/read`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json({ id: Number(params.id), isRead: true });
  }),

  // -- PATCH /notifications/read-all (returns NotificationBulkReadResultDto) --
  http.patch(`${API}/notifications/read-all`, async () => {
    await simulateLatency();
    return HttpResponse.json({ count: 3 });
  }),
];
