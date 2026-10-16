// Synthetic API: creating and editing pages (a club, a fan club, a sponsor or business, any page). Registered first, so
// a club created here answers every question the app asks about a club: its profile (a draft only to its owner), its
// workspace entry, facilities, staff, squads, My Club and My squads, and the person's navigation. For every other club
// and person these handlers pass on (return undefined).
//
// BACKEND NEEDED (docs/claude-sandbox/PAGE_CREATION.md section 6 and ROUND_2.md "Before release"):
//   POST /organizations/setup gains `pageKind`; any adult creates (the verified-account gate moves to the unlock list).
//   GET  /clubs/:id/page | /organizations/:id/page → identity, layout, boxes with versions, status, claim, verification, setup.
//   PUT  …/page/identity | …/page/boxes/:key | …/page/layout with { version } → 409 VERSION_CONFLICT with the current page.
//   DELETE …/page (the owner cancels a draft; it and its club and teams are gone) · POST …/page/live { requestId } · …/page/claim { requestId, role, phone } · …/page/verification { action }.
//   GET  /pages/similar?name=&town= (transliteration-aware) · /pages/mine · /pitches?lat=&lng= (OpenStreetMap via Overpass:
//        leisure=pitch + sport=soccer) · /map/reverse?lat=&lng= (reverse geocoding).
//   Join links per squad (GET/POST /join/:code, arrivals the coach approves) and staff invite links (GET /invite/:code, accept).
import { del, get, post, put, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';
import { familyRequest, hasFamily } from '../world-family.mjs';
import { saveBox, joinLinkFor, addArrival, decideArrival, pastePlayers, inviteFor, acceptInvite } from '../pages-boxes.mjs';
import { pitches, reverseGeocode } from '../pages-seed.mjs';
import { goLiveCheck, LOCKED_ACTIONS, minimumAge } from '../../../src/features/pages/model/kinds.ts';

const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const forbidden = (message = 'Only the page’s owner can change this.') => reply(403, { status: 403, message });
const bad = (message, extra = {}) => reply(400, { status: 400, message, ...extra });
const conflict = (page, viewer) => reply(409, { status: 409, code: 'VERSION_CONFLICT', message: 'Someone just changed this.', page: P.viewOf(page, viewer) });
const viewerOf = headers => V.viewerId(headers);
const isUuid = value => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(String(value ?? ''));
const visible = (page, viewer) => page && (page.status === 'LIVE' || P.roleOf(page, viewer));
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ================================================================ creating
const setupRequests = new Map(); // `${viewer}:${requestId}` -> { fingerprint, result }
post('/organizations/setup', ({ body, headers }) => {
  const viewer = viewerOf(headers);
  if (!isUuid(body?.requestId)) return bad('A request id is needed so a retry never creates two pages.');
  const fingerprint = JSON.stringify([String(body?.displayName ?? '').trim(), body?.pageKind ?? body?.organizationType ?? null, body?.location?.city ?? null]);
  const seen = setupRequests.get(`${viewer}:${body.requestId}`);
  if (seen) return seen.fingerprint === fingerprint ? seen.result : reply(409, { status: 409, message: 'This creation request was already used with different details.' });
  const outcome = P.createPage(viewer, body);
  if (outcome.status !== 200) return reply(outcome.status, outcome.body);
  setupRequests.set(`${viewer}:${body.requestId}`, { fingerprint, result: outcome.body });
  return outcome.body;
});
get('/pages/similar', ({ query, headers }) => P.similarPages(String(query.get('name') ?? '').slice(0, 120), query.get('town'), viewerOf(headers)));
get('/pages/mine', ({ headers }) => P.ownedPages(viewerOf(headers)).map(page => ({ ref: page.ref, name: page.identity.name, kind: page.kind, status: page.status, role: P.roleOf(page, viewerOf(headers)),
  crestUrl: P.crestUrlOf(page), ...P.result(page) })));
get('/pages/eligibility', ({ headers }) => { const age = P.viewerAge(viewerOf(headers)); return { age, kinds: ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE'].map(kind => ({ kind, allowed: age != null && age >= minimumAge(kind), minimumAge: minimumAge(kind) })) }; });
get('/pitches', ({ query }) => {
  const lat = Number(query.get('lat')), lng = Number(query.get('lng')), radius = Math.min(80, Math.max(1, Number(query.get('radiusKm')) || 25));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return bad('Say where to look: lat and lng.');
  return pitches.map(p => ({ ...p, distanceKm: Math.round(distanceKm(lat, lng, p.latitude, p.longitude) * 10) / 10 })).filter(p => p.distanceKm <= radius).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 40);
});
get('/map/reverse', ({ query }) => {
  const lat = Number(query.get('lat')), lng = Number(query.get('lng'));
  return Number.isFinite(lat) && Number.isFinite(lng) ? reverseGeocode(lat, lng) : bad('Say where: lat and lng.');
});

// ================================================================ one page: read, edit, go live, claim
for (const [type, base] of [['club', '/clubs/:id/page'], ['organization', '/organizations/:id/page']]) {
  const load = params => P.pageOf({ type, id: Number(params.id) });
  get(base, ({ params, headers }) => { const page = load(params), viewer = viewerOf(headers); return visible(page, viewer) ? P.viewOf(page, viewer) : notFound('Page not found.'); });

  put(`${base}/identity`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!visible(page, viewer)) return notFound('Page not found.');
    if (!P.canEdit(page, viewer)) return forbidden();
    if (body?.version != null && Number(body.version) !== page.identity.version) return conflict(page, viewer);
    P.applyIdentity(page, body ?? {});
    return P.viewOf(page, viewer);
  });
  put(`${base}/boxes/:key`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers), role = P.roleOf(page, viewer);
    if (!visible(page, viewer)) return notFound('Page not found.');
    const coachBox = role === 'COACH' && ['squads'].includes(params.key);
    if (!P.canEdit(page, viewer) && !coachBox) return forbidden();
    const outcome = saveBox(page, params.key, body, viewer);
    if (outcome.error?.status === 409 && outcome.error.body.code === 'VERSION_CONFLICT') return conflict(page, viewer);
    return outcome.error ? reply(outcome.error.status, outcome.error.body) : P.viewOf(page, viewer);
  });
  put(`${base}/layout`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!visible(page, viewer)) return notFound('Page not found.');
    if (!P.canEdit(page, viewer)) return forbidden();
    if (body?.version != null && Number(body.version) !== page.layout.version) return conflict(page, viewer);
    page.layout = { version: page.layout.version + 1, ...P.layoutFrom(page, body) };
    return P.viewOf(page, viewer);
  });
  // Cancel the creation: only a draft, only by its owner; a live page is never deleted from here.
  del(base, ({ params, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!visible(page, viewer)) return notFound('Page not found.');
    if (P.roleOf(page, viewer) !== 'OWNER') return forbidden('Only the page’s owner can delete it.');
    if (page.status !== 'DRAFT') return bad('A live page cannot be deleted here.', { code: 'LIVE' });
    P.deleteDraft(page);
    return reply(204);
  });
  post(`${base}/live`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!visible(page, viewer)) return notFound('Page not found.');
    if (!P.canEdit(page, viewer)) return forbidden();
    if (page.status === 'LIVE') return P.viewOf(page, viewer);
    const check = goLiveCheck(P.factsOf(page));
    if (!check.ready) return bad('Not ready to go live yet.', { code: 'NOT_READY', missing: check.missing });
    page.status = 'LIVE'; page.liveAt = new Date().toISOString(); page.liveRequest = body?.requestId ?? null;
    if (page.clubId) W.clubById(page.clubId).draft = false;
    return P.viewOf(page, viewer);
  });
  post(`${base}/claim`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!visible(page, viewer)) return notFound('Page not found.');
    if (page.claim?.state === 'PENDING' && page.claim.by === viewer) return P.viewOf(page, viewer);
    if (page.claim?.state !== 'UNCLAIMED') return reply(409, { status: 409, code: 'NOT_CLAIMABLE', message: 'Someone already runs this page. Ask them to add you.' });
    const current = page.kind === 'CLUB' ? P.clubOf(viewer) : null;
    if (current) { const refusal = P.oneClubRefusal(current); return reply(refusal.status, refusal.body); }
    const age = P.viewerAge(viewer);
    if (age == null || age < minimumAge(page.kind)) return reply(403, { status: 403, code: 'AGE', minimumAge: minimumAge(page.kind), message: 'Claiming a club needs an adult account.' });
    const role = ['CHAIR', 'COACH', 'ADMIN', 'OTHER'].includes(body?.role) ? body.role : null, phone = String(body?.phone ?? '').replace(/[^\d+]/g, '');
    if (!role) return bad('Say what you do at the club.');
    if (phone.replace(/\D/g, '').length < 9) return bad('Add a phone number we can call to confirm.');
    // The sandbox accepts at once; the real check (a call, a document) is the backend's. Until then it reads "claim pending verification".
    page.claim = { state: 'PENDING', role, phone, by: viewer, at: new Date().toISOString() };
    page.ownerId = viewer; page.staff.set(viewer, 'OWNER');
    if (!page.identity.contact.phone) page.identity.contact.phone = phone;
    P.syncClub(page);
    return P.viewOf(page, viewer);
  });
  post(`${base}/verification`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!visible(page, viewer)) return notFound('Page not found.');
    if (!P.canEdit(page, viewer)) return forbidden();
    if (!LOCKED_ACTIONS.includes(body?.action)) return bad('Say what verification is for.');
    if (page.verification === 'NONE') page.verification = 'REQUESTED';
    if (!page.verificationFor.includes(body.action)) page.verificationFor.push(body.action);
    page.verificationDetails = { legalName: String(body?.legalName ?? '').slice(0, 160), registrationNumber: String(body?.registrationNumber ?? '').slice(0, 40), phone: String(body?.phone ?? '').replace(/[^\d+]/g, '') };
    return P.viewOf(page, viewer);
  });
  get(`${base}/arrivals`, ({ params, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!page || !(P.canEdit(page, viewer) || P.roleOf(page, viewer) === 'COACH')) return forbidden();
    return page.arrivals.filter(a => a.status === 'WAITING').map(a => ({ ...a, squadName: W.squadById(a.squadId)?.name ?? null }));
  });
  post(`${base}/arrivals/:aid`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!page || !(P.canEdit(page, viewer) || P.roleOf(page, viewer) === 'COACH')) return forbidden();
    const outcome = decideArrival(page, params.aid, body?.action === 'DECLINE' ? 'DECLINE' : 'APPROVE', body?.squadId);
    return outcome.error ? reply(outcome.error.status, outcome.error.body) : P.viewOf(page, viewer);
  });
  post(`${base}/players`, ({ params, body, headers }) => {
    const page = load(params), viewer = viewerOf(headers);
    if (!page || !P.canEdit(page, viewer)) return forbidden();
    const outcome = pastePlayers(page, body?.squadId, body?.names);
    return outcome.error ? reply(outcome.error.status, outcome.error.body) : P.viewOf(page, viewer);
  });
}

// ================================================================ join links (parents) and invite links (staff)
const allPages = () => [...P.pages.values()];
get('/join/:code', ({ params }) => {
  const found = joinLinkFor(allPages(), params.code);
  if (!found) return notFound('This join link has expired. Ask the coach for a new one.');
  const { page, squad } = found;
  return { code: params.code, page: { ref: page.ref, name: page.identity.name, town: page.identity.town.name, crestUrl: P.crestUrlOf(page), profilePath: P.result(page).profilePath, live: page.status === 'LIVE' },
    squad: { id: squad.id, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender } };
});
post('/join/:code', ({ params, body, headers }) => {
  const found = joinLinkFor(allPages(), params.code);
  if (!found) return notFound('This join link has expired. Ask the coach for a new one.');
  const outcome = addArrival(found.page, found.squad, viewerOf(headers), body);
  return outcome.error ? reply(outcome.error.status, outcome.error.body) : reply(201, { id: outcome.arrival.id, status: outcome.arrival.status, squadName: W.squadById(outcome.arrival.squadId)?.name ?? null });
});
get('/invite/:code', ({ params }) => {
  const found = inviteFor(allPages(), params.code);
  if (!found) return notFound('This invitation has expired. Ask for a new one.');
  const { page, invite } = found;
  return { code: params.code, role: invite.role, status: invite.status, squad: invite.squadId ? { id: invite.squadId, name: W.squadById(invite.squadId)?.name ?? null } : null,
    page: { ref: page.ref, name: page.identity.name, town: page.identity.town.name, crestUrl: P.crestUrlOf(page), profilePath: P.result(page).profilePath } };
});
post('/invite/:code/accept', ({ params, headers }) => {
  const found = inviteFor(allPages(), params.code);
  if (!found) return notFound('This invitation has expired. Ask for a new one.');
  const outcome = acceptInvite(found.page, found.invite, viewerOf(headers));
  return outcome.error ? reply(outcome.error.status, outcome.error.body) : { profilePath: P.result(found.page).profilePath };
});

// ================================================================ a new club, everywhere the app asks about a club
const roleName = role => role === 'OWNER' ? 'OWNER' : role === 'ADMIN' ? 'CLUB_ADMIN' : role === 'COACH' ? 'COACH' : null;
const myClubPage = viewer => P.ownedPages(viewer).find(page => page.clubId);

function workspacesOf(viewer) {
  const list = [];
  for (const page of P.ownedPages(viewer)) {
    const role = P.roleOf(page, viewer), label = page.identity.name;
    if (page.clubId) {
      if (role === 'OWNER' || role === 'ADMIN') list.push({ id: 'club.workspace', context: { type: 'club', id: page.clubId, label } }, { id: 'club.operations', context: { type: 'club', id: page.clubId, label } });
      else list.push({ id: 'club.member', context: { type: 'club', id: page.clubId, label } });
      for (const squad of P.squadsOf(page).filter(s => s.headCoachId === viewer)) list.push({ id: 'squad.workspace', context: { type: 'squad', id: squad.id, label: squad.name } });
    } else if (role === 'OWNER' || role === 'ADMIN') list.push({ id: 'organization.workspace', context: { type: 'organization', id: page.organizationId, label } });
  }
  return list;
}
get('/users/me', ({ headers }) => {
  const viewer = viewerOf(headers), account = V.account(viewer);
  if (!account || !P.ownedPages(viewer).length) return undefined;
  const projection = V.accountProjection(account);
  const family = hasFamily(headers) ? [{ id: 'parent.hub', context: { type: 'user', id: account.id, label: account.fullName } }] : [];
  return { ...projection, navigationCapabilities: { version: 1, workspaces: [...workspacesOf(viewer), ...family] } };
});
get('/clubs/my-membership-context', ({ headers }) => {
  const viewer = viewerOf(headers), page = V.account(viewer) ? myClubPage(viewer) : null;
  return page ? { hasClubMembership: true, canCreateClub: true, clubId: page.clubId, clubName: page.identity.name, myRole: roleName(P.roleOf(page, viewer)) } : undefined;
});
get('/clubs/my-club', ({ headers }) => { const viewer = viewerOf(headers), page = V.account(viewer) ? myClubPage(viewer) : null; return page ? clubProfileFor(page, viewer) : undefined; });

function clubProfileFor(page, viewer) {
  const profile = C.clubProfile(page.clubId), role = P.roleOf(page, viewer), editor = role === 'OWNER' || role === 'ADMIN';
  return { ...profile, followerCount: C.followerCounts[page.clubId] ?? 0, isFollowedByMe: V.clubFollowsOf(viewer).has(page.clubId), isOfficial: page.verification === 'VERIFIED',
    isStaffMember: Boolean(role), isMember: Boolean(role), myRole: roleName(role), relationshipState: role ? 'ACTIVE' : 'NONE', trustedByClubs: [],
    presentation: profile.presentation ? { ...profile.presentation, canEdit: editor, canManageAffiliations: editor } : null };
}
get('/clubs/:id', ({ params, headers }) => {
  if (!P.isPageClub(params.id)) return undefined;
  const viewer = viewerOf(headers), page = P.clubPage(params.id);
  return visible(page, viewer) ? clubProfileFor(page, viewer) : notFound('Club not found.');
});
get('/clubs/:id/workspace-entry', ({ params, headers }) => {
  if (!P.isPageClub(params.id)) return undefined;
  const role = P.roleOf(P.clubPage(params.id), viewerOf(headers)), editor = role === 'OWNER' || role === 'ADMIN';
  return { canOpenWorkspace: Boolean(role), canEditFacilities: editor, canManageStaff: editor, invitationOnly: false };
});
const facilityOf = (club, ground) => {
  const venue = ground.venueId ? W.venueById(ground.venueId) : null;
  return { id: ground.id, title: ground.name, details: { placeType: 'VENUE', address: ground.address, relationship: 'REGULAR_USE', description: [ground.surface === 'GRASS' ? 'Natural grass' : ground.surface === 'INDOOR' ? 'Indoor' : ground.surface === 'HYBRID' ? 'Hybrid grass' : 'Artificial turf', ground.size].join(' · '),
    latitude: String(ground.latitude), longitude: String(ground.longitude) }, squadId: null, squadName: null,
    linkedVenue: venue ? { id: venue.id, name: venue.name, address: `${venue.district}, ${venue.city}`, city: venue.city, photo: `/sandbox-media/photo/venue-${venue.id}.svg`, amenities: [], bookingAvailable: venue.hourly != null } : null };
};
get('/clubs/:id/facilities', ({ params, headers }) => {
  const page = P.pages.get(`club:${Number(params.id)}`);
  if (!page?.boxes.grounds.fromPage) return undefined;
  if (!visible(page, viewerOf(headers))) return notFound('Club not found.');
  return P.groundsFor(page).map(ground => facilityOf(W.clubById(page.clubId), ground));
});
get('/clubs/:id/facilities/:fid/map-location', ({ params }) => {
  const page = P.pages.get(`club:${Number(params.id)}`), ground = page?.boxes.grounds.fromPage ? P.groundsFor(page).find(g => g.id === Number(params.fid)) : null;
  return ground ? { source: 'CLUB_ENTRANCE', address: ground.address, matches: [{ latitude: ground.latitude, longitude: ground.longitude, label: ground.name }], notice: null } : undefined;
});
get('/clubs/:id/staff-directory', ({ params }) => (P.isPageClub(params.id) ? P.staffOf(P.clubPage(params.id)) : undefined));
get('/clubs/:id/staff', ({ params }) => (P.isPageClub(params.id) ? P.staffOf(P.clubPage(params.id)).map(({ responsibilities: _ignored, ...person }) => person) : undefined));
get('/clubs/:id/squads', ({ params }) => {
  if (!P.isPageClub(params.id)) return undefined;
  return P.squadsOf(P.clubPage(params.id)).map(s => ({ id: s.id, clubId: s.clubId, name: s.name, category: s.ageGroup, ageGroup: s.ageGroup, gender: s.gender, format: s.format, memberCount: s.playerIds.length, playerCount: s.playerIds.length,
    headCoachId: s.headCoachId, headCoachName: s.headCoachId ? P.viewerName(s.headCoachId) : null, trainingDays: s.trainingDays ?? [], trainingTime: s.trainingTime ?? null, competition: null }));
});
// A new club's squad timetable is public: the days and time the owner set are what a parent decides on.
get('/clubs/:id/squads/:sid/training-schedule', ({ params, headers }) => {
  if (!P.isPageClub(params.id)) return undefined;
  const page = P.clubPage(params.id), squad = P.squadsOf(page).find(s => s.id === Number(params.sid)), viewer = viewerOf(headers);
  if (!squad || !visible(page, viewer)) return notFound('Squad not found.');
  const own = Boolean(P.roleOf(page, viewer));
  const sessions = P.trainingOf(page, squad.id).map(t => ({ id: String(t.id), title: `${squad.name} training`, startsAt: t.start.toISOString(), endsAt: t.end.toISOString(), status: 'SCHEDULED', timesOnly: false, location: t.ground?.name ?? null, timezone: C.TIMEZONE }));
  return { squadId: squad.id, squadName: squad.name, visibility: 'PUBLIC', canManage: own, canView: true, revision: page.boxes.squads.version, sessions, limited: !own, programmeTimesPublic: true, publicationConfigured: true };
});
get('/clubs/:id/management', ({ params, headers }) => {
  if (!P.isPageClub(params.id)) return undefined;
  const page = P.clubPage(params.id), viewer = viewerOf(headers), role = P.roleOf(page, viewer);
  if (!role) return reply(403, { status: 403, message: 'You do not manage this club.' });
  const players = P.squadsOf(page).reduce((n, s) => n + s.playerIds.length, 0);
  return { currentUserRole: roleName(role), assignableInviteRoles: ['CLUB_ADMIN', 'COACH', 'PLAYER'], assignableStaffRoles: ['CLUB_ADMIN', 'COACH'],
    activePlayerCount: players, trialistCount: 0, pastPlayerCount: 0, removedPlayerCount: 0, overdueTrialistCount: 0, pendingTryoutCount: 0,
    members: P.staffOf(page).map(s => ({ userId: s.userId, fullName: s.fullName, username: null, avatarUrl: s.avatarUrl, role: s.role, roleEditable: s.role !== 'OWNER', ownershipTransferEligible: s.role === 'CLUB_ADMIN', publicTitle: s.title, clubBio: null, qualifications: null, isPublic: true })),
    pendingInvitations: [], pendingApplications: [] };
});

// My squads for a new club's coaches: their squads, nothing invented around them.
const pageSquad = id => { const squad = W.squadById(id); const page = squad ? P.pages.get(`club:${squad.clubId}`) : null; return page?.managed ? { squad, page } : null; };
get('/squad-communication', ({ headers }) => {
  const viewer = viewerOf(headers);
  if (!V.account(viewer)) return undefined;
  const mine = P.ownedPages(viewer).flatMap(page => P.squadsOf(page).filter(s => s.headCoachId === viewer || P.canEdit(page, viewer)).map(s => ({ s, page })));
  return mine.length ? mine.map(({ s, page }) => ({ id: s.id, club_id: page.clubId, academy_name: page.identity.name, name: s.name, category: s.ageGroup, can_manage: true, unread_count: 0 })) : undefined;
});
get('/squad-communication/:id', ({ params, headers }) => {
  const found = pageSquad(params.id); if (!found) return undefined;
  const { squad, page } = found, viewer = viewerOf(headers);
  if (!P.roleOf(page, viewer)) return reply(403, { status: 403, message: 'This squad space is not available to you.' });
  const coaches = [...new Set([squad.headCoachId].filter(Boolean))];
  return { id: squad.id, club_id: page.clubId, academy_name: page.identity.name, name: squad.name, category: squad.ageGroup, can_manage: true, unread_count: 0, viewer_id: viewer,
    member_count: squad.playerIds.length + coaches.length, notify_chat: true, head_coach_id: squad.headCoachId, can_assign_coach: P.canEdit(page, viewer),
    available_coaches: P.staffOf(page).map(s => ({ user_id: s.userId, full_name: s.fullName })), coaches: coaches.map(id => ({ user_id: id, full_name: P.viewerName(id) })),
    players: squad.playerIds.map(id => ({ id, name: W.personById(id)?.fullName ?? `Player #${id}` })), threads: [], attention: { upcoming_sessions: 0, replies_needed: 0, acknowledgements_needed: 0 } };
});
get('/squad-communication/:id/messages', ({ params }) => (pageSquad(params.id) ? [] : undefined));

// Search beside the logo: pages that are not clubs are found here (clubs are found through /clubs/search).
get('/organizations/discovery', ({ query: q, headers }) => {
  const term = (q.get('q') ?? '').trim().toLocaleLowerCase(), limit = Math.min(20, Math.max(1, Number(q.get('limit')) || 5)), kind = q.get('kind') ?? 'ALL', viewer = viewerOf(headers);
  const found = term ? [...P.pages.values()].filter(page => !page.clubId && visible(page, viewer) && `${page.identity.name} ${page.identity.town.name}`.toLocaleLowerCase().includes(term)) : [];
  const venuesFound = term && kind !== 'ORGANIZATION' ? W.venues.filter(venue => `${venue.name} ${venue.city} ${venue.district}`.toLocaleLowerCase().includes(term)) : [];
  return {
    organizations: kind === 'VENUE' ? [] : found.slice(0, limit).map(page => ({ id: page.organizationId, name: page.identity.name, location: page.identity.town.name, profileKind: page.kind === 'FAN_CLUB' ? 'PARTNER' : page.kind === 'BUSINESS' ? (page.identity.businessKind ?? 'COMPANY') : 'OTHER', logoUrl: P.crestUrlOf(page), venueCount: 0 })),
    venues: venuesFound.slice(0, limit).map(venue => ({ id: venue.id, name: venue.name, location: `${venue.district}, ${venue.city}`, profileKind: 'VENUE', venueCount: 1, fromPrice: venue.hourly, currency: venue.hourly ? 'GEL' : null, bookingMode: venue.hourly ? 'REQUEST' : null })),
    moreOrganizations: found.length > limit, moreVenues: venuesFound.length > limit,
  };
});
