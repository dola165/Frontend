// Synthetic API: club domain. See sandbox/README.md for conventions.
// Sections: directory & profile · membership · management · players & squads · applications
// & tryouts · jobs · club operations · workspace roles · personal club connections · admissions ·
// agent approaches · store & campaigns · club organization settings.
// The club inbox (club-scoped notifications) is answered by the social domain.
import { get, post, put, patch, del, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as V from '../viewer.mjs';
import * as F from '../world-football.mjs';
import { pageFilterFacts } from '../pages-data.mjs';
import { allocateStoreVariantId, storeArchive, storeCreate, storeManagerProducts, storeUpdate } from './store-create.mjs';
import './club-workspace.mjs';
import './club-management-access.mjs';

const { personById, clubById, squadById } = W;
const CLUB = C.CLUB_ID;
const num = v => (v == null || v === '' ? null : Number(v));
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const conflict = (message = 'This record changed since you opened it. Reload and try again.') => reply(409, { status: 409, code: 'VERSION_CONFLICT', message });
const bad = message => reply(400, { status: 400, message });
const ok = () => reply(200, '');
const created = body => reply(201, body);
const page = (items, q, defSize = 20) => {
  const p = Math.max(0, Number(q.get('page') ?? 0) || 0), size = Math.max(1, Number(q.get('size') ?? defSize) || defSize);
  return { content: items.slice(p * size, p * size + size), pageNumber: p, pageSize: size, totalElements: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)), number: p, size, last: (p + 1) * size >= items.length };
};
const isOwnClub = id => Number(id) === CLUB;

// ---------------------------------------------------------------- sandbox personas
// Still Luka's account; only his club access changes (set by /__mode/… on the server, see viewer.mjs).
// `analyst`: a performance analyst on the U14 and U16 Boys who may write development notes but only read restrictions
// and match preparation. `member`: club membership with no responsibilities at all. `headcoach`: the older Coach
// membership and the head coach job on U14 and U16. `physio`: a job and no membership. None: the owner and head coach.
const personaOf = V.personaOf;
// Coaches are the club's coaches; the other jobs (and a helper, who has none) hold no club role, like the physio (step 3).
const personaRole = persona => (['analyst', 'headcoach', 'gkcoach', 'headofcoaching'].includes(persona) ? 'COACH' : persona === 'member' ? 'PLAYER'
  : ['physio', 'attendance', 'teammanager', 'kit', 'helper'].includes(persona) ? null : 'OWNER');
const ANALYST_ACCESS = { DEVELOPMENT: true, AVAILABILITY: false, READINESS: false }; // module → may write
const analystSquads = () => [...C.myCoaching.squad_ids];
const analystView = () => ({ id: 'analyst', label: 'Performance analyst', modules: Object.keys(ANALYST_ACCESS), squadIds: analystSquads(), clubWide: false, appointmentId: 990001, revision: 1 });
const memberView = () => ({ id: 'member', label: 'Club member', modules: [], squadIds: [], clubWide: false, appointmentId: null, revision: null });

// ---------------------------------------------------------------- sections and the season
// A bigger club is sections of squads in a season (the club model, ROUND_2 §2). Faked from the squad names until
// the backend carries them: the first team, the girls, and the academy for everyone else. Backend fields to add.
export const SEASON = '2026/27';
export const sectionOf = squad => /first team/i.test(squad.name) ? 'First team' : /girls|women/i.test(squad.name) ? 'Girls' : 'Academy';

// ================================================================ directory & profile
get('/clubs/my-membership-context', ({ headers }) => personaRole(personaOf(headers)) ? { hasClubMembership: true, canCreateClub: true, clubId: CLUB, clubName: C.club.name, myRole: personaRole(personaOf(headers)) }
  : { hasClubMembership: false, canCreateClub: false, clubId: null, clubName: null, myRole: null });
get('/clubs/my-club', () => C.clubProfile(CLUB));
get('/clubs/followed', () => [...C.followed].map(id => C.directoryItem(id)));
get('/clubs/search', ({ query }) => {
  const q = (query.get('q') ?? query.get('query') ?? '').toLowerCase(), size = Number(query.get('limit') ?? query.get('size') ?? 10);
  return W.clubs.filter(c => !c.draft && (!q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))).slice(0, size)
    .map(c => ({ id: c.id, name: c.name, logoUrl: c.logoUrl, memberCount: C.memberCount(c.id), city: c.city, cityName: c.city }));
});
/** A club as one reader sees it: following is theirs; a registered newcomer is nobody's staff or member. */
function forViewer(item, headers) {
  const viewer = V.viewerId(headers), newcomer = viewer !== W.ME_ID;
  const seen = { ...item, isFollowedByMe: V.clubFollowsOf(viewer).has(item.id) };
  if (!newcomer) return seen;
  return { ...seen, isStaffMember: false, isMember: false, myRole: null, relationshipState: item.relationshipState == null ? null : 'NONE', trustedByClubs: item.trustedByClubs ? [] : undefined,
    presentation: item.presentation ? { ...item.presentation, canEdit: false, canManageAffiliations: false } : item.presentation };
}
get('/clubs', ({ query, headers }) => {
  const search = (query.get('search') ?? query.get('q') ?? '').trim().toLowerCase();
  const types = query.getAll('type'), policies = query.getAll('joinPolicy'), city = (query.get('city') ?? '').toLowerCase(), country = (query.get('country') ?? '').toLowerCase();
  // BACKEND NEEDED (World › Clubs for a child): `age` keeps clubs with a published programme for that age.
  const age = query.has('age') ? Number(query.get('age')) : null;
  const fits = c => age == null || (c.presentation?.programmes ?? []).some(p => p.published && (p.ageMin != null || p.ageMax != null) && (p.ageMin == null || age >= p.ageMin) && (p.ageMax == null || age <= p.ageMax));
  // BACKEND NEEDED (World › Clubs filters): `ageGroup` (U12 means a player of 11), `feeMin`/`feeMax` (a published programme's
  // monthly fee, free counting as 0) and `gender`. The sandbox's clubs state no gender, so every club matches it.
  const group = query.get('ageGroup') ?? '', groupAge = /^U\d+$/.test(group) ? Number(group.slice(1)) - 1 : group ? 18 : null;
  const published = c => (c.presentation?.programmes ?? []).filter(p => p.published);
  // A club created as a page states a fee band and its squads' ages instead of priced programmes (see pages-data.mjs).
  const facts = c => pageFilterFacts(c.id);
  const inGroup = c => groupAge == null || published(c).some(p => (p.ageMin == null || groupAge >= p.ageMin) && (p.ageMax == null || groupAge <= p.ageMax))
    || (facts(c)?.ages ?? []).some(age => groupAge <= age && groupAge >= age - 1);
  const feeMin = Number(query.get('feeMin')), feeMax = Number(query.get('feeMax')), feeOf = p => p.priceType === 'FREE' ? 0 : p.amount != null ? Number(p.amount) : null;
  const feeFits = fee => fee != null && (!query.get('feeMin') || fee >= feeMin) && (!query.get('feeMax') || fee <= feeMax);
  const bandFits = band => band != null && (band.free === 'ALL' ? feeFits(0) : (!query.get('feeMin') || band.max >= feeMin) && (!query.get('feeMax') || band.min <= feeMax));
  const inFee = c => (!query.get('feeMin') && !query.get('feeMax')) || published(c).some(p => feeFits(feeOf(p))) || bandFits(facts(c)?.band);
  let items = W.clubs.filter(c => !c.draft).map(c => forViewer(C.directoryItem(c.id), headers)).filter(fits).filter(inGroup).filter(inFee).filter(c => (!search || `${c.name} ${c.cityName} ${c.description}`.toLowerCase().includes(search))
    && (!types.length || types.includes(c.type)) && (!policies.length || policies.includes(c.playerJoinPolicy))
    && (!city || c.cityName.toLowerCase().includes(city)) && (!country || 'georgia ge'.includes(country)));
  const sort = query.get('sort') ?? 'NEWEST';
  items.sort(sort === 'NAME' ? (a, b) => a.name.localeCompare(b.name) : sort === 'MEMBER_COUNT' ? (a, b) => b.memberCount - a.memberCount : (a, b) => b.foundedYear - a.foundedYear || a.id - b.id);
  if (!query.has('page') && !query.has('size')) return items;
  return page(items, query, 12);
});
get('/clubs/:id', ({ params, headers }) => { const profile = C.clubProfile(Number(params.id)); return profile ? forViewer(profile, headers) : notFound('Club not found.'); });
put('/clubs/:id', ({ params, body }) => {
  const id = Number(params.id); if (!clubById(id)) return notFound();
  const edits = C.clubEdits.get(id) ?? {}; for (const k of ['logoUrl', 'bannerUrl', 'description']) if (body?.[k] !== undefined) edits[k] = body[k];
  C.clubEdits.set(id, edits); return ok();
});
patch('/clubs/:id', ({ params, body }) => { if (body?.playerJoinPolicy) C.clubPolicy.set(Number(params.id), body.playerJoinPolicy); return ok(); });
// Following is the reader's own; it is recorded for the feed's learning algorithm later.
const toggleFollow = (id, on, headers) => {
  if (!clubById(id)) return notFound('Club not found.');
  const viewer = V.viewerId(headers), follows = V.clubFollowsOf(viewer);
  const next = on ?? !follows.has(id);
  if (next && !follows.has(id)) { follows.add(id); C.followerCounts[id]++; V.recordEvent(viewer, { type: 'FOLLOWED', clubId: id }); }
  else if (!next && follows.has(id)) { follows.delete(id); C.followerCounts[id]--; V.recordEvent(viewer, { type: 'UNFOLLOWED', clubId: id }); }
  return { following: follows.has(id) };
};
post('/clubs/:id/follow', ({ params, headers }) => toggleFollow(Number(params.id), undefined, headers));
del('/clubs/:id/follow', ({ params, headers }) => toggleFollow(Number(params.id), false, headers));
post('/clubs/:id/mute', () => ({ muted: true }));
post('/clubs/:id/challenge', () => ({ message: 'Challenge sent. The other club will reply in their match exchange.' }));
get('/clubs/:id/workspace-entry', ({ params }) => isOwnClub(params.id)
  ? { canOpenWorkspace: true, canEditFacilities: true, canManageStaff: true, invitationOnly: false }
  : { canOpenWorkspace: false, canEditFacilities: false, canManageStaff: false, invitationOnly: C.clubPolicy.get(Number(params.id)) === 'INVITE_ONLY' });

// Public presentation (programmes, sponsors, affiliations)
get('/clubs/:id/presentation/manage', ({ params }) => { const p = C.presentations.get(Number(params.id)); return p ? { ...p, canEdit: isOwnClub(params.id), canManageAffiliations: isOwnClub(params.id) } : notFound(); });
put('/clubs/:id/presentation', ({ params, body }) => {
  const p = C.presentations.get(Number(params.id)); if (!p) return notFound();
  if (body?.revision != null && body.revision !== p.revision) return conflict();
  Object.assign(p, { profileKind: body.profileKind ?? p.profileKind, programmes: (body.programmes ?? p.programmes).map((x, i) => ({ id: x.id ?? C.nextId(), ...x })), sponsors: (body.sponsors ?? p.sponsors).map(x => ({ id: x.id ?? C.nextId(), ...x })), revision: p.revision + 1 });
  return { ...p, canEdit: true, canManageAffiliations: true };
});
post('/clubs/:id/presentation/affiliations', ({ params, body }) => {
  const p = C.presentations.get(Number(params.id)), other = clubById(body?.clubId); if (!p || !other) return notFound();
  p.affiliations.push({ id: C.nextId(), clubId: other.id, name: other.name, logoUrl: other.logoUrl, profileKind: other.type === 'ACADEMY' ? 'ACADEMY' : 'PROFESSIONAL', status: 'PENDING', canRespond: false });
  return created({ status: 'PENDING' });
});
post('/clubs/:id/presentation/affiliations/:aid', ({ params, body }) => {
  const p = C.presentations.get(Number(params.id)); const a = p?.affiliations.find(x => x.id === Number(params.aid)); if (!a) return notFound();
  if (body?.action === 'ACCEPT') a.status = 'ACTIVE'; else p.affiliations.splice(p.affiliations.indexOf(a), 1);
  return { status: a.status };
});
put('/clubs/:id/presentation/affiliations/:aid/profile-management', ({ params, body }) => {
  const a = C.presentations.get(Number(params.id))?.affiliations.find(x => x.id === Number(params.aid)); if (!a) return notFound();
  a.profileManagementEnabled = Boolean(body?.enabled); return { enabled: a.profileManagementEnabled };
});
post('/clubs/:id/honours', () => created({ honourId: C.nextId() }));
del('/clubs/:id/honours/:hid', () => ok());
post('/clubs/:id/opportunities', () => created({ opportunityId: C.nextId() }));
del('/clubs/:id/opportunities/:oid', () => ok());

// Public people, squads and places
const responsibility = a => ({ title: a.title, specialisations: a.specialisations, squadId: a.squad_id, squadName: a.squad_name, squadIds: a.squad_ids, squadNames: a.squad_names, clubWide: a.club_wide, provenance: 'RECORDED_APPOINTMENT', startsOn: a.starts_on, endsOn: a.ends_on });
const publicStaff = id => {
  if (!isOwnClub(id)) {
    const coach = W.people.find(p => p.clubId === Number(id) && p.role === 'COACH');
    return coach ? [{ userId: coach.id, fullName: coach.fullName, avatarUrl: coach.avatarUrl, role: 'COACH', title: coach.staffTitle ?? coach.headline?.split(' · ')[0] ?? 'Coach', bio: null, responsibilities: [] }] : [];
  }
  const ids = [...new Set([...C.members.filter(m => m.isPublic).map(m => m.userId), ...C.appointments.filter(a => a.status === 'ACTIVE' && a.published).map(a => a.user_id)])];
  return ids.map(uid => {
    const p = personById(uid), m = C.members.find(x => x.userId === uid);
    const appts = C.appointments.filter(a => a.user_id === uid && a.status === 'ACTIVE' && a.published);
    return { userId: uid, fullName: p.fullName, avatarUrl: p.avatarUrl, role: m?.role ?? 'CLUB_STAFF', title: m?.publicTitle ?? appts[0]?.title ?? C.staffTitle(uid), bio: m?.clubBio ?? null, qualifications: m?.qualifications ?? null, responsibilities: appts.map(responsibility) };
  });
};
get('/clubs/:id/staff-directory', ({ params }) => publicStaff(params.id));
get('/clubs/:id/staff', ({ params }) => publicStaff(params.id).map(s => ({ userId: s.userId, fullName: s.fullName, avatarUrl: s.avatarUrl, role: s.role, bio: s.bio, title: s.title })));
const squadDto = s => ({ id: s.id, clubId: s.clubId, name: s.name, category: s.ageGroup, ageGroup: s.ageGroup, gender: s.gender, format: s.format, memberCount: s.playerIds.length, playerCount: s.playerIds.length,
  headCoachId: s.headCoachId, headCoachName: s.headCoachId ? C.name(s.headCoachId) : null, trainingDays: s.trainingDays, competition: C.SQUAD_SEASON[s.id] ?? null, section: sectionOf(s), season: SEASON });
get('/clubs/:id/squads', ({ params }) => W.squads.filter(s => s.clubId === Number(params.id)).map(squadDto));
get('/clubs/:id/facilities', ({ params }) => {
  if (!isOwnClub(params.id)) {
    const c = clubById(params.id), v = W.venueById(c?.venueId); if (!v) return [];
    return [{ id: -(v.id), title: v.name, details: { placeType: 'VENUE', address: `${v.district}, ${v.city}`, relationship: 'REGULAR_USE', description: `${v.surface} · ${v.pitches.join(', ')}` }, squadId: null, squadName: null, linkedVenue: { id: v.id, name: v.name, address: `${v.district}, ${v.city}`, city: v.city, photo: `/sandbox-media/photo/venue-${v.id}.svg`, amenities: [], bookingAvailable: v.hourly != null } }];
  }
  return C.records.filter(r => r.kind === 'FACILITY' && r.status === 'PUBLISHED').map(r => {
    const v = W.venueById(r.data.venueId);
    return { id: r.id, title: r.title, details: { ...r.data }, squadId: r.squad_id, squadName: r.squad_id ? C.squadName(r.squad_id) : null,
      linkedVenue: v ? { id: v.id, name: v.name, address: `${v.district}, ${v.city}`, city: v.city, photo: `/sandbox-media/photo/venue-${v.id}.svg`, amenities: ['CHANGING_ROOMS', 'PARKING', 'FLOODLIGHTS'], bookingAvailable: v.hourly != null } : null };
  });
});
get('/clubs/:id/facilities/:fid/map-location', ({ params }) => {
  const r = C.records.find(x => x.id === Number(params.fid)); const c = clubById(params.id); const v = W.venueById(r?.data.venueId ?? (Number(params.fid) < 0 ? -Number(params.fid) : c?.venueId));
  const lat = Number(r?.data.latitude || v?.lat || c?.lat), lng = Number(r?.data.longitude || v?.lng || c?.lng);
  return { source: r?.data.latitude ? 'CLUB_ENTRANCE' : v ? 'VENUE' : 'CLUB', address: r?.data.address ?? (v ? `${v.name}, ${v.city}` : c?.address), matches: [{ latitude: lat, longitude: lng, label: r?.data.arrival ? 'Visitor entrance' : (v?.name ?? c?.name) }], notice: r?.data.arrival ?? null };
});
// Squad training timetable (public profile and squad workbench)
const timetableVisibility = new Map(C.squads.map(s => [s.id, { visibility: ['SENIOR', 'U19'].includes(s.ageGroup) ? 'PRIVATE' : 'PUBLIC', revision: 2 }]));
const timetable = (clubId, sid) => {
  const sq = squadById(sid); if (!sq || sq.clubId !== Number(clubId)) return null;
  const pub = timetableVisibility.get(sq.id) ?? { visibility: 'PUBLIC', revision: 1 }; const own = isOwnClub(clubId);
  const sessions = W.events.filter(e => e.type === 'TRAINING' && e.squadId === sq.id && e.end.getTime() > Date.now() - 864e5 && e.start.getTime() < Date.now() + 28 * 864e5).sort((a, b) => a.start - b.start)
    .map(e => ({ id: String(e.id), title: e.title, startsAt: W.iso(e.start), endsAt: W.iso(e.end), status: 'SCHEDULED', timesOnly: !own, location: own || pub.visibility === 'PUBLIC' ? `${W.venueById(e.venueId)?.name} · ${e.pitch}` : null, timezone: C.TIMEZONE }));
  const canView = own || pub.visibility === 'PUBLIC';
  return { squadId: sq.id, squadName: sq.name, visibility: pub.visibility, canManage: own, canView, revision: pub.revision, sessions: canView ? sessions : [], limited: !own, programmeTimesPublic: true, publicationConfigured: true };
};
get('/clubs/:id/squads/:sid/training-schedule', ({ params }) => timetable(params.id, params.sid) ?? notFound('Squad not found.'));
put('/clubs/:id/squads/:sid/training-schedule/publication', ({ params, body }) => {
  const t = timetableVisibility.get(Number(params.sid)); if (!t || !isOwnClub(params.id)) return notFound();
  if (body?.revision != null && body.revision !== t.revision) return conflict();
  t.visibility = body?.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC'; t.revision++; return timetable(params.id, params.sid);
});
const scheduleItem = e => ({ id: String(e.id), kind: e.type === 'MATCH' ? 'MATCH' : 'AVAILABILITY', title: e.title ?? (e.type === 'TRAINING' ? `${C.squadName(e.squadId)} training` : 'Event'),
  subtitle: e.opponentName ?? C.squadName(e.squadId), startsAt: W.local(e.start), locationText: W.venueById(e.venueId)?.name ?? null, status: e.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED', visibility: 'PUBLIC', details: e.notes ?? e.competition ?? null });
get('/clubs/:id/calendar', ({ params }) => W.events.filter(e => e.clubId === Number(params.id) && e.start.getTime() > Date.now() - 864e5 && e.start.getTime() < Date.now() + 21 * 864e5).sort((a, b) => a.start - b.start).map(scheduleItem));
get('/clubs/:id/schedule', ({ params }) => W.events.filter(e => e.clubId === Number(params.id) && e.start.getTime() > Date.now() - 864e5).sort((a, b) => a.start - b.start).slice(0, 40).map(scheduleItem));
post('/clubs/:id/calendar', () => ({ message: 'Event added to the club calendar.' }));
del('/clubs/:id/calendar/:eid', () => ({ message: 'Event removed.' }));
post('/clubs/:id/dissolve', () => reply(409, { status: 409, message: 'The academy hosts active competitions and cannot be dissolved here.' }));

// ================================================================ membership (personal)
get('/club-memberships/me', ({ headers }) => personaRole(personaOf(headers)) ? [{ clubId: CLUB, clubName: C.club.name, role: personaRole(personaOf(headers)), status: 'ACTIVE', primary: true, logoUrl: C.club.logoUrl }] : []);
get('/club-memberships/invites/me', () => []);
post('/club-memberships/invites/:iid/accept', () => ({ status: 'ACCEPTED' }));
post('/club-memberships/invites/:iid/decline', () => ({ status: 'DECLINED' }));
get('/me/club-relationships', () => [{ clubId: CLUB, clubName: C.club.name, logoUrl: C.club.logoUrl, relationships: ['STAFF'], roles: ['OWNER'], status: 'ACTIVE', departureSnapshots: { STAFF: 'snapshot-club-1-staff-v6' } }]);
post('/clubs/:id/membership/leave', () => reply(409, { status: 409, message: 'Transfer ownership before leaving the club.' }));
post('/clubs/:id/ownership/transfer', ({ body }) => {
  const m = C.members.find(x => x.userId === Number(body?.userId)); if (!m) return notFound('Choose a current club member.');
  return reply(409, { status: 409, message: `${C.name(m.userId)} must accept ownership from their own account first.` });
});

// ================================================================ management overview
const managedMember = m => { const p = personById(m.userId); return { userId: m.userId, fullName: p.fullName, username: p.username, avatarUrl: p.avatarUrl, role: m.role, roleEditable: m.role !== 'OWNER', ownershipTransferEligible: m.role === 'CLUB_ADMIN', publicTitle: m.publicTitle, clubBio: m.clubBio, qualifications: m.qualifications, isPublic: m.isPublic }; };
const appView = a => ({ ...a });
const countBy = status => C.affiliations.filter(a => a.status === status).length;
get('/clubs/:id/management', ({ params, headers }) => {
  // A job without a staff membership (the physio) doesn't read the club's management, as on the server.
  if (!isOwnClub(params.id) || !personaRole(personaOf(headers))) return reply(403, { status: 403, message: 'You do not manage this club.' });
  const overdue = C.affiliations.filter(a => a.status === 'TRIALIST' && a.trialEndsOn && a.trialEndsOn < C.date(0)).length;
  return {
    currentUserRole: personaRole(personaOf(headers)), assignableInviteRoles: ['CLUB_ADMIN', 'COACH', 'PLAYER'], assignableStaffRoles: ['CLUB_ADMIN', 'COACH'],
    activePlayerCount: countBy('ACTIVE'), trialistCount: countBy('TRIALIST'), pastPlayerCount: countBy('PAST'), removedPlayerCount: countBy('REMOVED'), overdueTrialistCount: overdue,
    pendingTryoutCount: C.tryoutApplicants.filter(a => ['PENDING', 'SHORTLISTED'].includes(a.status)).length,
    members: C.members.map(managedMember), pendingInvitations: C.invitations.filter(i => i.status === 'PENDING').map(C.invitationView),
    pendingApplications: C.applications.filter(a => a.status === 'PENDING').map(appView),
  };
});
get('/clubs/:id/management/user-search', ({ query }) => {
  const q = (query.get('query') ?? '').toLowerCase();
  const hits = W.people.filter(p => p.id !== C.ME && !['PARENT'].includes(p.role) && (p.fullName.toLowerCase().includes(q) || p.username.includes(q)))
    .map(p => ({ id: p.id, fullName: p.fullName, username: p.username, position: p.position ? C.POSITION_CODE[p.position] : null, userType: p.role }));
  return page(hits, query, 8);
});
post('/clubs/:id/management/invitations', ({ body }) => {
  const p = personById(body?.userId); if (!p) return notFound('Account not found.');
  if (C.invitations.some(i => i.userId === p.id && i.status === 'PENDING')) return reply(409, { status: 409, message: 'This person already has a pending invitation.' });
  const inv = { id: C.nextId(), userId: p.id, role: body.role ?? 'COACH', status: 'PENDING', createdAt: C.nowIso(), expiresAt: C.at(14) };
  C.invitations.push(inv); return created({ invitationId: inv.id });
});
del('/clubs/:id/management/invitations/:iid', ({ params }) => { const i = C.invitations.find(x => x.id === Number(params.iid)); if (i) i.status = 'CANCELLED'; return ok(); });
patch('/clubs/:id/management/members/:uid/role', ({ params, body }) => { const m = C.members.find(x => x.userId === Number(params.uid)); if (!m) return notFound(); if (m.role === 'OWNER') return bad('Transfer ownership instead.'); m.role = body?.role ?? m.role; return ok(); });
post('/clubs/:id/management/members/:uid/remove', ({ params }) => { const i = C.members.findIndex(x => x.userId === Number(params.uid)); if (i >= 0 && C.members[i].role !== 'OWNER') C.members.splice(i, 1); return ok(); });
put('/clubs/:id/management/staff/:uid/profile', ({ params, body }) => {
  const m = C.members.find(x => x.userId === Number(params.uid)); if (!m) return notFound();
  for (const k of ['publicTitle', 'clubBio', 'qualifications', 'isPublic']) if (body?.[k] !== undefined) m[k] = body[k];
  return ok();
});

// ================================================================ players & squads
get('/clubs/:id/players', ({ params, query }) => {
  if (!isOwnClub(params.id)) return page([], query);
  const status = query.get('status');
  const rows = C.affiliations.filter(a => !status || a.status === status).map(C.affiliationView).sort((a, b) => (a.status === b.status ? a.fullName.localeCompare(b.fullName) : ['TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'].indexOf(a.status) - ['TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'].indexOf(b.status)));
  return page(rows, query);
});
patch('/clubs/:id/players/:uid', ({ params, body }) => {
  const a = C.affiliations.find(x => x.userId === Number(params.uid)); if (!a) return notFound();
  if (body?.status) { a.status = body.status; if (['PAST', 'REMOVED'].includes(body.status)) { a.endedAt = C.nowIso(); for (const s of C.squads) s.playerIds = s.playerIds.filter(id => id !== a.userId); } }
  if (body?.trialEndsOn !== undefined) a.trialEndsOn = body.trialEndsOn;
  return C.affiliationView(a);
});
post('/clubs/:id/players/:uid/promote', ({ params, body }) => {
  const a = C.affiliations.find(x => x.userId === Number(params.uid)); if (!a) return notFound();
  const sq = squadById(body?.squadId); if (!sq) return bad('Choose a squad.');
  Object.assign(a, { status: 'ACTIVE', primary: true, trialEndsOn: null }); if (!sq.playerIds.includes(a.userId)) sq.playerIds.push(a.userId);
  return C.affiliationView(a);
});
post('/clubs/:id/players/:uid/consent-email', ({ params, body }) => { const a = C.affiliations.find(x => x.userId === Number(params.uid)); if (a) { a.parentalConsentStatus = 'PENDING'; if (body?.parentEmail) a.parentEmail = body.parentEmail; } return { message: 'Consent email sent to the parent or guardian.' }; });
post('/clubs/:id/players/self-register', () => reply(409, { status: 409, message: 'You already belong to this club.' }));

const rosterPlayer = (sq, id) => {
  const p = personById(id), card = C.playerCards.find(c => c.userId === id), meta = C.squadRoles.get(`${sq.id}:${id}`) ?? {};
  if (card) return { id, number: card.jerseyNumber, name: card.fullName, position: card.position, age: new Date().getFullYear() - card.birthYear, status: 'ACTIVE', joinedAt: C.at(-20), photoUrl: card.photoUrl, isRegistered: false, squadRole: 'PLAYER' };
  const aff = C.affiliations.find(a => a.userId === id);
  return { id, number: meta.jerseyNumber ?? p.shirtNumber ?? null, name: p.fullName, position: C.POSITION_CODE[p.position] ?? null, age: C.ageOf(p), status: aff?.status ?? 'ACTIVE', joinedAt: aff?.joinedAt ?? C.at(-200), photoUrl: C.ageOf(p) >= 13 ? p.avatarUrl : null, isRegistered: true, squadRole: meta.squadRole ?? 'PLAYER' };
};
get('/clubs/:id/squads/:sid/roster', ({ params }) => {
  const sq = squadById(params.sid); if (!sq || sq.clubId !== Number(params.id)) return notFound('Squad not found.');
  const groups = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'].map(label => ({ label, players: [] }));
  const ids = [...sq.playerIds, ...C.playerCards.filter(c => c.squadId === sq.id).map(c => c.userId)];
  for (const id of ids) {
    const row = rosterPlayer(sq, id); const p = personById(id);
    const g = p ? C.ROSTER_GROUP[p.position] : ({ GOALKEEPER: 'Goalkeepers', STRIKER: 'Forwards' })[row.position] ?? 'Midfielders';
    groups.find(x => x.label === g).players.push(row);
  }
  return groups.filter(g => g.players.length);
});
post('/clubs/:id/squads', ({ params, body }) => {
  if (!body?.name?.trim()) return bad('Name the squad.');
  const sq = { id: C.nextId(), clubId: Number(params.id), name: body.name.trim(), ageGroup: body.category ?? 'SENIOR', gender: body.gender ?? 'MIXED', headCoachId: null, playerIds: [], format: /U(8|10|12)$/.test(body.category ?? '') ? '7v7' : /U14$/.test(body.category ?? '') ? '9v9' : '11v11', trainingDays: [] };
  W.squads.push(sq); if (isOwnClub(params.id)) { C.squads.push(sq); C.squadPolicies.set(sq.id, { cutoffOn: null, revision: 1 }); }
  return created(squadDto(sq));
});
patch('/clubs/:id/squads/:sid', ({ params, body }) => {
  const sq = squadById(params.sid); if (!sq) return notFound();
  if (body?.name) sq.name = body.name; if (body?.category) sq.ageGroup = body.category; if (body?.gender) sq.gender = body.gender; if (body?.headCoachId !== undefined) sq.headCoachId = body.headCoachId;
  return squadDto(sq);
});
del('/clubs/:id/squads/:sid', ({ params }) => {
  const sq = squadById(params.sid); if (!sq) return notFound();
  if (sq.playerIds.length) return reply(409, { status: 409, message: 'Move or remove the squad’s players before deleting it.' });
  W.squads.splice(W.squads.indexOf(sq), 1); const i = C.squads.indexOf(sq); if (i >= 0) C.squads.splice(i, 1); return ok();
});
const addToSquad = (sq, p) => {
  const uid = Number(p.userId); if (!personById(uid) && !C.playerCards.some(c => c.userId === uid)) return false;
  if (!sq.playerIds.includes(uid)) sq.playerIds.push(uid);
  if (p.jerseyNumber != null || p.squadRole) C.squadRoles.set(`${sq.id}:${uid}`, { jerseyNumber: p.jerseyNumber ?? null, squadRole: p.squadRole ?? 'PLAYER' });
  return true;
};
post('/clubs/:id/squads/:sid/players', ({ params, body }) => { const sq = squadById(params.sid); if (!sq) return notFound(); if (!addToSquad(sq, body ?? {})) return notFound('Player not found.'); return { message: 'Player added to the squad.' }; });
post('/clubs/:id/squads/:sid/players/batch', ({ params, body }) => { const sq = squadById(params.sid); if (!sq) return notFound(); const added = (body?.players ?? []).filter(p => addToSquad(sq, p)).length; return { message: `${added} players added.`, added }; });
patch('/clubs/:id/squads/:sid/players/:uid', ({ params, body }) => { const key = `${params.sid}:${params.uid}`; C.squadRoles.set(key, { ...(C.squadRoles.get(key) ?? {}), ...(body ?? {}) }); return ok(); });
del('/clubs/:id/squads/:sid/players/:uid', ({ params }) => { const sq = squadById(params.sid); if (sq) sq.playerIds = sq.playerIds.filter(id => id !== Number(params.uid)); return { message: 'Player removed from the squad.' }; });
get('/clubs/:id/squads/:sid/age-policy', ({ params }) => {
  const sq = squadById(params.sid), p = C.squadPolicies.get(Number(params.sid)); if (!sq || !p) return notFound();
  return { cutoffOn: p.cutoffOn, effectiveCutoff: p.cutoffOn ?? `${new Date().getFullYear()}-09-01`, revision: p.revision, rule: sq.ageGroup === 'SENIOR' ? 'No upper age limit.' : `Players must be under ${sq.ageGroup.slice(1)} on the cutoff date.` };
});
put('/clubs/:id/squads/:sid/age-policy', ({ params, body }) => {
  const sq = squadById(params.sid), p = C.squadPolicies.get(Number(params.sid)); if (!sq || !p) return notFound();
  if (body?.revision !== p.revision) return conflict();
  p.cutoffOn = body.cutoffOn ?? null; p.revision++;
  return { cutoffOn: p.cutoffOn, effectiveCutoff: p.cutoffOn ?? `${new Date().getFullYear()}-09-01`, revision: p.revision, rule: sq.ageGroup === 'SENIOR' ? 'No upper age limit.' : `Players must be under ${sq.ageGroup.slice(1)} on the cutoff date.` };
});

// Player cards (players without their own account)
get('/clubs/:id/player-cards', ({ params }) => C.playerCards.filter(c => c.clubId === Number(params.id)));
post('/clubs/:id/player-cards', ({ params, body }) => {
  const year = Number(body?.birthYear), now = new Date().getFullYear();
  if (!body?.fullName?.trim()) return bad('Full name is required.');
  if (!year || year < now - 40 || year > now - 4) return bad('Birth year is invalid.');
  if (body.photoUrl && now - year < 13) return bad('Player cards for players under 13 cannot have a photo.');
  const id = C.nextId(); const card = { id, clubId: Number(params.id), userId: 900000 + id, fullName: body.fullName.trim(), birthYear: year, position: body.position ?? null, jerseyNumber: body.jerseyNumber ?? null, photoUrl: body.photoUrl ?? null, parentEmail: body.parentEmail ?? null, guardianUserId: null, squadId: body.squadId ?? null, claimed: false, registered: false };
  C.playerCards.push(card); return created(card);
});
patch('/clubs/:id/player-cards/:cid', ({ params, body }) => {
  const card = C.playerCards.find(c => c.id === Number(params.cid)); if (!card) return notFound('Player card not found.');
  for (const k of ['fullName', 'birthYear', 'position', 'jerseyNumber', 'photoUrl', 'parentEmail', 'squadId']) if (body?.[k] !== undefined) card[k] = body[k];
  if (new Date().getFullYear() - card.birthYear < 13) card.photoUrl = null;
  return card;
});
del('/clubs/:id/player-cards/:cid', ({ params }) => { const i = C.playerCards.findIndex(c => c.id === Number(params.cid)); if (i >= 0) C.playerCards.splice(i, 1); return { message: 'Player card deleted.' }; });
get('/player-cards/mine', () => []);

// ================================================================ applications, tryouts
get('/clubs/:id/management/applications', ({ query }) => {
  const focus = num(query.get('applicationId'));
  let rows = C.applications;
  if (focus) rows = rows.filter(a => a.id === focus);
  else {
    const status = query.get('status'), position = query.get('position'), ageGroup = query.get('ageGroup'), jobId = num(query.get('jobId'));
    rows = rows.filter(a => (!status || a.status === status) && (!position || a.position === position) && (!ageGroup || a.ageGroup === ageGroup) && (!jobId || a.jobId === jobId));
  }
  rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const p = Number(query.get('page') ?? 0), size = Number(query.get('size') ?? 100);
  return reply(200, rows.slice(p * size, p * size + size), { 'x-total-count': String(rows.length), 'access-control-expose-headers': 'x-total-count' });
});
const decide = (id, status, message) => {
  const a = C.applications.find(x => x.id === Number(id)); if (!a) return null;
  if (a.status !== 'PENDING') return 'SKIPPED';
  a.status = status; a.decisionMessage = message ?? null;
  if (status === 'ACCEPTED' && a.role === 'PLAYER' && !C.affiliations.some(x => x.userId === a.userId))
    C.affiliations.push({ userId: a.userId, status: 'TRIALIST', primary: false, source: 'application', joinedAt: C.nowIso(), endedAt: null, position: a.position, jerseyNumber: null, requiresParentalConsent: Boolean(a.isMinor), parentalConsentStatus: a.isMinor ? 'PENDING' : null, parentalConsentAt: null, parentEmail: null, trialEndsOn: C.date(21) });
  if (status === 'ACCEPTED' && a.role === 'COACH' && !C.members.some(m => m.userId === a.userId)) C.members.push({ userId: a.userId, role: 'COACH', publicTitle: a.jobTitle, clubBio: null, qualifications: null, isPublic: false });
  return status;
};
post('/clubs/:id/management/applications/:aid/accept', ({ params, body }) => { const r = decide(params.aid, 'ACCEPTED', body?.message); if (!r) return notFound(); if (r === 'SKIPPED') return conflict('Only pending applications can be decided.'); return { activeElsewhere: false }; });
post('/clubs/:id/management/applications/:aid/decline', ({ params, body }) => { const r = decide(params.aid, 'DECLINED', body?.message); if (!r) return notFound(); if (r === 'SKIPPED') return conflict('Only pending applications can be decided.'); return ok(); });
post('/clubs/:id/applications/bulk-decide', ({ body }) => ({ results: (body?.applicationIds ?? []).map(id => { const r = decide(id, body.action === 'DECLINE' ? 'DECLINED' : 'ACCEPTED', body.message); return { applicationId: id, status: r === 'SKIPPED' || !r ? 'SKIPPED' : body.action, reason: r === 'SKIPPED' ? 'Only pending applications can be decided.' : !r ? 'Application not found.' : null }; }) }));
post('/clubs/:id/applications', ({ params }) => isOwnClub(params.id) ? reply(409, { status: 409, message: 'You already belong to this club.' }) : created({ applicationId: C.nextId() }));
post('/clubs/:id/applications/:aid/cancel', () => ({ status: 'CANCELLED' }));

get('/admin/tryouts/clubs/:id/applications', ({ params }) => isOwnClub(params.id) ? C.tryoutApplicants : []);
put('/admin/tryouts/clubs/:id/applications/:aid/status', ({ params, body }) => { const a = C.tryoutApplicants.find(x => x.id === Number(params.aid)); if (!a) return notFound(); a.status = body?.status ?? a.status; return a; });
get('/tryouts/club/:id/postings', ({ params, query }) => {
  const rows = isOwnClub(params.id) ? C.tryoutPostings().sort((a, b) => b.tryoutDate.localeCompare(a.tryoutDate)) : [];
  const p = Number(query.get('page') ?? 0), size = Number(query.get('size') ?? 20);
  return { content: rows.slice(p * size, p * size + size), total: rows.length, openCount: rows.filter(t => t.status === 'OPEN').length, hasMore: (p + 1) * size < rows.length, canManage: isOwnClub(params.id), page: p, size };
});
const tryoutDto = id => { const t = C.tryoutPostings().find(x => x.tryoutId === id); return t && { id: t.tryoutId, clubId: t.clubId, title: t.title, description: t.description, position: t.position, ageGroup: t.ageGroup, gender: null, tryoutDate: t.tryoutDate, deadline: t.deadline, status: t.status }; };
const tryoutFields = (t, body) => {
  if (body.title !== undefined) { t.title = body.title.trim(); t.squadName = t.title.replace(/ open trial$/i, ''); }
  if (body.tryoutDate) t.date = new Date(body.tryoutDate);
  for (const k of ['description', 'position', 'ageGroup']) if (body[k] !== undefined) t[k] = body[k] || null;
};
post('/tryouts', ({ body }) => {
  if (!isOwnClub(body?.clubId)) return undefined;
  if (!body.title?.trim() || !body.tryoutDate) return bad('Add a title and a date.');
  const t = C.addTrial({ id: C.nextId(), clubId: CLUB, squadName: '', ageGroup: null, date: new Date(body.tryoutDate), venueId: 202, spots: 16, taken: 0, description: '', position: null });
  tryoutFields(t, body); return created(tryoutDto(t.id));
});
put('/tryouts/:tid', ({ params, body }) => { const t = C.trialById(params.tid); if (!t) return undefined; tryoutFields(t, body ?? {}); return tryoutDto(t.id); });
del('/tryouts/:tid', ({ params }) => { const t = C.trialById(params.tid); if (!t) return undefined; t.status = 'CLOSED'; t.clubId = -CLUB; return ok(); });

// ================================================================ jobs (club management)
const pendingFor = id => C.applications.filter(a => a.jobId === id && a.status === 'PENDING').length + C.jobApplications.filter(a => a.jobId === id && a.userId && a.status === 'PENDING').length;
const jobView = j => { const c = clubById(j.clubId); return { ...j, applicationCount: pendingFor(j.id), clubName: c?.name, clubLogoUrl: c?.logoUrl, clubCityName: c?.city, clubCountryName: 'Georgia' }; };
const clubJobs = id => isOwnClub(id) ? C.jobs().map(jobView) : (C.F.roleList ?? W.roles).filter(r => r.clubId === Number(id)).map(r => (C.F.jobView ? C.F.jobView(r) : { id: r.id, clubId: r.clubId, title: r.title, description: r.description, status: 'OPEN', createdAt: W.iso(r.posted) }));
get('/clubs/:id/jobs', ({ params }) => clubJobs(params.id).filter(j => j.status === 'OPEN'));
get('/clubs/:id/jobs/all', ({ params }) => clubJobs(params.id).sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'OPEN' ? -1 : 1)));
const jobFields = ['title', 'description', 'ageGroup', 'level', 'requiredRole', 'category', 'engagementType', 'status'];
post('/clubs/:id/jobs', ({ params, body }) => {
  if (!isOwnClub(params.id)) return reply(403, { status: 403, message: 'Only club leadership can post roles.' });
  if (!body?.title?.trim()) return bad('Title is required.');
  const id = C.nextId();
  C.addRole({ id, clubId: CLUB, title: body.title.trim(), kind: body.engagementType === 'VOLUNTEER' ? 'VOLUNTEER' : 'JOB', employment: body.engagementType === 'VOLUNTEER' ? 'VOLUNTEER' : 'PART_TIME', city: 'Tbilisi', posted: new Date(), deadline: W.day(30), description: body.description ?? '', requirements: [] });
  C.jobOverride(id, { ...Object.fromEntries(jobFields.filter(k => body[k] !== undefined).map(k => [k, body[k]])), status: 'OPEN', version: 1 });
  return created(jobView(C.jobs().find(j => j.id === id)));
});
patch('/clubs/:id/jobs/:jid', ({ params, body }) => {
  const id = Number(params.jid), j = C.jobs().find(x => x.id === id); if (!j) return notFound('Job posting not found.');
  if (body?.version != null && body.version !== j.version) return conflict();
  const values = Object.fromEntries(jobFields.filter(k => body?.[k] !== undefined).map(k => [k, body[k]]));
  const local = C.clubOnlyJobs.find(x => x.id === id);
  if (local) Object.assign(local, values, { version: local.version + 1 }); else C.jobOverride(id, { ...values, version: j.version + 1 });
  return jobView(C.jobs().find(x => x.id === id));
});
del('/clubs/:id/jobs/:jid', ({ params }) => { const id = Number(params.jid); const i = C.clubOnlyJobs.findIndex(x => x.id === id); if (i >= 0) C.clubOnlyJobs.splice(i, 1); else C.jobOverride(id, { deleted: true }); return { message: 'Job posting deleted.' }; });
get('/clubs/:id/jobs/:jid/applications', ({ params }) => {
  const j = C.jobs().find(x => x.id === Number(params.jid)); if (!j) return notFound('Job posting not found.');
  const fromClub = C.applications.filter(a => a.jobId === j.id);
  const extra = C.jobApplications.filter(a => a.jobId === j.id && a.userId).map(a => { const p = personById(a.userId); return { id: a.id, userId: a.userId, fullName: p?.fullName, username: p?.username, avatarUrl: p?.avatarUrl, role: a.role, status: a.status, message: a.message, createdAt: a.createdAt, position: null, ageGroup: null, jobId: j.id, jobTitle: j.title, age: C.ageOf(p), isMinor: false }; });
  return [...fromClub, ...extra];
});

// Club operations and workspace roles are registered in club-workspace.mjs.
get('/club-operations/family', () => ({ connections: [], shared: [], schedule: [], reports: [] }));
get('/club-operations/matches/:eid/readiness', ({ params }) => {
  const prep = C.records.find(r => r.kind === 'MATCH_PREPARATION' && r.event_id === Number(params.eid));
  // MatchReadiness.tsx expects one entry per club the viewer can see.
  const records = C.records.filter(r => r.event_id === Number(params.eid))
    .map(r => ({ id: r.id, title: r.title, module: r.module ?? 'READINESS', status: r.status, due_on: r.due_on ?? null, reviewOn: r.review_on ?? null }));
  return [{ clubId: CLUB, clubName: C.club.name, canReadPreparation: true, records }];
});
get('/clubs/:id/applications/eligibility', ({ params, query }) => {
  const own = isOwnClub(params.id);
  return { allowed: !own, reason: own ? 'ALREADY_CONNECTED' : null, message: null, pendingApplicationId: null, pendingInvitationId: null, eligibleFrom: null };
});

// ================================================================ admissions (joining arrangements)
const admissionWorkspace = () => ({
  organizationId: C.ORG_ID, organizationName: C.club.name, clubId: CLUB, canConfigure: true,
  groups: C.admissionGroups(), cases: C.admissionCases, inquiries: C.admissionInquiries,
  squads: C.squads.map(s => ({ id: s.id, name: s.name })), staff: C.activeStaffIds().map(id => ({ id, name: C.name(id) })), sessions: C.admissionSessions(),
});
// A physio's job and a plain membership don't run joining.
get('/clubs/:id/admissions', ({ params, headers }) => isOwnClub(params.id) && !['physio', 'attendance', 'member'].includes(personaOf(headers)) ? admissionWorkspace() : reply(403, { status: 403, message: 'Joining arrangements are managed by club staff.' }));
get('/organizations/:oid/admissions', ({ params }) => Number(params.oid) === C.ORG_ID ? admissionWorkspace() : undefined);
get('/organizations/:oid/admissions/legacy', ({ params }) => Number(params.oid) === C.ORG_ID ? [] : undefined);
const caseEvent = (c, action, message) => { c.history.push({ id: C.nextId(), action, message: message ?? null, actorName: C.name(C.ME), createdAt: C.nowIso() }); c.version++; c.updatedAt = C.nowIso(); };
post('/admissions/cases/:cid/commands', ({ params, body }) => {
  const c = C.admissionCases.find(x => x.id === Number(params.cid)); if (!c) return undefined;
  if (body?.expectedVersion != null && body.expectedVersion !== c.version) return reply(409, { code: 'VERSION_CONFLICT', message: 'This request changed. Reload to see the latest version.', currentVersion: c.version });
  const a = body?.action;
  if (a === 'ASSIGN') c.responsible = body.responsibleUserId ? { id: body.responsibleUserId, name: C.name(body.responsibleUserId) } : null;
  if (a === 'INVITE_SESSION') { c.sessions.push({ id: C.nextId(), version: 1, status: 'INVITED', emergencyContact: null, ...body.session }); c.stage = 'ARRANGING_PARTICIPATION'; c.nextAction = { code: 'ARRANGE_SESSION', owner: 'APPLICANT', label: 'Family to confirm the session', dueAt: body.session?.responseDeadline ?? null }; }
  if (a === 'RECORD_ATTENDANCE') { const s = c.sessions.find(x => x.id === body.participationId); if (s) { s.status = body.attendance; s.version++; } c.stage = 'INTRODUCTION_ASSESSMENT'; c.nextAction = { code: 'REVIEW_PARTICIPATION', owner: 'CLUB', label: 'Decide on a place', dueAt: null }; }
  if (a === 'ASSESS' || a === 'RECOMMEND' || a === 'APPROVE_ADMISSION') (c.assessments ??= []).push({ id: C.nextId(), kind: a, groupId: body.groupId, note: body.internalNote ?? body.reason ?? null, actorName: C.name(C.ME), createdAt: C.nowIso() });
  if (a === 'OFFER') { const g = C.admissionGroups().find(x => x.id === body.groupId) ?? C.admissionGroups().find(x => x.id === c.groupId); c.offer = { id: C.nextId(), version: 1, groupId: g.id, groupName: g.name, terms: g.terms, location: g.location, schedule: g.schedule, status: 'PENDING', responseDeadline: body.responseDeadline ?? C.at(7, 23), completionDeadline: body.completionDeadline ?? C.at(14, 23) }; c.stage = 'PLACE_OFFERED'; c.nextAction = { code: 'RESPOND_OFFER', owner: 'APPLICANT', label: 'Family to accept or decline the place', dueAt: c.offer.responseDeadline }; c.actions = ['MESSAGE', 'WITHDRAW_OFFER', 'EXTEND_OFFER']; }
  if (a === 'WITHDRAW_OFFER' && c.offer) { c.offer.status = 'WITHDRAWN'; c.stage = 'INTRODUCTION_ASSESSMENT'; c.nextAction = { code: 'REVIEW_PARTICIPATION', owner: 'CLUB', label: 'Decide on a place', dueAt: null }; c.actions = ['MESSAGE', 'OFFER', 'WAITLIST', 'DECLINE']; }
  if (a === 'EXTEND_OFFER' && c.offer) { c.offer.responseDeadline = body.responseDeadline; c.offer.version++; c.nextAction.dueAt = body.responseDeadline; }
  if (a === 'COMPLETE_REQUIREMENT') { const r = c.requirements.find(x => x.id === body.requirementId); if (r) { r.status = 'COMPLETE'; r.evidence = body.evidence; } if (c.requirements.every(r => r.status === 'COMPLETE')) { const g = C.admissionGroups().find(x => x.id === c.groupId); c.stage = 'ENROLLED'; c.enrollment = { id: C.nextId(), groupId: g.id, groupName: g.name, startDate: C.date(2), endDate: null, status: 'ACTIVE', matchEligibility: 'NOT_GRANTED', scheduleDestination: '/calendar', squadId: g.squadId, rosterDestination: '/clubs/1/workspace?tab=squads' }; c.nextAction = { code: 'ENROLLED', owner: 'NONE', label: 'Enrolled', dueAt: null }; c.actions = ['MESSAGE', 'CANCEL_ENROLLMENT']; } }
  if (a === 'WAITLIST') { c.stage = 'WAITLIST'; c.nextAction = { code: 'WAIT_FOR_PLACE', owner: 'NONE', label: 'Waiting for a place', dueAt: null }; c.actions = ['MESSAGE', 'OFFER', 'DECLINE']; }
  if (a === 'DECLINE' || a === 'CANCEL_ENROLLMENT') { c.stage = 'CLOSED'; c.nextAction = { code: 'CLOSED', owner: 'NONE', label: 'Closed', dueAt: null }; c.actions = []; if (c.enrollment) c.enrollment.status = 'CANCELLED'; }
  caseEvent(c, a, body?.message ?? body?.reason ?? body?.internalNote ?? null);
  return c;
});
get('/admissions/cases/:cid', ({ params }) => C.admissionCases.find(x => x.id === Number(params.cid)) ?? undefined);
get('/admissions/cases/:cid/lifecycle', ({ params }) => {
  const c = C.admissionCases.find(x => x.id === Number(params.cid)); if (!c) return undefined;
  return { caseId: c.id, caseVersion: c.version, reviewDueAt: c.stage === 'ENROLLED' ? C.at(90) : null, reviewTimezone: C.TIMEZONE, reviewSource: c.stage === 'ENROLLED' ? 'DEFAULT' : 'NONE', reviewOverdue: false, reviewOwner: C.name(c.responsible?.id ?? C.ME), departure: null, seasonCaseId: null, seasonGroupName: null, seasonDestination: null, actions: c.stage === 'ENROLLED' ? ['SET_REVIEW_DATE', 'PROPOSE_DEPARTURE'] : [] };
});
post('/admissions/inquiries/:qid/commands', ({ params, body }) => {
  const q = C.admissionInquiries.find(x => x.id === Number(params.qid)); if (!q) return undefined;
  if (body?.expectedVersion != null && body.expectedVersion !== q.version) return reply(409, { code: 'VERSION_CONFLICT', message: 'This enquiry changed. Reload to continue.', currentVersion: q.version });
  q.history.push({ id: C.nextId(), action: body.action, message: body.message || null, actorName: C.name(C.ME), createdAt: C.nowIso() });
  if (body.action === 'RESOLVE') q.status = 'RESOLVED'; if (body.action === 'DECLINE') q.status = 'DECLINED'; if (body.action === 'REOPEN') q.status = 'OPEN';
  if (body.action === 'MESSAGE') q.nextAction = { code: 'FAMILY_REPLY', owner: 'APPLICANT', label: 'Waiting for the family', dueAt: null };
  if (body.action === 'ROUTE') { const g = C.admissionGroups().find(x => x.id === body.groupId); const p = personById(q.playerId); if (g && p) { const c = { ...C.admissionCases[0], id: C.nextId(), version: 1, playerId: p.id, playerName: p.fullName, dateOfBirth: C.birthDate(p), groupId: g.id, groupName: g.name, method: g.method, stage: 'REQUEST_RECEIVED', history: [], sessions: [], offer: null, enrollment: null, requirements: [], submittedAt: C.nowIso(), updatedAt: C.nowIso() }; C.admissionCases.push(c); q.caseId = c.id; q.status = 'ROUTED'; } }
  q.version++; q.updatedAt = C.nowIso(); return q;
});
get('/admissions/inquiries/:qid', ({ params }) => C.admissionInquiries.find(x => x.id === Number(params.qid)) ?? undefined);
const sharedGroup = id => (C.F.admissionGroups ?? []).find(g => g.id === Number(id) && g.clubId === CLUB);
put('/organizations/:oid/admissions/groups/:gid', ({ params, body }) => {
  const g = sharedGroup(params.gid); if (!g || Number(params.oid) !== C.ORG_ID) return undefined;
  if (body?.expectedVersion !== g.version) return reply(409, { code: 'VERSION_CONFLICT', message: 'This group changed. Reload before saving.', currentVersion: g.version });
  const { requestId, expectedVersion, ...rest } = body; void requestId; void expectedVersion; Object.assign(g, rest, { version: g.version + 1 });
  return C.admissionGroups().find(x => x.id === g.id);
});
post('/organizations/:oid/admissions/groups', ({ params, body }) => {
  if (Number(params.oid) !== C.ORG_ID) return undefined;
  const { requestId, expectedVersion, ...rest } = body ?? {}; void requestId; void expectedVersion;
  const id = C.nextId();
  (C.F.admissionGroups ?? []).push({ ...C.admissionGroups()[0], ...rest, id, version: 1, organizationId: C.ORG_ID, organizationName: C.club.name, clubId: CLUB, availability: rest.intakeOpen ? 'PLACES_AVAILABLE' : 'CLOSED', remainingPlaces: rest.capacity ?? 0, destination: `/admissions/opportunities/${id}`, canManage: true, verified: true });
  return created(C.admissionGroups().find(x => x.id === id));
});
post('/organizations/:oid/admissions/invitations', ({ params, body }) => Number(params.oid) === C.ORG_ID ? created({ id: C.nextId(), version: 1, organizationId: C.ORG_ID, organizationName: C.club.name, groupId: body?.groupId, groupName: C.admissionGroups().find(g => g.id === body?.groupId)?.name ?? '', intendedPlayerId: body?.intendedPlayerId ?? null, message: body?.message ?? '', expiresAt: C.at(14), status: 'PENDING' }) : undefined);
post('/organizations/:oid/admissions/inquiries', ({ params, body }) => {
  if (Number(params.oid) !== C.ORG_ID) return undefined;
  const p = personById(body?.playerId);
  const q = { id: C.nextId(), version: 1, playerId: p?.id ?? null, playerName: p?.fullName ?? null, organizationId: C.ORG_ID, organizationName: C.club.name, status: 'OPEN', groupId: body?.groupId ?? null, programmeId: body?.programmeId ?? null, squadId: body?.squadId ?? null, message: body?.message ?? '', caseId: null, actions: ['MESSAGE', 'ROUTE', 'RESOLVE', 'DECLINE'], nextAction: { code: 'CLUB_REPLY', owner: 'CLUB', label: 'Reply to the family', dueAt: C.at(2, 18) }, history: [], createdAt: C.nowIso(), updatedAt: C.nowIso() };
  C.admissionInquiries.unshift(q); return created(q);
});

// ================================================================ agent approaches (club side)
const approachOpen = a => ['PENDING_CLUB', 'PENDING_PLAYER', 'ACTIVE'].includes(a.status);
get('/club-approaches', ({ query }) => {
  const clubId = num(query.get('clubId')); if (clubId && clubId !== CLUB) return undefined;
  const view = query.get('view') ?? 'OPEN', p = Number(query.get('page') ?? 0), size = Number(query.get('size') ?? 20);
  if (!clubId) return { items: [], total: 0, page: p, size }; // agent-side view: Luka is not an agent
  const rows = C.approaches.filter(a => view === 'ALL' || (view === 'OPEN' ? approachOpen(a) : !approachOpen(a))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { items: rows.slice(p * size, p * size + size), total: rows.length, page: p, size };
});
get('/club-approaches/summary', () => ({ active: C.approaches.filter(a => a.status === 'ACTIVE').length, pending: C.approaches.filter(a => a.status === 'PENDING_CLUB').length }));
get('/club-approaches/:aid', ({ params }) => C.approaches.find(a => a.id === Number(params.aid)) ?? undefined);
patch('/club-approaches/:aid', ({ params, body }) => {
  const a = C.approaches.find(x => x.id === Number(params.aid)); if (!a) return undefined;
  if (body?.version !== a.version) return conflict();
  a.status = { ACCEPT: 'ACTIVE', APPROVE: 'ACTIVE', DECLINE: 'DECLINED', CANCEL: 'CANCELLED', END: 'ENDED', REVOKE: 'REVOKED' }[body.action] ?? a.status;
  a.allowedActions = a.status === 'ACTIVE' ? ['END'] : []; a.version++; a.updatedAt = C.nowIso(); return a;
});
get('/club-approaches/:aid/messages', ({ params, query }) => { const list = C.approachMessages.get(Number(params.aid)); if (!list) return undefined; const p = Number(query.get('page') ?? 0), size = Number(query.get('size') ?? 20); const rows = [...list].reverse(); return { items: rows.slice(p * size, p * size + size), total: rows.length, page: p, size }; });
post('/club-approaches/:aid/messages', ({ params, body }) => { const list = C.approachMessages.get(Number(params.aid)); if (!list) return undefined; const m = { id: C.nextId(), authorId: C.ME, authorName: C.name(C.ME), kind: 'MESSAGE', body: String(body?.body ?? ''), createdAt: C.nowIso() }; list.push(m); return created(m); });

// ================================================================ store & campaigns (club management)
get('/clubs/:id/store/products/all', storeManagerProducts);
get('/clubs/:id/store/products', ({ params }) => C.products.filter(p => p.clubId === Number(params.id) && p.active));
const variantsFrom = list => (list ?? []).map(v => ({ id: allocateStoreVariantId(), label: v.label, stock: Number(v.stock ?? 0) }));
post('/clubs/:id/store/products', request => storeCreate(request, () => {
  const { params, body } = request;
  if (!isOwnClub(params.id)) return reply(403, { status: 403, message: 'Only club leadership can manage the store.' });
  if (!body?.name?.trim()) return bad('Name the product.');
  const id = C.nextId(), variants = variantsFrom(body.variants);
  const p = { id, currency: body.currency ?? 'GEL', version: 1, clubId: CLUB, clubName: C.club.name, clubLogoUrl: C.club.logoUrl, clubWhatsappNumber: '+995 32 224 11 25', clubEmail: 'shop@dta.ge', sellerKind: 'CLUB', collection: null, name: body.name.trim(), description: body.description ?? null, price: body.price ?? null, sizes: variants.map(v => v.label), images: body.images?.length ? body.images : F.picturesFor(id, body.name, body.category ?? 'OTHER'), active: body.active ?? true, createdAt: C.nowIso(), category: body.category ?? 'OTHER', clubCityName: 'Tbilisi', clubCountryName: 'Georgia', variants };
  C.products.push(p); return created(p);
}));
patch('/clubs/:id/store/products/:pid', storeUpdate);
del('/clubs/:id/store/products/:pid', storeArchive);

// ================================================================ club organization (settings: activities, venues, imports)
const ORG = () => C.organization;
const isClubOrg = id => Number(id) === C.ORG_ID;
const capabilities = () => ({ enabledActivities: [...ORG().activities.enabledActivities], revision: ORG().activities.revision, venueAvailable: true, canConfigureActivities: true, canEditProfile: true,
  canConfigureVenue: ORG().activities.enabledActivities.includes('VENUE'), canManageVenueBookings: ORG().activities.enabledActivities.includes('VENUE'), canCreateTournament: ORG().activities.enabledActivities.includes('TOURNAMENT'), canInviteVenueOperator: true });
get('/organizations/workspaces', () => [{ id: C.ORG_ID, displayName: C.club.name, clubId: CLUB, venueCount: ORG().venueRelationships.length, organizationType: 'CLUB', kinds: ['CLUB', 'VENUE'] }]);
get('/organizations/:oid/workspace', ({ params }) => isClubOrg(params.oid) ? { id: C.ORG_ID, displayName: C.club.name, organizationType: 'CLUB', identityRevision: ORG().identityRevision, clubId: CLUB, membershipRole: 'OWNER', canManage: true, promotionBlocked: false,
  capabilities: capabilities(), team: C.members.filter(m => ['OWNER', 'CLUB_ADMIN'].includes(m.role)).map(m => ({ userId: m.userId, name: C.name(m.userId), role: m.role })), venueCount: ORG().venueRelationships.length,
  tournaments: (C.F.tournamentList ?? W.tournaments).filter(t => t.organizerClubId === CLUB).map(t => ({ id: t.id, name: t.name, status: t.status, canManage: true })) } : undefined);
get('/organizations/:oid/activities', ({ params }) => isClubOrg(params.oid) ? capabilities() : undefined);
put('/organizations/:oid/activities', ({ params, body }) => {
  if (!isClubOrg(params.oid)) return undefined;
  if (body?.revision != null && body.revision !== ORG().activities.revision) return conflict('Activity settings changed. Reload and try again.');
  ORG().activities = { enabledActivities: [...new Set(['PROFILE', ...(body?.enabledActivities ?? [])])], revision: ORG().activities.revision + 1 };
  return capabilities();
});
const delegation = () => ({ invitations: ORG().operatorInvitations.filter(i => i.status === 'PENDING'), operators: ORG().operators });
get('/organizations/:oid/venue-operators', ({ params }) => isClubOrg(params.oid) ? delegation() : undefined);
post('/organizations/:oid/venue-operators/invitations', ({ params, body }) => { if (!isClubOrg(params.oid)) return undefined; ORG().operatorInvitations.push({ id: C.nextId(), organizationId: C.ORG_ID, organizationName: C.club.name, recipientName: body?.email ?? null, status: 'PENDING', expiresAt: C.at(14), canRespond: false, canOpenVenue: false }); return delegation(); });
post('/organizations/:oid/venue-operators/invitations/:iid/cancel', ({ params }) => { if (!isClubOrg(params.oid)) return undefined; const i = ORG().operatorInvitations.find(x => x.id === Number(params.iid)); if (i) i.status = 'CANCELLED'; return delegation(); });
post('/organizations/:oid/venue-operators/:mid/revoke', ({ params }) => { if (!isClubOrg(params.oid)) return undefined; const m = ORG().operators.find(x => x.membershipId === Number(params.mid)); if (m) { m.status = 'ENDED'; m.endedAt = C.nowIso(); } return delegation(); });
const portfolio = () => ({ clubId: CLUB, canManageRelationships: true, venues: ORG().venueRelationships.map(r => { const v = W.venueById(r.id); return { ...r, name: v?.name ?? 'Venue', city: v?.city ?? null, canManage: r.relationship === 'OWNS', canEnd: true }; }) });
get('/organizations/:oid/portfolio', ({ params }) => isClubOrg(params.oid) ? portfolio() : undefined);
get('/organizations/:oid/venue-candidates', ({ params }) => isClubOrg(params.oid) ? W.venues.filter(v => !ORG().venueRelationships.some(r => r.id === v.id)).map(v => ({ id: v.id, name: v.name, city: v.city })) : undefined);
post('/organizations/:oid/venue-relationships', ({ params, body }) => {
  if (!isClubOrg(params.oid)) return undefined;
  if (!W.venueById(body?.venueId)) return bad('Choose a venue.');
  ORG().venueRelationships.push({ relationshipId: C.nextId(), id: Number(body.venueId), relationship: body.relationship ?? 'OPERATES', source: 'CLUB_RECORD', revision: 1, published: true }); return portfolio();
});
post('/organizations/:oid/venue-relationships/:rid/end', ({ params, body }) => {
  if (!isClubOrg(params.oid)) return undefined;
  const r = ORG().venueRelationships.find(x => x.relationshipId === Number(params.rid)); if (!r) return notFound();
  if (body?.revision != null && body.revision !== r.revision) return conflict();
  ORG().venueRelationships.splice(ORG().venueRelationships.indexOf(r), 1); return portfolio();
});
post('/organizations/:oid/imports/preview', ({ params, body }) => {
  if (!isClubOrg(params.oid)) return undefined;
  const rows = (body?.rows ?? []).map((r, i) => { const issues = Object.values(r.values ?? {}).some(v => String(v).trim()) ? [] : ['Row is empty.']; return { row: i + 2, values: r.values ?? {}, status: issues.length ? 'ERROR' : 'READY', issues }; });
  return { fingerprint: `preview-${rows.length}-${Date.now()}`, ready: rows.filter(r => r.status === 'READY').length, duplicates: 0, errors: rows.filter(r => r.status === 'ERROR').length, rows };
});
post('/organizations/:oid/imports/commit', ({ params, body }) => isClubOrg(params.oid) ? { created: (body?.rows ?? []).length, skipped: 0 } : undefined);

// Fallback for the session register's introductory-visitor panel (the squad-communication
// domain answers first when it implements this path). Visitors come from joining arrangements.
get('/squad-communication/:sid/sessions/:eid/introductory-visitors', ({ params }) => ({
  sessionRevision: 1,
  visitors: C.admissionCases.flatMap(c => c.sessions.filter(s => s.squadSessionId === Number(params.eid)).map(s => ({ participationId: s.id, caseId: c.id, playerId: c.playerId, caseVersion: c.version, participationVersion: s.version, name: c.playerName, status: s.status, permissionStatus: 'NOT_REQUIRED', emergencyContact: s.emergencyContact, canRecord: true }))),
}));

// ================================================================ joining a club (public profile: options, contacts, enquiries)
const optionAvailability = g => !g ? 'ENQUIRY_ONLY' : g.availability === 'CLOSED' ? 'CLOSED' : g.availability === 'WAITLIST' ? 'WAITLIST' : 'AVAILABLE';
get('/joining/clubs/:id/options', ({ params }) => {
  const clubId = Number(params.id), c = clubById(clubId); if (!c) return notFound('Club not found.');
  const groups = (C.F.admissionGroups ?? []).filter(g => g.clubId === clubId).map(({ verified, ...g }) => { void verified; return g; });
  const programmes = C.presentations.get(clubId)?.programmes ?? [];
  const squadOptions = W.squads.filter(s => s.clubId === clubId).map(s => { const g = groups.find(x => x.squadId === s.id) ?? null; return { squadId: s.id, squadName: s.name, programmeIds: programmes.filter(p => p.squadIds?.includes(s.id)).map(p => p.id), opportunity: g, availability: optionAvailability(g), destination: g?.destination ?? null }; });
  const groupOptions = groups.filter(g => !g.squadId || !squadOptions.some(o => o.squadId === g.squadId)).map(g => ({ squadId: null, squadName: g.name, programmeIds: [], opportunity: g, availability: optionAvailability(g), destination: g.destination }));
  return { clubId, organizationId: groups[0]?.organizationId ?? 900 + clubId, options: [...squadOptions, ...groupOptions] };
});
get('/joining/clubs/:id/contacts', ({ params, query }) => {
  const clubId = Number(params.id), squad = num(query.get('squadId'));
  if (!isOwnClub(clubId)) { const coach = W.people.find(p => p.clubId === clubId && p.role === 'COACH'); const v = W.venueById(clubById(clubId)?.venueId); return { contacts: coach ? [{ id: coach.id, name: coach.fullName, online: null, busy: false }] : [], venues: v ? [{ id: -v.id, name: v.name, address: `${v.district}, ${v.city}`, squadId: null }] : [] }; }
  const sq = squad ? squadById(squad) : null;
  const ids = [...new Set([...(sq?.headCoachId ? [sq.headCoachId] : []), C.STAFF.director, C.ME])];
  return { contacts: ids.map((id, i) => ({ id, name: C.name(id), online: i === 0 ? true : null, busy: false })), venues: C.records.filter(r => r.kind === 'FACILITY' && r.status === 'PUBLISHED' && r.data.placeType === 'VENUE').map(r => ({ id: r.id, name: r.title, address: r.data.address, squadId: r.squad_id })) };
});
post('/joining/clubs/:id/enquiries', ({ params, body }) => {
  const clubId = Number(params.id), c = clubById(clubId); if (!c) return notFound('Club not found.');
  if (!String(body?.message ?? '').trim()) return bad('Write a short message for the club.');
  const p = personById(body.playerId);
  const q = { id: C.nextId(), version: 1, playerId: p?.id ?? null, playerName: p?.fullName ?? null, conversationId: null, groupId: body.groupId ?? null, programmeId: body.programmeId ?? null, squadId: body.squadId ?? null,
    organizationId: isOwnClub(clubId) ? C.ORG_ID : 900 + clubId, organizationName: c.name, status: 'OPEN', message: String(body.message), caseId: null, actions: ['MESSAGE', 'WITHDRAW'],
    nextAction: { code: 'CLUB_REPLY', owner: 'CLUB', label: 'The club replies in your chat', dueAt: C.at(2, 18) }, history: [], createdAt: C.nowIso(), updatedAt: C.nowIso(),
    continuation: { applicant: true, staff: false, destination: '/requests?view=OUTGOING' }, applicantDestination: '/requests?view=OUTGOING', conversationDestination: null };
  if (isOwnClub(clubId)) C.admissionInquiries.unshift({ ...q, actions: ['MESSAGE', 'ROUTE', 'RESOLVE', 'DECLINE'] });
  return created(q);
});
