// Synthetic API: families (see ../world-family.mjs). Two kinds of parent are answered here:
//   * Luka in parent mode (/__mode/parent, the family cookie): Saba and Nino, a second guardian, a statement;
//   * a person who signed up in the sandbox and added a child themself (kept on their account).
// Registered before newcomer.mjs; for anyone else (and a new person with no child yet) every handler passes on.
import { get, post, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import { FAMILY, SECOND_GUARDIAN, statements, familyRequest, familyOf, newChildId } from '../world-family.mjs';

/** The signed-in parent: their id, name and birth date, and whether the second guardian (parent mode only) exists. */
const parentOf = headers => {
  if (familyRequest(headers)) return { id: W.ME_ID, name: W.me.fullName, dateOfBirth: '1988-04-12', gender: 'MALE', luka: true };
  const account = V.account(V.viewerId(headers));
  return account ? { id: account.id, name: account.fullName, dateOfBirth: account.dateOfBirth ?? null, gender: null, luka: false } : null;
};
/** A family with at least one child; a new person with none yet is left to newcomer.mjs. */
const withChildren = headers => { const family = familyOf(headers); return family?.length ? family : null; };
const casesOf = child => C.admissionCases.filter(c => c.playerId === child.id);
const participant = child => ({ id: child.id, name: child.name, dateOfBirth: child.dateOfBirth, minor: true, guardian: true, provenance: 'GUARDIAN', gender: child.gender, restriction: null });
const squadsOf = child => W.squads.filter(s => s.playerIds.includes(child.id));
const clubsOf = child => [...new Set(squadsOf(child).map(s => s.clubId))].map(clubId => ({
  clubId, clubName: W.clubById(clubId).name, cardId: child.id, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED',
  squads: squadsOf(child).filter(s => s.clubId === clubId).map(s => ({ id: s.id, name: s.name })),
  squadNames: squadsOf(child).filter(s => s.clubId === clubId).map(s => s.name),
  fees: statements.get(`${child.id}:${clubId}`) ?? null,
}));

// What a parent changes in Family connections during a session (invitations sent, a guardian removed, codes).
const state = { invitations: [], revoked: new Set(), codes: [] };
let nextFamilyId = 99001;
const secondGuardian = (parent, child) => parent.luka && !state.revoked.has(child.id);

get('/admissions/home', ({ headers }) => {
  const family = withChildren(headers), parent = parentOf(headers);
  if (!family || !parent) return undefined;
  const self = { id: parent.id, name: parent.name, dateOfBirth: parent.dateOfBirth, minor: false, guardian: false, provenance: 'SELF', gender: parent.gender, restriction: null };
  return { participants: [self, ...family.map(participant)], cases: family.flatMap(casesOf), invitations: [], selfCardNeedsDetails: !parent.dateOfBirth, inquiries: [] };
});

get('/joining/children', ({ headers }) => {
  const family = withChildren(headers), parent = parentOf(headers);
  if (!family || !parent) return undefined;
  return { children: family.map(child => ({
    playerId: child.id, clubs: clubsOf(child), cases: casesOf(child), inquiries: [],
    identity: { playerId: child.id, version: 1, fullName: child.name, dateOfBirth: child.dateOfBirth, gender: child.gender, photoUrl: W.personById(child.id)?.avatarUrl ?? null, positions: child.positions ?? [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true },
    guardians: [{ id: parent.id, name: parent.name, self: true }, ...(secondGuardian(parent, child) ? [{ id: SECOND_GUARDIAN.id, name: SECOND_GUARDIAN.name, self: false }] : [])],
  })) };
});

// Family connections: the guardians on every child, the clubs that hold a card. A new person with no child gets an
// empty family (the screen then says how to start), never an error.
get('/family', ({ headers }) => {
  const parent = parentOf(headers), family = familyOf(headers);
  if (!parent || (!family && parent.luka)) return undefined;
  return {
    children: (family ?? []).map(child => ({
      childId: child.id, name: child.name, birthYear: Number(child.dateOfBirth.slice(0, 4)), registered: false, activationEligible: false,
      guardians: [
        { id: child.id * 10 + 1, guardianId: parent.id, name: parent.name, provenance: 'PARENT_CREATED', canRevoke: false, self: true },
        ...(secondGuardian(parent, child) ? [{ id: child.id * 10 + 2, guardianId: SECOND_GUARDIAN.id, name: SECOND_GUARDIAN.name, provenance: 'GUARDIAN_INVITATION', canRevoke: true, self: false }] : []),
      ],
      clubs: clubsOf(child).map(club => ({ id: club.clubId * 1000 + child.id, clubId: club.clubId, name: club.clubName, status: 'ACTIVE', consent: 'CONFIRMED' })),
      squads: squadsOf(child).map(s => ({ id: s.id, name: s.name })), codes: state.codes.filter(c => c.playerId === child.id).map(({ id, expiresAt }) => ({ id, expiresAt })), history: [],
    })),
    invitations: state.invitations.filter(i => i.parentId === parent.id), consentRequests: [], consentHistory: [], ended: [],
  };
});

// A new child card: private to the family, no club, no account. A new person's first child gives them Parent Hub.
post('/family/children', ({ headers, body }) => {
  const family = familyOf(headers, true);
  if (!family) return undefined;
  const fullName = String(body?.fullName ?? '').trim(), dateOfBirth = String(body?.dateOfBirth ?? '');
  if (!fullName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return reply(400, { status: 400, message: 'Add the child’s name and date of birth.' });
  if (body?.responsible !== true) return reply(400, { status: 400, message: 'Confirm that you are the child’s parent or legal guardian.' });
  const repeat = family.find(child => child.requestId && child.requestId === body.requestId);
  if (repeat) return { childId: repeat.id, name: repeat.name };
  const child = { id: newChildId(), name: fullName, dateOfBirth, gender: null, positions: [], requestId: body.requestId ?? null };
  family.push(child);
  if (!W.personById(child.id)) { const [first, ...rest] = fullName.split(/\s+/); W.people.push({ id: child.id, firstName: first, lastName: rest.join(' '), fullName, username: null, gender: 'MALE', role: 'PLAYER', birthYear: Number(dateOfBirth.slice(0, 4)), city: 'Tbilisi', clubId: null, position: null, headline: null, avatarUrl: null }); }
  return { __created: true, childId: child.id, name: child.name };
});

// A family asks to join a group (or takes a direct place): the request lands in the club's admissions for the coach
// to approve. Neither side adds a child alone. A message containing "#fail409" answers as if the group changed
// meanwhile, so the kept explanation and answers after a refresh can be checked (F05).
const STAGE = { REQUEST: ['REQUEST_RECEIVED', 'CLUB_REVIEW', 'CLUB', 'The coach reviews the request'], WAITLIST: ['WAITLIST', 'WAIT_FOR_PLACE', 'NONE', 'Waiting for a place in the group'], DIRECT_ENROLL: ['COMPLETING_ENROLLMENT', 'COMPLETE_REQUIREMENTS', 'CLUB', 'The club confirms the place'] };
post('/admissions/cases', ({ headers, body }) => {
  const family = withChildren(headers), parent = parentOf(headers);
  if (!family || !parent) return undefined;
  const group = F.groupById(body?.opportunityId), child = family.find(c => c.id === Number(body?.playerId));
  if (!group || !child) return reply(404, { status: 404, message: 'This group or child is unavailable.' });
  if (String(body?.message ?? '').includes('#fail409') || Number(body?.opportunityVersion) !== group.version) return reply(409, { status: 409, code: 'STALE_VERSION', message: 'The group changed. Review the new details before sending.' });
  const repeat = C.admissionCases.find(c => c.requestId && c.requestId === body.requestId);
  if (repeat) return repeat;
  const [stage, code, owner, label] = STAGE[body.intent] ?? STAGE.REQUEST, id = C.nextId() + 3000, now = C.nowIso();
  const item = { id, version: 1, requestId: body.requestId, playerId: child.id, playerName: child.name, dateOfBirth: child.dateOfBirth, organizationId: group.organizationId, organizationName: group.organizationName, clubId: group.clubId, groupId: group.id, groupName: group.name,
    intake: group.intake, method: group.method, stage, responsible: group.responsibleUserId ? { id: group.responsibleUserId, name: C.name(group.responsibleUserId) } : null, nextAction: { code, owner, label, dueAt: null }, requirements: [], sessions: [], offer: null, enrollment: null,
    history: [{ id: id * 10 + 1, action: 'SUBMITTED', message: body.message ?? null, actorName: parent.name, createdAt: now }], actions: ['MESSAGE', 'WITHDRAW'], primaryAffiliation: null, previousCaseId: null, submittedAt: now, updatedAt: now, assessments: [], siblingConstraint: body.siblingConstraint ?? null };
  C.admissionCases.unshift(item);
  return { __created: true, ...item };
});

// Family connections' actions, so every button there answers in the sandbox.
const family = handler => req => { const parent = parentOf(req.headers), children = familyOf(req.headers); return parent && children ? handler(req, parent, children) : undefined; };
const ok = () => reply(204);
post('/family/children/:cid/invitations', family(({ params, body }, parent, children) => {
  const child = children.find(c => c.id === Number(params.cid)); const email = String(body?.email ?? '').trim();
  if (!child || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(400, { status: 400, message: 'Enter the other adult’s email address.' });
  state.invitations.push({ id: nextFamilyId++, parentId: parent.id, kind: body?.kind === 'TRANSFER' ? 'TRANSFER' : 'ADDITIONAL', status: 'PENDING', sent: true, childName: child.name, otherName: email, canRespond: false, canCancel: true, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
  return ok();
}));
post('/family/invitations/:id/cancel', family(({ params }) => { const i = state.invitations.find(x => x.id === Number(params.id)); if (i) { i.status = 'CANCELLED'; i.canCancel = false; } return ok(); }));
post('/family/invitations/:id/respond', family(() => ok()));
post('/family/children/:cid/guardians/:gid/revoke', family(({ params }) => { state.revoked.add(Number(params.cid)); return ok(); }));
post('/family/children/:cid/clubs/:clubId/depart', family(() => reply(409, { status: 409, message: 'Leaving a club is confirmed with the club in the sandbox; nothing was changed.' })));
post('/family/consents/:id', family(() => ok()));
post('/family/children/:cid/activation', family(() => ok()));
post('/joining/players/:pid/link-code', family(({ params }, _parent, children) => {
  if (!children.some(c => c.id === Number(params.pid))) return reply(403, { status: 403, message: 'You can only share a code for a child you look after.' });
  const code = { id: nextFamilyId++, playerId: Number(params.pid), code: String(100000 + (Number(params.pid) * 7919 + nextFamilyId) % 900000), expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(), clubId: null };
  state.codes.push(code);
  return { __created: true, id: code.id, code: code.code, expiresAt: code.expiresAt, clubId: null };
}));
post('/family/enrollment-codes/:id/cancel', family(({ params }) => { const at = state.codes.findIndex(c => c.id === Number(params.id)); if (at >= 0) state.codes.splice(at, 1); return ok(); }));
