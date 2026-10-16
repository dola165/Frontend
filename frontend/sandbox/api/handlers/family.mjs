// Synthetic API: the coach as a parent (see ../world-family.mjs). Registered first so these answers
// replace the coach-only ones only for a browser with the family cookie; otherwise they pass on.
// In a browser: open /__mode/parent on the sandbox API, or set document.cookie = 'gk-sandbox-family=1; path=/'.
import { get, post, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as F from '../world-football.mjs';
import { FAMILY, SECOND_GUARDIAN, statements, familyRequest } from '../world-family.mjs';

const casesOf = child => C.admissionCases.filter(c => c.playerId === child.id);
const participant = child => ({ id: child.id, name: child.name, dateOfBirth: child.dateOfBirth, minor: true, guardian: true, provenance: 'GUARDIAN', gender: child.gender, restriction: null });
const self = { id: W.ME_ID, name: W.me.fullName, dateOfBirth: '1988-04-12', minor: false, guardian: false, provenance: 'SELF', gender: 'MALE', restriction: null };
const squadsOf = child => W.squads.filter(s => s.playerIds.includes(child.id));
const clubsOf = child => [...new Set(squadsOf(child).map(s => s.clubId))].map(clubId => ({
  clubId, clubName: W.clubById(clubId).name, cardId: child.id, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED',
  squads: squadsOf(child).filter(s => s.clubId === clubId).map(s => ({ id: s.id, name: s.name })),
  squadNames: squadsOf(child).filter(s => s.clubId === clubId).map(s => s.name),
  fees: statements.get(`${child.id}:${clubId}`) ?? null,
}));

get('/admissions/home', ({ headers }) => familyRequest(headers)
  ? { participants: [self, ...FAMILY.map(participant)], cases: FAMILY.flatMap(casesOf), invitations: [], selfCardNeedsDetails: false, inquiries: [] }
  : undefined);

get('/joining/children', ({ headers }) => familyRequest(headers)
  ? { children: FAMILY.map(child => ({
      playerId: child.id, clubs: clubsOf(child), cases: casesOf(child), inquiries: [],
      identity: { playerId: child.id, version: 1, fullName: child.name, dateOfBirth: child.dateOfBirth, gender: child.gender, photoUrl: W.personById(child.id)?.avatarUrl ?? null, positions: child.positions ?? [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true },
      guardians: [{ id: W.ME_ID, name: W.me.fullName, self: true }, { id: SECOND_GUARDIAN.id, name: SECOND_GUARDIAN.name, self: false }],
    })) }
  : undefined);

// Family connections: both guardians on every child, the clubs that hold a card.
get('/family', ({ headers }) => familyRequest(headers) ? {
  children: FAMILY.map(child => ({
    childId: child.id, name: child.name, birthYear: Number(child.dateOfBirth.slice(0, 4)), registered: false, activationEligible: false,
    guardians: [
      { id: child.id * 10 + 1, guardianId: W.ME_ID, name: W.me.fullName, provenance: 'CREATED', canRevoke: false, self: true },
      { id: child.id * 10 + 2, guardianId: SECOND_GUARDIAN.id, name: SECOND_GUARDIAN.name, provenance: 'INVITED', canRevoke: true, self: false },
    ],
    clubs: clubsOf(child).map(club => ({ id: club.clubId * 1000 + child.id, clubId: club.clubId, name: club.clubName, status: 'ACTIVE', consent: 'CONFIRMED' })),
    squads: squadsOf(child).map(s => ({ id: s.id, name: s.name })), codes: [], history: [],
  })),
  invitations: [], consentRequests: [], consentHistory: [], ended: [],
} : undefined);

// A new child card: private to the family, no club, no account.
post('/family/children', ({ headers, body }) => {
  if (!familyRequest(headers)) return undefined;
  const fullName = String(body?.fullName ?? '').trim(), dateOfBirth = String(body?.dateOfBirth ?? '');
  if (!fullName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || body?.responsible !== true) return reply(400, { status: 400, message: 'Add the child’s name and date of birth.' });
  const repeat = FAMILY.find(child => child.requestId && child.requestId === body.requestId);
  if (repeat) return { childId: repeat.id, name: repeat.name };
  const child = { id: 9103 + FAMILY.length, name: fullName, dateOfBirth, gender: null, positions: [], requestId: body.requestId ?? null };
  FAMILY.push(child);
  return { __created: true, childId: child.id, name: child.name };
});

// A family asks to join a group (or takes a direct place): the request lands in the club's admissions for the coach
// to approve. Neither side adds a child alone. A message containing "#fail409" answers as if the group changed
// meanwhile, so the kept explanation and answers after a refresh can be checked (F05).
const STAGE = { REQUEST: ['REQUEST_RECEIVED', 'CLUB_REVIEW', 'CLUB', 'The coach reviews the request'], WAITLIST: ['WAITLIST', 'WAIT_FOR_PLACE', 'NONE', 'Waiting for a place in the group'], DIRECT_ENROLL: ['COMPLETING_ENROLLMENT', 'COMPLETE_REQUIREMENTS', 'CLUB', 'The club confirms the place'] };
post('/admissions/cases', ({ headers, body }) => {
  if (!familyRequest(headers)) return undefined;
  const group = F.groupById(body?.opportunityId), child = FAMILY.find(c => c.id === Number(body?.playerId));
  if (!group || !child) return reply(404, { status: 404, message: 'This group or child is unavailable.' });
  if (String(body?.message ?? '').includes('#fail409') || Number(body?.opportunityVersion) !== group.version) return reply(409, { status: 409, code: 'STALE_VERSION', message: 'The group changed. Review the new details before sending.' });
  const repeat = C.admissionCases.find(c => c.requestId && c.requestId === body.requestId);
  if (repeat) return repeat;
  const [stage, code, owner, label] = STAGE[body.intent] ?? STAGE.REQUEST, id = C.nextId() + 3000, now = C.nowIso();
  const item = { id, version: 1, requestId: body.requestId, playerId: child.id, playerName: child.name, dateOfBirth: child.dateOfBirth, organizationId: group.organizationId, organizationName: group.organizationName, clubId: group.clubId, groupId: group.id, groupName: group.name,
    intake: group.intake, method: group.method, stage, responsible: group.responsibleUserId ? { id: group.responsibleUserId, name: C.name(group.responsibleUserId) } : null, nextAction: { code, owner, label, dueAt: null }, requirements: [], sessions: [], offer: null, enrollment: null,
    history: [{ id: id * 10 + 1, action: 'SUBMITTED', message: body.message ?? null, actorName: W.me.fullName, createdAt: now }], actions: ['MESSAGE', 'WITHDRAW'], primaryAffiliation: null, previousCaseId: null, submittedAt: now, updatedAt: now, assessments: [], siblingConstraint: body.siblingConstraint ?? null };
  C.admissionCases.unshift(item);
  return { __created: true, ...item };
});
