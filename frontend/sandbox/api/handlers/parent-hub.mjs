// Synthetic API: Parent Hub, step 5 (see ../world-parents.mjs). The real shapes are the backend's
// (AdmissionFirstVisits, SquadJoinLinkService's cases, ClubDirectoryFilters):
//   GET  /admissions/groups/:id/first-visits                the group's next trainings with a first-visit place left
//   POST /admissions/groups/:id/first-visits                a family books one: a joining case, confirmed at once, or
//                                                           reserved where the group needs the current club's permission;
//                                                           the terms and the training it saw, or TERMS_CHANGED / SESSION_CHANGED
//   PUT  /joining/players/:pid                              the card's versioned update (a declared gender, asked in booking)
//   GET  /squad-communication/:id/join-requests             adds a family's own group requests (GROUP) and visits (VISIT)
//   POST /squad-communication/:id/join-requests/cases/:cid  Accept or Not now on one of those; the first answer counts, a
//                                                           retried one gets its own answer, a changed group is refused
//   GET  /match-arrangements/:id/participants               a family's child called up for a connected fixture, to answer
//   POST /match-arrangements/:id/squads/:sid/attendance     that answer, with the call-up's and the match's revisions
//   GET  /clubs ?lat&lng&km&day&sort=NEAREST                 distance from "You" and training days, as real filters
// Registered ahead of the squad, family and club domains; anything else passes on.
import { get, post, put, reply, handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import { familyOf } from '../world-family.mjs';
import { squadAccess } from '../squad-access.mjs';
import '../world-parents.mjs';

const PASS = 'x-sandbox-parent-hub-pass';
const passOn = req => handleApi({ ...req, headers: { ...req.headers, [PASS]: '1' } });
const HOUR = 3600000, DAY = 24 * HOUR;
const visitsOf = group => group.firstVisits ?? { places: 3, fee: null, currency: null };
const free = visits => !visits.fee;
// A visit holds its place while confirmed, or while a reservation or a moved visit still waits for its answer (S5).
const holds = s => ['CONFIRMED', 'ATTENDED'].includes(s.status) || (['INVITED', 'RECONFIRM_REQUIRED'].includes(s.status) && Date.parse(s.responseDeadline) > Date.now());
const booked = sessionId => C.admissionCases.filter(c => c.firstVisit && c.stage !== 'CLOSED').flatMap(c => c.sessions).filter(s => s.squadSessionId === sessionId && holds(s)).length;
// Groups whose terms ask for the current club's permission reserve a visit until staff record it (S21).
const clearance = group => (group.terms?.requirements ?? []).includes('CURRENT_CLUB_PERMISSION');
const permission = reserved => reserved
  ? { required: true, reason: 'The child’s current club gives permission before a first visit.', status: 'PENDING', owner: 'CLUB', evidence: null, currentClub: null, recordedAt: null, canRecord: false, canRevoke: false, allowsParticipation: false }
  : { required: false, reason: '', status: 'NOT_REQUIRED', owner: 'CLUB', evidence: null, currentClub: null, recordedAt: null, canRecord: false, canRevoke: false, allowsParticipation: true };
const place = e => { const v = W.venueById(e.venueId); return v ? `${v.name}${e.pitch ? ` · ${e.pitch}` : ''}` : 'The club’s ground'; };
const offered = group => {
  const visits = visitsOf(group), from = Date.now() + 2 * HOUR, to = Date.now() + 28 * DAY;
  return W.events.filter(e => e.squadId === group.squadId && e.type === 'TRAINING' && !e.cancelled && e.start.getTime() >= from && e.start.getTime() <= to)
    .sort((a, b) => a.start - b.start).map(e => ({ reference: `session:${e.id}`, sessionId: e.id, startsAt: e.start.toISOString(), endsAt: e.end.toISOString(), place: place(e), placesLeft: visits.places - booked(e.id) }))
    .filter(s => s.placesLeft > 0);
};

get('/admissions/groups/:id/first-visits', ({ params, headers }) => {
  const group = F.groupById(params.id);
  if (!group || group.squadId == null) return undefined;
  if (V.viewerId(headers) === W.ME_ID && !familyOf(headers)) return undefined;
  const visits = visitsOf(group);
  return { groupId: group.id, groupVersion: group.version, places: visits.places, fee: visits.fee, currency: visits.currency, timezone: 'Asia/Tbilisi', sessions: visits.places > 0 ? offered(group) : [] };
});

post('/admissions/groups/:id/first-visits', ({ params, body, headers }) => {
  const group = F.groupById(params.id), family = familyOf(headers);
  if (!group || !family) return undefined;
  const child = family.find(c => c.id === Number(body?.playerId));
  if (!child) return reply(403, { status: 403, code: 'GUARDIAN_REQUIRED', message: 'You can book a visit for a child you look after.' });
  const repeat = C.admissionCases.find(c => c.requestId && c.requestId === body?.requestId);
  if (repeat) return repeat;
  // What the family saw: the group's terms at that version, and the training's time and place (S2).
  if (Number(body?.groupVersion) !== group.version) return reply(409, { status: 409, code: 'TERMS_CHANGED', message: 'The club changed this group’s first visits. Check them and book again.', currentVersion: group.version });
  if (group.gender !== 'ANY' && child.gender !== group.gender) return reply(409, { status: 409, code: 'INELIGIBLE', message: child.gender ? 'This group is for another gender category.' : 'Supply the player’s declared gender category or ask admissions to review eligibility.' });
  const shown = offered(group).find(s => s.reference === body?.session);
  const event = shown && W.events.find(e => e.id === shown.sessionId && e.squadId === group.squadId);
  if (!event) return reply(409, { status: 409, code: 'SESSION_FULL', message: 'This training has no first-visit place left. Choose another.' });
  if (shown.startsAt !== body?.startsAt || shown.endsAt !== body?.endsAt || shown.place !== body?.place) return reply(409, { status: 409, code: 'SESSION_CHANGED', message: `This training changed: now ${shown.place}. Check it and book again.` });
  const parent = V.account(V.viewerId(headers))?.fullName ?? W.me.fullName, visits = visitsOf(group), id = C.nextId() + 4000, now = C.nowIso(), reserved = clearance(group);
  const session = { id: id * 10 + 1, version: 1, status: reserved ? 'INVITED' : 'CONFIRMED', introductionPermission: permission(reserved), title: event.title, startsAt: event.start.toISOString(), endsAt: event.end.toISOString(), timezone: 'Asia/Tbilisi',
    location: { name: place(event), address: group.location.address, latitude: group.location.latitude, longitude: group.location.longitude }, contact: C.name(W.squadById(group.squadId)?.headCoachId ?? W.ME_ID),
    preparation: 'Trainers or boots, shin pads and water. Come ten minutes early.', cost: free(visits) ? 'Free' : `${visits.fee} ${visits.currency}`, capacity: visits.places, responseDeadline: event.start.toISOString(),
    squadSessionId: event.id, noRegularPlaceGuaranteed: true, emergencyContact: body?.phone ? String(body.phone) : '+995 555 12 34 56', bookedByFamily: true };
  const item = { id, version: 1, requestId: body.requestId, firstVisit: true, playerId: child.id, playerName: child.name, dateOfBirth: child.dateOfBirth, organizationId: group.organizationId, organizationName: group.organizationName, clubId: group.clubId,
    groupId: group.id, groupName: group.name, intake: group.intake, method: group.method, stage: reserved ? 'ARRANGING_PARTICIPATION' : 'INTRODUCTION_ASSESSMENT', responsible: { id: W.ME_ID, name: W.me.fullName },
    nextAction: reserved ? { code: 'RECORD_PERMISSION', owner: 'CLUB', label: 'The club records the current club’s permission', dueAt: session.startsAt } : { code: 'ATTEND_INTRODUCTION', owner: 'FAMILY', label: 'Come to the first visit', dueAt: session.startsAt },
    requirements: [], sessions: [session], offer: null, enrollment: null,
    history: [{ id: id * 10 + 2, action: reserved ? 'FIRST_VISIT_RESERVED' : 'FIRST_VISIT_BOOKED', message: null, actorName: parent, createdAt: now }], actions: ['MESSAGE', 'WITHDRAW'], primaryAffiliation: null, previousCaseId: null, submittedAt: now, updatedAt: now, assessments: [], siblingConstraint: null };
  C.admissionCases.unshift(item);
  // The squad's staff see the visitor on the session (the week board's pink mark, the register).
  event.introductory_visitors = [...(event.introductory_visitors ?? []), { participationId: session.id, caseId: id, playerId: child.id, caseVersion: 1, participationVersion: 1, name: child.name, status: session.status,
    permissionStatus: reserved ? 'PENDING' : 'CURRENT', emergencyContact: session.emergencyContact, canRecord: false, firstVisit: true }];
  return { __created: true, ...item };
});

// The card's own versioned update (JoiningService.saveIdentity): here only what booking asks, a declared gender (S9).
const identityOf = child => ({ playerId: child.id, version: child.identityVersion ?? 1, fullName: child.name, dateOfBirth: child.dateOfBirth, gender: child.gender ?? null, photoUrl: W.personById(child.id)?.avatarUrl ?? null,
  positions: child.positions ?? [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true });
put('/joining/players/:pid', ({ params, body, headers }) => {
  const child = familyOf(headers)?.find(c => c.id === Number(params.pid));
  if (!child) return undefined;
  if (body?.requestId && child.identityRequest === body.requestId) return identityOf(child);
  if (Number(body?.expectedVersion) !== (child.identityVersion ?? 1)) return reply(409, { status: 409, code: 'STALE_VERSION', message: 'These details changed. Check them and save again.' });
  if (body?.gender && !['MALE', 'FEMALE'].includes(body.gender)) return reply(400, { status: 400, code: 'INVALID_GENDER', message: 'Choose a declared gender or leave it unset.' });
  child.gender = body?.gender ?? null; child.identityVersion = (child.identityVersion ?? 1) + 1; child.identityRequest = body?.requestId;
  const person = W.personById(child.id); if (person) person.gender = child.gender;
  return identityOf(child);
});

// Want to join: the family's own request to one of the squad's groups is a GROUP row, a booked first visit a VISIT row.
const caseRows = squad => C.admissionCases.filter(c => c.firstVisit && ['INTRODUCTION_ASSESSMENT', 'ARRANGING_PARTICIPATION'].includes(c.stage) && F.groupById(c.groupId)?.squadId === squad.id);
get('/squad-communication/:id/join-requests', async req => {
  if (req.headers[PASS]) return undefined;
  const squad = W.squadById(Number(req.params.id));
  const result = await passOn(req);
  if (!squad || !result || result.status !== 200 || !Array.isArray(result.body)) return result ? reply(result.status, result.body, result.headers) : undefined;
  const groups = F.admissionGroups.filter(g => g.squadId === squad.id).map(g => ({ id: g.id, version: g.version, name: g.name, method: g.method }));
  const rows = result.body.map(row => row.source === 'ENQUIRY' && row.caseId ? { ...row, source: 'GROUP', groups: groups.filter(g => g.id === C.admissionCases.find(c => c.id === row.caseId)?.groupId) } : row);
  const visits = caseRows(squad).map(c => ({ id: c.id, version: c.version, source: 'VISIT', playerId: c.playerId, childName: c.playerName, birthYear: Number(String(c.dateOfBirth).slice(0, 4)) || null,
    guardianName: c.history[0]?.actorName ?? null, message: null, createdAt: c.submittedAt, caseId: c.id, destination: `/clubs/${squad.clubId}/workspace?tab=admissions&caseId=${c.id}`,
    groups: groups.filter(g => g.id === c.groupId), setup: { canConfigure: true, destination: null }, possibleDuplicateOf: null,
    visit: { startsAt: c.sessions[0].startsAt, endsAt: c.sessions[0].endsAt, place: c.sessions[0].location.name, status: c.sessions[0].status } }));
  return [...visits, ...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
});

post('/squad-communication/:id/join-requests/cases/:cid', ({ params, body, headers }) => {
  const squad = W.squadById(Number(params.id));
  if (!squad || !squadAccess(squad, headers)?.canManage) return reply(403, { status: 403, message: 'Only the squad staff decide requests.' });
  const item = C.admissionCases.find(c => c.id === Number(params.cid) && F.groupById(c.groupId)?.squadId === squad.id);
  if (!item) return reply(404, { status: 404, message: 'This request is not this squad’s.' });
  if (body?.action === 'REVIEW') return reply(409, { status: 409, code: 'OPEN_THE_REQUEST', message: 'Open the request to invite the family to a session.' });
  // A retried answer gets its own outcome back, before a different later answer is refused (S8).
  if (item.decision && body?.requestId === item.decision.requestId) return item.decision.outcome;
  // Accept offers the group's terms as the coach saw them (S11).
  if (body?.action === 'APPROVE' && (Number(body?.groupId) !== item.groupId || Number(body?.groupVersion) !== F.groupById(item.groupId)?.version))
    return reply(409, { status: 409, code: 'GROUP_CHANGED', message: 'The group changed since you looked. Check it and answer again.' });
  if (!['REQUEST_RECEIVED', 'INTRODUCTION_ASSESSMENT', 'ARRANGING_PARTICIPATION'].includes(item.stage))
    return reply(409, { status: 409, code: 'ALREADY_ANSWERED', message: `${item.answeredBy ?? 'Someone'} already answered this request${item.answeredAt ? ` at ${item.answeredAt}` : ''}.` });
  const accept = body?.action === 'APPROVE';
  item.stage = accept ? 'OFFERED' : 'CLOSED'; item.version += 1; item.updatedAt = C.nowIso();
  item.answeredBy = W.personById(V.viewerId(headers))?.fullName ?? W.me.fullName;
  item.answeredAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hour12: false }) + ' on ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'long' });
  item.nextAction = accept ? { code: 'ACCEPT_OFFER', owner: 'FAMILY', label: 'Accept the place', dueAt: null } : { code: 'CLOSED', owner: 'NONE', label: 'Closed', dueAt: null };
  const outcome = { inquiryId: item.id, outcome: accept ? 'PLACE_OFFERED' : 'DECLINED', destination: `/clubs/${squad.clubId}/workspace?tab=admissions&caseId=${item.id}` };
  item.decision = { requestId: body?.requestId, outcome };
  return outcome;
});

// A family's child called up for a connected fixture (MatchArrangementService.attendance): the call-up with its
// revision, and the answer, which names it and the match's revision (S6). Staff and others pass on.
const callUps = new Map(); // `${eventId}:${squadId}:${playerId}` -> { response, revision }
const callUp = (eventId, squadId, playerId) => callUps.get(`${eventId}:${squadId}:${playerId}`) ?? { response: 'UNANSWERED', revision: 1 };
get('/match-arrangements/:id/participants', ({ params, headers }) => {
  const family = familyOf(headers), l = F.listingById(params.id);
  if (!family?.length || !l) return undefined;
  const teams = [l.hostSquadId, l.opponentSquadId].filter(Boolean).map(id => W.squadById(id)).filter(Boolean).map(s => ({ squadId: s.id, squadName: s.name, canManage: false,
    players: family.filter(c => s.playerIds.includes(c.id)).map(c => ({ id: c.id, name: c.name, selected: true, ...callUp(l.id, s.id, c.id), canRespond: true })) })).filter(team => team.players.length);
  return teams.length ? teams : undefined;
});
post('/match-arrangements/:id/squads/:sid/attendance', ({ params, body, headers }) => {
  const family = familyOf(headers), l = F.listingById(params.id), squad = W.squadById(Number(params.sid));
  const child = family?.find(c => c.id === Number(body?.playerId) && squad?.playerIds.includes(c.id));
  if (!child || !l) return undefined;
  if (Number(body?.matchRevision) !== l.revision) return reply(409, { status: 409, message: 'The match changed. Review it before replying.' });
  const current = callUp(l.id, squad.id, child.id);
  if (Number(body?.revision) !== current.revision) return reply(409, { status: 409, message: 'The invitation changed. Review it before replying.' });
  if (!['GOING', 'NOT_GOING'].includes(body?.response)) return reply(409, { status: 409, message: 'Attendance replies need an agreed, upcoming fixture.' });
  callUps.set(`${l.id}:${squad.id}:${child.id}`, { response: body.response, revision: current.revision + 1 });
  return null;
});

// The club map's real filters: within `km` of "You" (`lat`, `lng`), training on `day` (MON … SUN), nearest first. A club
// with no squads in the sandbox trains on days of its own, so the filter has something to keep.
const metres = (a, b) => { const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371000; };
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const daysOf = clubId => { const own = W.squads.filter(s => s.clubId === clubId).flatMap(s => s.trainingDays ?? []).map(d => d === 0 ? 7 : d); return own.length ? own : [1 + clubId % 5, 1 + (clubId + 2) % 5, ...(clubId % 2 ? [6] : [])]; };
const trainsOn = (clubId, days) => daysOf(clubId).some(d => days.includes(d));
get('/clubs', async req => {
  if (req.headers[PASS]) return undefined;
  const lat = Number(req.query.get('lat')), lng = Number(req.query.get('lng')), km = Number(req.query.get('km'));
  const days = req.query.getAll('day').flatMap(d => d.split(',')).map(d => WEEKDAYS.indexOf(d.toUpperCase()) + 1).filter(d => d > 0);
  const near = req.query.has('lat') && req.query.has('lng') && Number.isFinite(lat) && Number.isFinite(lng);
  if (!near && !days.length && req.query.get('sort') !== 'NEAREST') return undefined;
  // Ask the club domain for the whole list (no paging), then narrow and page it here.
  const query = new URLSearchParams(req.query); ['lat', 'lng', 'km', 'day', 'page', 'size'].forEach(key => query.delete(key)); if (query.get('sort') === 'NEAREST') query.delete('sort');
  const result = await passOn({ ...req, query });
  if (!result || result.status !== 200 || !Array.isArray(result.body)) return result ? reply(result.status, result.body, result.headers) : undefined;
  const at = c => c.latitude != null && c.longitude != null ? { lat: Number(c.latitude), lng: Number(c.longitude) } : W.clubById(c.id)?.lat != null ? { lat: W.clubById(c.id).lat, lng: W.clubById(c.id).lng } : null;
  const distance = c => near && at(c) ? metres({ lat, lng }, at(c)) : null;
  let items = result.body.filter(c => (!near || !km || (distance(c) ?? Infinity) <= km * 1000) && (!days.length || trainsOn(c.id, days)));
  if (near && (req.query.get('sort') ?? 'NEAREST') === 'NEAREST') items = [...items].sort((a, b) => (distance(a) ?? Infinity) - (distance(b) ?? Infinity));
  if (!req.query.has('page') && !req.query.has('size')) return items;
  const p = Math.max(0, Number(req.query.get('page') ?? 0) || 0), size = Math.max(1, Number(req.query.get('size') ?? 12) || 12);
  return { content: items.slice(p * size, p * size + size), pageNumber: p, pageSize: size, totalElements: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)), number: p, size, last: (p + 1) * size >= items.length };
});
