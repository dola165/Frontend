import { http, HttpHandler, HttpResponse } from 'msw';
import { clubs, currentUserId, users, followedClubIds, events, jobs, playerCards, type StoreClub, type StoreJob, type StorePlayerCard } from '../data/store';
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
  pendingApplicationJobId: null, // mock limitation — job applications don't persist a profile link
  category: c.category ?? null,
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

  // -- GET /me/club-journey (phase A4) --
  http.get(`${API}/me/club-journey`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      applications: [
        { applicationId: 601, clubId: 2, clubName: 'Metro United Academy', role: 'PLAYER', status: 'PENDING', createdAt: new Date(Date.now() - 86400000).toISOString(), decisionMessage: null },
        { applicationId: 602, clubId: 3, clubName: 'Lakeside Athletic', role: 'PLAYER', status: 'DECLINED', createdAt: new Date(Date.now() - 604800000).toISOString(), decisionMessage: 'This intake is full — try again at our next tryouts. Keep training!' },
      ],
      invitations: [
        { inviteId: 701, clubId: 4, clubName: 'Creekside FC', role: 'PLAYER', createdAt: new Date(Date.now() - 43200000).toISOString(), expiresAt: new Date(Date.now() + 6 * 86400000).toISOString() },
      ],
      tryouts: [
        { tryoutApplicationId: 801, tryoutId: 11, clubId: 2, clubName: 'Metro United Academy', title: 'U15 Open Tryout', tryoutDate: new Date(Date.now() + 3 * 86400000).toISOString(), status: 'ACCEPTED', decisionMessage: 'Thursday 18:00, pitch 2. Bring boots, shin pads and water.' },
      ],
      affiliations: [
        { clubId: 2, clubName: 'Metro United Academy', status: 'TRIALIST', squadName: 'U15', trialEndsOn: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), consentStatus: 'PENDING', joinedAt: new Date(Date.now() - 172800000).toISOString(), endedAt: null },
      ],
      recentDecisions: [
        { kind: 'TRYOUT', clubName: 'Metro United Academy', status: 'ACCEPTED', decidedAt: new Date(Date.now() - 3600000).toISOString(), message: 'Thursday 18:00, pitch 2. Bring boots, shin pads and water.' },
        { kind: 'APPLICATION', clubName: 'Lakeside Athletic', status: 'DECLINED', decidedAt: new Date(Date.now() - 259200000).toISOString(), message: 'This intake is full — try again at our next tryouts. Keep training!' },
      ],
    });
  }),

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

  // Phase 2 §4.4: join-policy settings (owner/admin only in the real backend)
  http.patch(`${API}/clubs/:clubId`, async ({ params, request }) => {
    await simulateLatency();
    const club = clubs().get(Number(params.clubId));
    const body = (await request.json()) as { playerJoinPolicy?: string };
    if (club && body.playerJoinPolicy) {
      club.joinPolicy = body.playerJoinPolicy as StoreClub['joinPolicy'];
    }
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

  // -- GET /clubs/:id/management/applications (phase A3: enriched + filters) --
  http.get(`${API}/clubs/:clubId/management/applications`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const position = url.searchParams.get('position');
    const ageGroup = url.searchParams.get('ageGroup');
    const status = url.searchParams.get('status');

    type AppRow = {
      id: number; userId: number; fullName: string | null; username: string; avatarUrl: string | null;
      role: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'; message: string | null;
      createdAt: string; position: string | null; ageGroup: string | null; jobId: number | null; jobTitle: string | null;
      age: number | null; preferredFoot: string | null; heightCm: number | null;
      currentClubName: string | null; careerHistoryCount: number | null; isMinor: boolean | null; currentConsentStatus: string | null;
    };
    const seed: AppRow[] = [
      { id: 501, userId: 21, fullName: 'Luka Trialist', username: 'luka.trial', avatarUrl: null, role: 'PLAYER', status: 'PENDING', message: 'I want to join the U15s.', createdAt: new Date(Date.now() - 86400000).toISOString(), position: 'STRIKER', ageGroup: 'U15', jobId: null, jobTitle: null, age: 15, preferredFoot: 'LEFT', heightCm: 176, currentClubName: 'Saburtalo Academy', careerHistoryCount: 2, isMinor: true, currentConsentStatus: 'PENDING' },
      { id: 502, userId: 22, fullName: 'Nika Goalkeeper', username: 'nika.gk', avatarUrl: null, role: 'PLAYER', status: 'PENDING', message: 'GK looking for a club.', createdAt: new Date(Date.now() - 172800000).toISOString(), position: 'GOALKEEPER', ageGroup: 'U16', jobId: null, jobTitle: null, age: 17, preferredFoot: 'RIGHT', heightCm: 188, currentClubName: null, careerHistoryCount: 4, isMinor: true, currentConsentStatus: null },
      { id: 503, userId: 23, fullName: 'Adult Coach Candidate', username: 'coach.cand', avatarUrl: null, role: 'COACH', status: 'DECLINED', message: 'U14 coach opening.', createdAt: new Date(Date.now() - 259200000).toISOString(), position: null, ageGroup: 'U14', jobId: null, jobTitle: null, age: 32, preferredFoot: null, heightCm: null, currentClubName: null, careerHistoryCount: null, isMinor: false, currentConsentStatus: null },
    ];
    let rows = seed;
    if (status) rows = rows.filter((r) => r.status === status);
    else rows = rows.filter((r) => r.status === 'PENDING');
    if (position) rows = rows.filter((r) => r.position === position);
    if (ageGroup) rows = rows.filter((r) => r.ageGroup === ageGroup);
    return HttpResponse.json(rows);
  }),

  // -- POST /clubs/:id/applications/bulk-decide (phase A3) --
  http.post(`${API}/clubs/:clubId/applications/bulk-decide`, async ({ request }) => {
    await simulateLatency();
    const body = await request.json().catch(() => ({})) as { applicationIds?: number[]; action?: string };
    const ids = body.applicationIds ?? [];
    return HttpResponse.json({
      results: ids.map((id) => ({
        applicationId: id,
        status: id === 503 ? 'SKIPPED' : body.action ?? 'ACCEPT',
        reason: id === 503 ? 'Only pending applications can be decided.' : null,
      })),
    });
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
    const status = url.searchParams.get('status');

    const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'DEF', 'MID', 'FWD', 'GK', 'DEF', 'MID', 'FWD', 'DEF'];
    type PlayerRow = {
        userId: number; fullName: string | null; username: string | null; avatarUrl: string | null;
        status: 'ACTIVE' | 'TRIALIST'; primary: boolean; source: string; joinedAt: string; endedAt: null;
        position: string | null; jerseyNumber: number | null; trialEndsOn: string | null;
        requiresParentalConsent: boolean; parentalConsentStatus?: string | null; parentEmail?: string | null;
    };
    const all: PlayerRow[] = [...users().values()].map((u, i) => ({
      userId: u.id, fullName: u.fullName ?? null, username: u.username ?? null, avatarUrl: u.avatarUrl ?? null,
      status: 'ACTIVE', primary: u.id === currentUserId(),
      source: 'invited', joinedAt: new Date(Date.now() - (i * 86400000 * 30)).toISOString(), endedAt: null,
      position: u.position || POSITIONS[i % POSITIONS.length],
      jerseyNumber: i + 1,
      trialEndsOn: null,
      requiresParentalConsent: false,
    }));

    // Phase A1/A5 — a demo trialist so the trialists queue is visible in mock
    // mode; the consent flag is set (A5) so the consent column offers "Send consent".
    all.push({
      userId: 999, fullName: 'Giorgi Trialist', username: 'giorgi.trial', avatarUrl: null,
      status: 'TRIALIST', primary: false, source: 'application',
      joinedAt: new Date(Date.now() - 5 * 86400000).toISOString(), endedAt: null,
      position: 'FWD', jerseyNumber: null, trialEndsOn: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      requiresParentalConsent: true, parentalConsentStatus: 'NOT_REQUIRED', parentEmail: null,
    });

    const filtered = status ? all.filter((p) => p.status === status) : all;
    return HttpResponse.json(paginate(filtered, page, size));
  }),

  // -- PATCH /clubs/:id/players/:userId (returns ClubPlayerAffiliationDto) --
  http.patch(`${API}/clubs/:clubId/players/:userId`, async ({ params, request }) => {
    await simulateLatency();
    const u = users().get(Number(params.userId));
    const body = (await request.json().catch(() => ({}))) as { status?: string; trialEndsOn?: string | null };
    const isTrialistSeed = Number(params.userId) === 999;
    return HttpResponse.json({
      userId: Number(params.userId), fullName: isTrialistSeed ? 'Giorgi Trialist' : u?.fullName ?? null,
      username: isTrialistSeed ? 'giorgi.trial' : u?.username, avatarUrl: u?.avatarUrl ?? null,
      status: isTrialistSeed ? 'TRIALIST' : body.status ?? 'ACTIVE', primary: false,
      source: isTrialistSeed ? 'application' : 'invited',
      joinedAt: new Date().toISOString(), endedAt: null,
      trialEndsOn: body.trialEndsOn ?? null,
    });
  }),

  // -- POST /clubs/:id/players/:userId/promote (phase A1) --
  http.post(`${API}/clubs/:clubId/players/:userId/promote`, async ({ params, request }) => {
    await simulateLatency();
    const u = users().get(Number(params.userId));
    const body = (await request.json().catch(() => ({}))) as { squadId?: number; trialEndsOn?: string | null };
    const isTrialistSeed = Number(params.userId) === 999;
    return HttpResponse.json({
      userId: Number(params.userId), fullName: isTrialistSeed ? 'Giorgi Trialist' : u?.fullName ?? null,
      username: isTrialistSeed ? 'giorgi.trial' : u?.username, avatarUrl: u?.avatarUrl ?? null,
      status: 'ACTIVE', primary: true, source: 'application',
      joinedAt: new Date().toISOString(), endedAt: null,
      trialEndsOn: body.trialEndsOn ?? null,
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

  http.get(`${API}/clubs/:clubId/squads/:squadId/roster`, async ({ params }) => {
    await simulateLatency();
    const STATUSES = ['ACTIVE', 'ACTIVE', 'TRIALIST', 'ACTIVE', 'ACTIVE', 'PAST'];
    const regularPlayers = [...users().values()].slice(0, 6).map((u, i) => ({
      id: u.id, number: i + 1, name: u.fullName || u.username, position: u.position,
      age: 18 + (i % 15), status: STATUSES[i % STATUSES.length],
      joinedAt: new Date(Date.now() - (i * 86400000 * 7)).toISOString(),
      photoUrl: null, isRegistered: true, squadRole: 'PLAYER',
    }));
    // Aug 17: cards render as "Not registered" roster rows with the edit affordance.
    const cardRows = [...playerCards().values()]
      .filter((c) => c.clubId === Number(params.clubId))
      .map((c) => ({
        id: c.userId, number: c.jerseyNumber ?? null, name: c.fullName, position: c.position,
        age: new Date().getFullYear() - c.birthYear, status: 'TRIALIST',
        joinedAt: new Date().toISOString(),
        photoUrl: c.photoUrl, isRegistered: false, squadRole: 'PLAYER',
      }));
    return HttpResponse.json([{
      label: 'Starting XI', players: [...regularPlayers, ...cardRows],
    }]);
  }),

  // -- player cards (WEB_APP_MASTER_PLAN.md §2.2; workspace tab Aug 17) --
  http.get(`${API}/clubs/:clubId/player-cards`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(
      [...playerCards().values()].filter((c) => c.clubId === Number(params.clubId))
    );
  }),

  http.post(`${API}/clubs/:clubId/player-cards`, async ({ params, request }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    const body = (await request.json()) as Record<string, unknown>;
    const year = Number(body.birthYear);
    if (!body.fullName) {
      return HttpResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }
    if (!year || year < 1990 || year > new Date().getFullYear() - 4) {
      return HttpResponse.json({ error: 'Birth year is invalid.' }, { status: 400 });
    }
    if (body.photoUrl && new Date().getFullYear() - year < 13) {
      return HttpResponse.json({ error: 'Player cards for players under 13 cannot have a photo.' }, { status: 400 });
    }
    const id = Math.floor(Math.random() * 100000) + 1000;
    const card: StorePlayerCard = {
      id,
      clubId,
      userId: 900000 + id,
      fullName: body.fullName as string,
      birthYear: year,
      position: (body.position as string | null) ?? null,
      jerseyNumber: (body.jerseyNumber as number | null) ?? null,
      photoUrl: (body.photoUrl as string | null) ?? null,
      parentEmail: (body.parentEmail as string | null) ?? null,
      guardianUserId: null,
      squadId: (body.squadId as number | null) ?? null,
      claimed: false,
      registered: false,
    };
    playerCards().set(id, card);
    return HttpResponse.json(card, { status: 201 });
  }),

  http.patch(`${API}/clubs/:clubId/player-cards/:cardId`, async ({ params, request }) => {
    await simulateLatency();
    const card = playerCards().get(Number(params.cardId));
    if (!card) return HttpResponse.json({ error: 'Player card not found.' }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    const currentYear = new Date().getFullYear();
    const effectiveYear = body.birthYear != null ? Number(body.birthYear) : card.birthYear;
    if (effectiveYear > currentYear - 4 || effectiveYear < currentYear - 100) {
      return HttpResponse.json({ error: 'Birth year is invalid.' }, { status: 400 });
    }
    const under13 = currentYear - effectiveYear < 13;
    if (body.photoUrl && under13) {
      return HttpResponse.json({ error: 'Player cards for players under 13 cannot have a photo.' }, { status: 400 });
    }
    if (body.fullName != null) card.fullName = body.fullName as string;
    if (body.birthYear != null) card.birthYear = effectiveYear;
    if (under13 && card.photoUrl) card.photoUrl = null; // the flip strips the stored photo
    if (body.position != null) card.position = body.position as string;
    if (body.jerseyNumber != null) card.jerseyNumber = Number(body.jerseyNumber);
    if (body.photoUrl != null) card.photoUrl = body.photoUrl as string;
    if (body.parentEmail != null) card.parentEmail = body.parentEmail as string;
    if (body.squadId != null) card.squadId = Number(body.squadId);
    return HttpResponse.json(card);
  }),

  http.delete(`${API}/clubs/:clubId/player-cards/:cardId`, async ({ params }) => {
    await simulateLatency();
    playerCards().delete(Number(params.cardId));
    return HttpResponse.json({ message: 'Player card deleted.' });
  }),

  // -- club jobs (WEB_APP_MASTER_PLAN.md §4.2, Phase 2) --
  http.get(`${API}/clubs/:clubId/jobs`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    return HttpResponse.json(
      [...jobs().values()].filter((j) => j.clubId === clubId && j.status === 'OPEN')
    );
  }),

  http.get(`${API}/clubs/:clubId/jobs/all`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    return HttpResponse.json([...jobs().values()].filter((j) => j.clubId === clubId));
  }),

  http.post(`${API}/clubs/:clubId/jobs`, async ({ params, request }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.title) {
      return HttpResponse.json({ error: 'Title is required.' }, { status: 400 });
    }
    const job: StoreJob = {
      id: Math.floor(Math.random() * 100000) + 1000,
      clubId,
      title: body.title as string,
      description: (body.description as string | null) ?? null,
      ageGroup: (body.ageGroup as string | null) ?? null,
      level: (body.level as string | null) ?? null,
      status: 'OPEN',
      createdBy: currentUserId(),
      applicationCount: 0,
      createdAt: new Date().toISOString(),
    };
    jobs().set(job.id, job);
    return HttpResponse.json(job, { status: 201 });
  }),

  http.patch(`${API}/clubs/:clubId/jobs/:jobId`, async ({ params, request }) => {
    await simulateLatency();
    const job = jobs().get(Number(params.jobId));
    if (!job) return HttpResponse.json({ error: 'Job posting not found.' }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    if (body.title != null) job.title = body.title as string;
    if (body.description !== undefined) job.description = (body.description as string | null) ?? null;
    if (body.ageGroup !== undefined) job.ageGroup = (body.ageGroup as string | null) ?? null;
    if (body.level !== undefined) job.level = (body.level as string | null) ?? null;
    if (body.status != null) job.status = body.status as 'OPEN' | 'CLOSED';
    return HttpResponse.json(job);
  }),

  http.delete(`${API}/clubs/:clubId/jobs/:jobId`, async ({ params }) => {
    await simulateLatency();
    jobs().delete(Number(params.jobId));
    return HttpResponse.json({ message: 'Job posting deleted.' });
  }),

  // -- per-job applications (item 5): job creator or club owner/admin only --
  http.get(`${API}/clubs/:clubId/jobs/:jobId/applications`, async ({ params }) => {
    await simulateLatency();
    const job = jobs().get(Number(params.jobId));
    if (!job || job.clubId !== Number(params.clubId)) {
      return HttpResponse.json({ error: 'Job posting not found.' }, { status: 404 });
    }
    return HttpResponse.json([
      {
        id: 9001,
        userId: 6,
        fullName: 'Saba Youth',
        username: 'saba.y',
        avatarUrl: null,
        role: 'COACH',
        status: 'PENDING',
        message: 'I coach U14 goalkeepers and would love to join the academy staff.',
        createdAt: new Date().toISOString(),
        position: 'Goalkeeper Coach',
        ageGroup: 'U14',
        jobId: job.id,
        jobTitle: job.title,
      },
    ]);
  }),

  // -- parental consent + activation (Sprint 3) --
  http.post(`${API}/clubs/:clubId/players/:userId/consent-email`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Consent email queued.' });
  }),

  http.post(`${API}/consent/confirm`, async () => {
    await simulateLatency();
    return HttpResponse.json({ accepted: true, cardId: null, playerUserId: null });
  }),

  http.get(`${API}/player-cards/mine`, async () => {
    await simulateLatency();
    return HttpResponse.json([]);
  }),

  http.post(`${API}/player-cards/:cardId/activate`, async () => {
    await simulateLatency();
    return HttpResponse.json({ username: 'card_demo_mock', tempPassword: 'MockTemp123' });
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
