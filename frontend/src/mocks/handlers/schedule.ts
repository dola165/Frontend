import { http, HttpHandler, HttpResponse } from 'msw';
import { events, currentUserId, nextEventId, clubs } from '../data/store';
import { simulateLatency } from '../utils';

const API = '*/api';

const toOccurrence = (e: ReturnType<typeof events> extends Map<number, infer T> ? T : never) => ({ ...e });

export const scheduleHandlers: HttpHandler[] = [

  // -- GET /schedule/clubs/{clubId}/events --
  http.get(`${API}/schedule/clubs/:clubId/events`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    const filtered = [...events().values()]
      .filter((e) => e.clubId === clubId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toOccurrence);
    return HttpResponse.json({ events: filtered, windowStart: '2026-06-01T00:00:00Z', windowEnd: '2026-07-01T00:00:00Z' });
  }),

  // -- POST /schedule/clubs/{clubId}/events --
  http.post(`${API}/schedule/clubs/:clubId/events`, async ({ params, request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      title?: string; eventType?: string; startsAt?: string; endsAt?: string;
      visibility?: string; description?: string; locationName?: string;
      locationLat?: number; locationLng?: number; opponentClubId?: number;
    };
    const clubId = Number(params.clubId);
    const c = clubs().get(clubId);
    const eventId = nextEventId();
    const evt = {
      eventId,
      occurrenceId: `occ-${eventId}`,
      clubId,
      clubName: c?.name ?? null,
      userId: uid,
      eventType: body.eventType ?? 'MATCH',
      title: body.title ?? 'Untitled Event',
      description: body.description ?? null,
      startsAt: body.startsAt ?? new Date().toISOString(),
      endsAt: body.endsAt ?? new Date(Date.now() + 7200000).toISOString(),
      locationName: body.locationName ?? null,
      locationLat: body.locationLat ?? null,
      locationLng: body.locationLng ?? null,
      visibility: body.visibility ?? 'PUBLIC',
      publishAt: null,
      publicNow: body.visibility !== 'PRIVATE',
      recurring: false,
      recurrence: null,
      opponentClubId: body.opponentClubId ?? null,
      opponentClubName: null,
      challengeStatus: null,
      status: 'SCHEDULED',
      conflict: false,
      conflictingEventIds: [] as number[],
    };
    events().set(eventId, evt);
    return HttpResponse.json({ eventId, conflict: false, conflictingEventIds: [] }, { status: 201 });
  }),

  // -- GET /schedule/me/events --
  http.get(`${API}/schedule/me/events`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    const filtered = [...events().values()]
      .filter((e) => e.userId === uid)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toOccurrence);
    return HttpResponse.json({ events: filtered, windowStart: '2026-06-01T00:00:00Z', windowEnd: '2026-07-01T00:00:00Z' });
  }),

  // -- POST /schedule/me/events --
  http.post(`${API}/schedule/me/events`, async ({ request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      title?: string; eventType?: string; startsAt?: string; endsAt?: string;
      visibility?: string; description?: string; locationName?: string;
      locationLat?: number; locationLng?: number;
    };
    const eventId = nextEventId();
    const evt = {
      eventId,
      occurrenceId: `occ-${eventId}`,
      clubId: null,
      clubName: null,
      userId: uid,
      eventType: body.eventType ?? 'TRAINING',
      title: body.title ?? 'Personal Event',
      description: body.description ?? null,
      startsAt: body.startsAt ?? new Date().toISOString(),
      endsAt: body.endsAt ?? new Date(Date.now() + 3600000).toISOString(),
      locationName: body.locationName ?? null,
      locationLat: body.locationLat ?? null,
      locationLng: body.locationLng ?? null,
      visibility: body.visibility ?? 'PRIVATE',
      publishAt: null,
      publicNow: false,
      recurring: false,
      recurrence: null,
      opponentClubId: null,
      opponentClubName: null,
      challengeStatus: null,
      status: 'SCHEDULED',
      conflict: false,
      conflictingEventIds: [] as number[],
    };
    events().set(eventId, evt);
    return HttpResponse.json({ eventId, conflict: false, conflictingEventIds: [] }, { status: 201 });
  }),

  // -- PUT /schedule/events/{eventId} --
  http.put(`${API}/schedule/events/:eventId`, async ({ params, request }) => {
    await simulateLatency();
    const eventId = Number(params.eventId);
    const existing = events().get(eventId);
    if (!existing) return HttpResponse.json({ error: 'Event not found.' }, { status: 404 });

    const body = (await request.json()) as {
      title?: string; startsAt?: string; endsAt?: string;
      description?: string; locationName?: string; visibility?: string;
    };
    if (body.title !== undefined) existing.title = body.title;
    if (body.startsAt !== undefined) existing.startsAt = body.startsAt;
    if (body.endsAt !== undefined) existing.endsAt = body.endsAt;
    if (body.description !== undefined) existing.description = body.description;
    if (body.locationName !== undefined) existing.locationName = body.locationName;
    if (body.visibility !== undefined) existing.visibility = body.visibility;
    events().set(eventId, existing);
    return HttpResponse.json({ eventId, conflict: false, conflictingEventIds: [] });
  }),

  // -- DELETE /schedule/events/{eventId} --
  http.delete(`${API}/schedule/events/:eventId`, async ({ params }) => {
    await simulateLatency();
    events().delete(Number(params.eventId));
    return new HttpResponse(null, { status: 204 });
  }),

  // -- GET /schedule/public-events --
  http.get(`${API}/schedule/public-events`, async () => {
    await simulateLatency();
    const filtered = [...events().values()]
      .filter((e) => e.visibility === 'PUBLIC')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toOccurrence);
    return HttpResponse.json({ events: filtered, windowStart: '2026-06-01T00:00:00Z', windowEnd: '2026-07-01T00:00:00Z' });
  }),

  // -- POST /schedule/events/{eventId}/challenge --
  http.post(`${API}/schedule/events/:eventId/challenge`, async ({ params }) => {
    await simulateLatency();
    const eventId = Number(params.eventId);
    const existing = events().get(eventId);
    if (existing) {
      existing.challengeStatus = 'PENDING';
      events().set(eventId, existing);
    }
    return HttpResponse.json(existing ? toOccurrence(existing) : { error: 'Event not found.' });
  }),

  // -- POST /schedule/challenges/{eventId}/response --
  http.post(`${API}/schedule/challenges/:eventId/response`, async ({ params }) => {
    await simulateLatency();
    const eventId = Number(params.eventId);
    const existing = events().get(eventId);
    if (existing) {
      existing.challengeStatus = 'ACCEPTED';
      existing.status = 'CONFIRMED';
      events().set(eventId, existing);
    }
    return HttpResponse.json(existing ? toOccurrence(existing) : { error: 'Event not found.' });
  }),
];
