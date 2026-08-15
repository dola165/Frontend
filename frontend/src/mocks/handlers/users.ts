import { http, HttpHandler, HttpResponse } from 'msw';
import { users, currentUserId } from '../data/store';
import { simulateLatency, paginate } from '../utils';
import { isMinor, isUnder13 } from '../../utils/age';

const API = '*/api';

export const userHandlers: HttpHandler[] = [

  // -- GET /users/me (returns Map<String, Object>) --
  http.get(`${API}/users/me`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const u = users().get(uid);
    if (!u) { currentUserId(null); return HttpResponse.json({ error: 'User not found.' }, { status: 401 }); }

    return HttpResponse.json({
      id: u.id, username: u.username, role: u.role, fullName: u.fullName,
      name: u.name, avatarUrl: u.avatarUrl, profileComplete: u.profileComplete,
      bio: u.bio, position: u.position, email: u.email, dob: u.dob ?? null,
    });
  }),

  // -- PUT /users/me (returns PublicUserProfileDto) --
  http.put(`${API}/users/me`, async ({ request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const u = users().get(uid)!;
    if (body.username != null) u.username = body.username as string;
    if (body.fullName != null) u.fullName = body.fullName as string;
    if (body.bio != null) u.bio = body.bio as string;
    if (body.position != null) u.position = body.position as string;
    if (body.dateOfBirth != null) {
      if (isUnder13(body.dateOfBirth as string)) {
        return HttpResponse.json({ error: 'You must be at least 13 years old.' }, { status: 400 });
      }
      u.dob = body.dateOfBirth as string;
    }

    return HttpResponse.json({
      id: u.id, username: u.username, fullName: u.fullName, avatarUrl: u.avatarUrl,
      role: u.role, bio: u.bio, position: u.position, profileComplete: u.profileComplete,
    });
  }),

  // -- PUT /users/me/profile (returns message, not user object) --
  http.put(`${API}/users/me/profile`, async ({ request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const u = users().get(uid)!;
    if (body.fullName != null) u.fullName = body.fullName as string;
    if (body.bio != null) u.bio = body.bio as string;
    if (body.position != null) u.position = body.position as string;

    return HttpResponse.json({ message: 'Profile completed successfully' });
  }),

  // -- GET /users/me/account (returns CurrentAccountDto) --
  http.get(`${API}/users/me/account`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const u = users().get(uid)!;
    return HttpResponse.json({
      id: u.id, email: u.email, username: u.username, role: u.role,
      fullName: u.fullName, createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
      emailVerified: true, profileComplete: u.profileComplete,
    });
  }),

  // -- GET /users/:id (returns PublicUserProfileDto) --
  http.get(`${API}/users/:userId`, async ({ params }) => {
    await simulateLatency();
    const id = Number(params.userId);
    const u = users().get(id);
    if (!u) return HttpResponse.json({ error: 'User not found.' }, { status: 404 });

    return HttpResponse.json({
      id: u.id, username: u.username, fullName: u.fullName, avatarUrl: u.avatarUrl,
      role: u.role, bio: u.bio, position: u.position, profileComplete: u.profileComplete,
    });
  }),

  // -- POST /users/:id/follow (returns { following: boolean }) --
  http.post(`${API}/users/:userId/follow`, async () => {
    await simulateLatency();
    return HttpResponse.json({ following: true });
  }),

  // -- POST /users/:id/mute --
  http.post(`${API}/users/:userId/mute`, async () => {
    await simulateLatency();
    return HttpResponse.json({ muted: true });
  }),

  // -- POST /users/:id/block --
  http.post(`${API}/users/:userId/block`, async () => {
    await simulateLatency();
    return HttpResponse.json({ blocked: true });
  }),

  // -- GET /users/search (query param is "query", not "q") --
  http.get(`${API}/users/search`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    const hits = [...users().values()].filter((u) => {
      if (!query) return true;
      return (u.username ?? '').toLowerCase().includes(query)
        || (u.fullName ?? '').toLowerCase().includes(query);
    });

    return HttpResponse.json(paginate(hits.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      isMinor: isMinor(u.dob),
      username: u.username,
      avatarUrl: u.avatarUrl,
      position: u.position,
      userType: u.role,
    })), page, size));
  }),
];
