import { http, HttpHandler, HttpResponse } from 'msw';
import { clubs, currentUserId, users, followedClubIds, events } from '../data/store';
import { simulateLatency, paginate } from '../utils';
import { createClub } from '../data/factories';

const API = '*/api';

const clubTypeLabel = (name: string): string => {
  if (name.toLowerCase().includes('academy')) return 'Academy';
  if (name.toLowerCase().includes('athletic')) return 'Semi-Professional';
  return 'Grassroots';
};

const relationshipForUser = (clubId: number): string => {
  if (currentUserId() == null) return 'NONE';
  const c = clubs().get(clubId);
  if (!c) return 'NONE';
  if (c.ownerId === currentUserId()) return 'ACTIVE';
  return 'NONE';
};

const mapKind = (eventType: string): 'MATCH' | 'TRYOUT' | 'AVAILABILITY' => {
  if (eventType === 'MATCH' || eventType === 'FRIENDLY') return 'MATCH';
  if (eventType === 'TRYOUT') return 'TRYOUT';
  return 'AVAILABILITY';
};

const mapVisibility = (v: string): 'PUBLIC' | 'CLUB_ADMIN' => {
  return v === 'PUBLIC' ? 'PUBLIC' : 'CLUB_ADMIN';
};

const mapStatus = (s: string): 'OPEN' | 'SCHEDULED' | 'CONFIRMED' | 'PENDING_ACCEPTANCE' | 'CANCELLED' | 'COMPLETED' => {
  if (s === 'OPEN') return 'OPEN';
  if (s === 'CONFIRMED') return 'CONFIRMED';
  if (s === 'CANCELLED') return 'CANCELLED';
  if (s === 'COMPLETED') return 'COMPLETED';
  return 'SCHEDULED';
};

const toScheduleItem = (e: ReturnType<typeof events> extends Map<number, infer T> ? T : never) => ({
  id: String(e.eventId),
  kind: mapKind(e.eventType),
  title: e.title,
  subtitle: e.opponentClubName ?? e.description ?? null,
  startsAt: e.startsAt,
  locationText: e.locationName ?? null,
  status: mapStatus(e.status),
  visibility: mapVisibility(e.visibility),
  details: e.description ?? null,
});

const toClubDirectoryItem = (c: ReturnType<typeof clubs> extends Map<number, infer T> ? T : never) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  type: clubTypeLabel(c.name),
  isOfficial: c.joinPolicy === 'INVITE_ONLY',
  followerCount: Math.floor(c.memberCount * 1.5),
  memberCount: c.memberCount,
  isFollowedByMe: followedClubIds().has(c.id),
  addressText: c.city,
  logoUrl: c.logoUrl ?? undefined,
  joinPolicy: c.joinPolicy,
  relationshipState: relationshipForUser(c.id) as 'NONE' | 'ACTIVE',
  latitude: c.city === 'Bristol' ? 51.4545 : c.city === 'Manchester' ? 53.4808 : 51.5074,
  longitude: c.city === 'Bristol' ? -2.5879 : c.city === 'Manchester' ? -2.2426 : -0.1278,
});

const toClubProfile = (c: ReturnType<typeof clubs> extends Map<number, infer T> ? T : never) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  type: clubTypeLabel(c.name),
  isOfficial: c.joinPolicy === 'INVITE_ONLY',
  statusLabel: 'Active',
  followerCount: Math.floor(c.memberCount * 1.5),
  memberCount: c.memberCount,
  isFollowedByMe: followedClubIds().has(c.id),
  isStaffMember: c.ownerId === currentUserId(),
  isMember: c.ownerId === currentUserId(),
  myRole: c.ownerId === currentUserId() ? 'OWNER' : null,
  playerJoinPolicy: c.joinPolicy,
  playerAffiliationStatus: c.ownerId === currentUserId() ? 'ACTIVE' : null,
  relationshipState: relationshipForUser(c.id),
  pendingApplicationId: null,
  pendingApplicationRole: null,
  addressText: c.city,
  logoUrl: c.logoUrl ?? undefined,
  bannerUrl: c.bannerUrl ?? undefined,
  foundedYear: c.name.includes('Academy') ? 2010 : c.name.includes('Athletic') ? 2005 : 2018,
  level: c.joinPolicy === 'INVITE_ONLY' ? 'Semi-Professional' : 'Amateur',
  trustedByClubs: [] as Array<{ clubId: number; clubName: string }>,
  honours: [
    { id: 1, title: 'Community Club of the Year', yearWon: 2024, description: 'Awarded by the regional FA for outstanding grassroots contribution.' },
    { id: 2, title: 'Fair Play Award', yearWon: 2023 },
  ],
  opportunities: [] as Array<{ id: number; type: 'FUNDRAISING' | 'JOB' | 'VOLUNTEER' | 'WISHLIST'; title: string; externalLink: string }>,
  whatsappNumber: null,
  facebookMessengerUrl: null,
  preferredCommunicationMethod: null,
  email: null,
  websiteUrl: null,
  instagramUrl: null,
  latitude: c.city === 'Bristol' ? 51.4545 : c.city === 'Manchester' ? 53.4808 : 51.5074,
  longitude: c.city === 'Bristol' ? -2.5879 : c.city === 'Manchester' ? -2.2426 : -0.1278,
});

export const clubHandlers: HttpHandler[] = [

  // -- GET /clubs (returns flat List<ClubProfileDto>) --
  http.get(`${API}/clubs`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();

    let items = [...clubs().values()];
    if (q) items = items.filter((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));

    return HttpResponse.json(items.map(toClubDirectoryItem));
  }),

  // -- GET /clubs/search (params: query, size) --
  http.get(`${API}/clubs/search`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const size = Number(url.searchParams.get('size') ?? 10);

    const items = [...clubs().values()]
      .filter((c) => c.name.toLowerCase().includes(query))
      .slice(0, size)
      .map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl, memberCount: c.memberCount, city: c.city }));

    return HttpResponse.json(items);
  }),

  // -- GET /clubs/:id --
  http.get(`${API}/clubs/:clubId`, async ({ params }) => {
    await simulateLatency();
    const c = clubs().get(Number(params.clubId));
    if (!c) return HttpResponse.json({ error: 'Club not found.' }, { status: 404 });
    return HttpResponse.json(toClubProfile(c));
  }),

  // -- GET /clubs/my-club --
  http.get(`${API}/clubs/my-club`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return new HttpResponse(null, { status: 204 });
    const owned = [...clubs().values()].find((c) => c.ownerId === uid);
    if (!owned) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json(toClubProfile(owned));
  }),

  // -- POST /clubs (returns ClubDto) --
  http.post(`${API}/clubs`, async ({ request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { name?: string; description?: string; city?: string; joinPolicy?: string };
    if (!body.name) return HttpResponse.json({ error: 'Name is required.' }, { status: 400 });

    const c = createClub({
      name: body.name,
      description: body.description,
      city: body.city ?? 'Unknown',
      joinPolicy: (body.joinPolicy as 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY') ?? 'OPEN_TRIAL',
      ownerId: uid,
    });
    clubs().set(c.id, c);

    return HttpResponse.json({ id: c.id, name: c.name, slug: c.slug, logoUrl: c.logoUrl, memberCount: 1 }, { status: 201 });
  }),

  // -- PUT /clubs/:id (returns empty 200) --
  http.put(`${API}/clubs/:clubId`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- GET /clubs/my-membership-context --
  http.get(`${API}/clubs/my-membership-context`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ hasClubMembership: false, canCreateClub: false });

    const user = users().get(uid);
    const canCreate = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
    const owned = [...clubs().values()].find((c) => c.ownerId === uid);

    return HttpResponse.json({
      hasClubMembership: Boolean(owned),
      canCreateClub: canCreate,
      clubId: owned?.id ?? null,
      clubName: owned?.name ?? null,
      myRole: owned ? 'OWNER' : null,
    });
  }),

  // -- POST /clubs/:id/follow (returns { following: boolean }) --
  http.post(`${API}/clubs/:clubId/follow`, async ({ params }) => {
    await simulateLatency();
    followedClubIds().add(Number(params.clubId));
    return HttpResponse.json({ following: true });
  }),

  // -- DELETE /clubs/:id/follow (returns { following: boolean }) --
  http.delete(`${API}/clubs/:clubId/follow`, async ({ params }) => {
    await simulateLatency();
    followedClubIds().delete(Number(params.clubId));
    return HttpResponse.json({ following: false });
  }),

  // -- POST /clubs/:id/mute --
  http.post(`${API}/clubs/:clubId/mute`, async () => {
    await simulateLatency();
    return HttpResponse.json({ muted: true });
  }),

  // -- POST /clubs/:id/challenge (returns message) --
  http.post(`${API}/clubs/:clubId/challenge`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Challenge issued successfully.' });
  }),

  // -- GET /clubs/:id/roster --
  http.get(`${API}/clubs/:clubId/roster`, async () => {
    await simulateLatency();
    return HttpResponse.json([...users().values()].map((u) => ({
      userId: u.id, fullName: u.fullName, username: u.username,
      avatarUrl: u.avatarUrl, position: u.position, role: u.role, status: 'ACTIVE',
    })));
  }),

  // -- GET /clubs/:id/staff --
  http.get(`${API}/clubs/:clubId/staff`, async () => {
    await simulateLatency();
    return HttpResponse.json([...users().values()].slice(0, 2).map((u) => ({
      userId: u.id, fullName: u.fullName, username: u.username, avatarUrl: u.avatarUrl, role: u.role,
    })));
  }),

  // -- GET /clubs/:id/calendar --
  http.get(`${API}/clubs/:clubId/calendar`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    const items = [...events().values()]
      .filter((e) => e.clubId === clubId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toScheduleItem);
    return HttpResponse.json(items);
  }),

  // -- GET /clubs/:id/schedule --
  http.get(`${API}/clubs/:clubId/schedule`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    const items = [...events().values()]
      .filter((e) => e.clubId === clubId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toScheduleItem);
    return HttpResponse.json(items);
  }),

  // -- POST /clubs/:id/calendar --
  http.post(`${API}/clubs/:clubId/calendar`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Event deployed successfully.' });
  }),

  // -- DELETE /clubs/:id/calendar/:eventId --
  http.delete(`${API}/clubs/:clubId/calendar/:eventId`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Event deleted successfully.' });
  }),

  // -- MANAGEMENT ENDPOINTS --

  // -- GET /clubs/:id/management --
  http.get(`${API}/clubs/:clubId/management`, async ({ params }) => {
    await simulateLatency();
    const c = clubs().get(Number(params.clubId));
    if (!c) return HttpResponse.json({ error: 'Club not found.' }, { status: 404 });

    return HttpResponse.json({
      currentUserRole: c.ownerId === currentUserId() ? 'OWNER' : null,
      assignableInviteRoles: ['COACH', 'PLAYER'],
      assignableStaffRoles: ['CLUB_ADMIN', 'COACH'],
      activePlayerCount: c.memberCount,
      trialistCount: 3,
      members: [],
      pendingInvitations: [],
      pendingApplications: [],
    });
  }),

  // -- GET /clubs/:id/management/user-search --
  http.get(`${API}/clubs/:clubId/management/user-search`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 10);

    const hits = [...users().values()]
      .filter((u) => u.id !== currentUserId()
        && ((u.username ?? '').toLowerCase().includes(query) || (u.fullName ?? '').toLowerCase().includes(query)))
      .map((u) => ({ id: u.id, fullName: u.fullName, username: u.username, position: u.position, userType: u.role }));

    return HttpResponse.json(paginate(hits, page, size));
  }),

  // -- POST /clubs/:id/management/invitations (returns { invitationId }) --
  http.post(`${API}/clubs/:clubId/management/invitations`, async () => {
    await simulateLatency();
    return HttpResponse.json({ invitationId: Math.floor(Math.random() * 1000) + 500 }, { status: 201 });
  }),

  // -- DELETE /clubs/:id/management/invitations/:inviteId (returns empty 200) --
  http.delete(`${API}/clubs/:clubId/management/invitations/:inviteId`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- PATCH /clubs/:id/management/members/:userId/role (returns empty 200) --
  http.patch(`${API}/clubs/:clubId/management/members/:userId/role`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- POST /clubs/:id/management/members/:userId/remove (returns empty 200) --
  http.post(`${API}/clubs/:clubId/management/members/:userId/remove`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- POST /clubs/:id/membership/leave (returns empty 200) --
  http.post(`${API}/clubs/:clubId/membership/leave`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- POST /clubs/:id/ownership/transfer (returns empty 200) --
  http.post(`${API}/clubs/:clubId/ownership/transfer`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- GET /clubs/:id/management/applications --
  http.get(`${API}/clubs/:clubId/management/applications`, async () => {
    await simulateLatency();
    return HttpResponse.json([]);
  }),

  // -- POST /clubs/:id/management/applications/:appId/accept (returns empty 200) --
  http.post(`${API}/clubs/:clubId/management/applications/:appId/accept`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- POST /clubs/:id/management/applications/:appId/decline (returns empty 200) --
  http.post(`${API}/clubs/:clubId/management/applications/:appId/decline`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- POST /clubs/:id/applications (returns { applicationId }) --
  http.post(`${API}/clubs/:clubId/applications`, async () => {
    await simulateLatency();
    return HttpResponse.json({ applicationId: Math.floor(Math.random() * 1000) + 500 }, { status: 201 });
  }),

  // -- POST /clubs/:id/players/self-register (returns ClubPlayerAffiliationDto) --
  http.post(`${API}/clubs/:clubId/players/self-register`, async () => {
    await simulateLatency();
    const uid = currentUserId() ?? 1;
    return HttpResponse.json({
      userId: uid, fullName: users().get(uid)?.fullName ?? null,
      username: users().get(uid)?.username, avatarUrl: users().get(uid)?.avatarUrl ?? null,
      status: 'TRIALIST', primary: false, joinedAt: new Date().toISOString(),
      source: 'self', endedAt: null,
    }, { status: 201 });
  }),

  // -- GET /clubs/:id/players (returns PageResult<ClubPlayerAffiliationDto>) --
  http.get(`${API}/clubs/:clubId/players`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    const all = [...users().values()].map((u) => ({
      userId: u.id, fullName: u.fullName, username: u.username, avatarUrl: u.avatarUrl,
      status: 'ACTIVE' as const, primary: u.id === currentUserId(),
      source: 'invited', joinedAt: new Date().toISOString(), endedAt: null,
    }));

    return HttpResponse.json(paginate(all, page, size));
  }),

  // -- PATCH /clubs/:id/players/:userId (returns ClubPlayerAffiliationDto) --
  http.patch(`${API}/clubs/:clubId/players/:userId`, async ({ params }) => {
    await simulateLatency();
    const u = users().get(Number(params.userId));
    return HttpResponse.json({
      userId: Number(params.userId), fullName: u?.fullName ?? null,
      username: u?.username, avatarUrl: u?.avatarUrl ?? null,
      status: 'ACTIVE', primary: false, source: 'invited',
      joinedAt: new Date().toISOString(), endedAt: null,
    });
  }),

  // -- POST /clubs/:id/applications/:appId/cancel --
  http.post(`${API}/clubs/:clubId/applications/:appId/cancel`, async () => {
    await simulateLatency();
    return HttpResponse.json({ status: 'CANCELLED' });
  }),

  // -- OPPORTUNITIES --
  http.post(`${API}/clubs/:clubId/opportunities`, async () => {
    await simulateLatency();
    return HttpResponse.json({ opportunityId: Math.floor(Math.random() * 100) + 50 }, { status: 201 });
  }),

  http.delete(`${API}/clubs/:clubId/opportunities/:opportunityId`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- HONOURS --
  http.post(`${API}/clubs/:clubId/honours`, async () => {
    await simulateLatency();
    return HttpResponse.json({ honourId: Math.floor(Math.random() * 100) + 50 }, { status: 201 });
  }),

  http.delete(`${API}/clubs/:clubId/honours/:honourId`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 200 });
  }),

  // -- SQUADS (real path: /api/clubs/{clubId}/squads) --
  http.get(`${API}/clubs/:clubId/squads`, async () => {
    await simulateLatency();
    return HttpResponse.json([
      { id: 1, name: 'First Team', memberCount: 18, clubId: 1 },
      { id: 2, name: 'U18', memberCount: 14, clubId: 1 },
    ]);
  }),

  http.get(`${API}/clubs/:clubId/squads/:squadId/roster`, async () => {
    await simulateLatency();
    return HttpResponse.json([{
      groupName: 'Starting XI', players: [...users().values()].slice(0, 3).map((u) => ({
        userId: u.id, fullName: u.fullName, username: u.username, avatarUrl: u.avatarUrl, position: u.position,
      })),
    }]);
  }),

  http.post(`${API}/clubs/:clubId/squads`, async () => {
    await simulateLatency();
    return HttpResponse.json({ id: 3, name: 'New Squad', memberCount: 0, clubId: 1 }, { status: 201 });
  }),

  http.post(`${API}/clubs/:clubId/squads/:squadId/players`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Player added to squad successfully.' });
  }),

  http.delete(`${API}/clubs/:clubId/squads/:squadId/players/:userId`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Player removed from squad successfully.' });
  }),

  // -- CLUB MEMBERSHIPS --
  http.get(`${API}/club-memberships/me`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json([]);

    const owned = [...clubs().values()].filter((c) => c.ownerId === uid);
    return HttpResponse.json(owned.map((c) => ({
      clubId: c.id, clubName: c.name, role: 'OWNER', status: 'ACTIVE', primary: true, logoUrl: c.logoUrl,
    })));
  }),

  http.get(`${API}/club-memberships/invites/me`, async () => {
    await simulateLatency();
    return HttpResponse.json([]);
  }),

  http.post(`${API}/club-memberships/invites/:inviteId/accept`, async () => {
    await simulateLatency();
    return HttpResponse.json({ status: 'ACCEPTED' });
  }),

  http.post(`${API}/club-memberships/invites/:inviteId/decline`, async () => {
    await simulateLatency();
    return HttpResponse.json({ status: 'DECLINED' });
  }),
];
