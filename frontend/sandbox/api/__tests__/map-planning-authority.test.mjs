import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as P from '../pages-data.mjs';
import * as F from '../world-football.mjs';
import { stateFor } from '../handlers/workspace-context.mjs';

const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
const headers = (actor, stale = false) => ({ cookie: `gk-sandbox-user=${actor.id}${stale ? '; gk-sandbox-family=1; gk-sandbox-persona=analyst' : ''}` });
const call = (method, path, actor, body, query = {}, stale = false) => handleApi({ method, path, body, headers: headers(actor, stale), query: new URLSearchParams(query) });
const context = async (actor, stale = false) => (await call('GET', '/map/plans/context', actor, undefined, {}, stale)).body;
async function club(name) {
  const owner = account(`${name} owner`);
  const created = await call('POST', '/organizations/setup', owner, { requestId: randomUUID(), pageKind: 'CLUB', displayName: name, location: { city: 'Tbilisi' } });
  assert.equal(created.status, 200);
  const id = created.body.clubId;
  assert.equal((await call('PUT', `/clubs/${id}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }, { ageGroup: 'U16', gender: 'MIXED' }] } })).status, 200);
  const squads = W.squads.filter(squad => squad.clubId === id);
  for (const squad of squads) for (let index = 0; index < 2; index++) {
    const person = { id: W.newId(), fullName: `${name} player ${squad.id}-${index}`, birthYear: 2013 };
    W.people.push(person); squad.playerIds.push(person.id);
  }
  return { id, owner, squads, page: P.clubPage(id), state: stateFor(id) };
}
function draft(squad, title = 'Private journey') {
  const startsAt = new Date(Date.now() + 86400000).toISOString(), endsAt = new Date(Date.now() + 90000000).toISOString();
  return { title, timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 0, startsAt, endsAt, destination: 'Our ground', meetingPoint: 'Club entrance', collectionPoint: 'Club entrance',
    supervisionContact: 'Coaching team', familyMessage: 'Shared first version', privateNotes: 'Staff-only working notes', participants: [squad.playerIds[0]], places: [],
    activities: [{ key: 'own-activity', title: 'Training day', kind: 'ACTIVITY', startsAt, endsAt, placeKey: null, eventId: null, sessionId: null }], arrangements: [], staff: [], vehicles: [], bring: [] };
}
async function create(c, squad = c.squads[0], actor = c.owner, value = draft(squad), requestId = randomUUID()) {
  const result = await call('POST', '/map/plans', actor, { clubId: c.id, squadId: squad.id, requestId, draft: value });
  assert.equal(result.status, 201);
  return result.body;
}
const appointment = (c, actor, squads, permissions, extra = {}) => {
  const item = { id: W.newId(), club_id: c.id, user_id: actor.id, status: 'ACTIVE', starts_on: '2000-01-01', ends_on: null,
    squad_ids: squads.map(squad => squad.id), club_wide: !squads.length, permissions, ...extra };
  c.state.appointments.push(item); return item;
};
const finance = (c, squad) => {
  const record = { id: W.newId(), club_id: c.id, squad_id: squad.id, module: 'FINANCE', title: 'Scoped budget', kind: 'BUDGET', status: 'APPROVED', data: { amount: 1, currency: 'GEL' } };
  c.state.records.push(record); return record;
};

test('unrelated actors and stale demo cookies expose no context, private plans or staff journey rows and cannot mutate', async () => {
  const c = await club('Planning boundary'), plan = await create(c), outsider = account('Planning outsider');
  for (const stale of [false, true]) {
    assert.deepEqual(await context(outsider, stale), []);
    assert.equal((await call('GET', '/map/plans', outsider, undefined, { clubId: c.id }, stale)).status, 403);
    assert.equal((await call('GET', `/map/plans/${plan.id}`, outsider, undefined, {}, stale)).status, 403);
    assert.equal((await call('PUT', `/map/plans/${plan.id}`, outsider, { revision: plan.revision, draft: { ...plan.draft, title: 'Refused' } }, {}, stale)).status, 403);
    assert.equal((await call('POST', '/map/plans', outsider, { clubId: c.id, squadId: c.squads[0].id, requestId: randomUUID(), draft: plan.draft }, {}, stale)).status, 403);
    for (const action of ['publish', 'approve-budget', 'supplier', 'connect-trip']) assert.equal((await call('POST', `/map/plans/${plan.id}/${action}`, outsider, { revision: plan.revision }, {}, stale)).status, 403);
    assert.equal((await call('GET', `/journeys/squads/${c.squads[0].id}/preferences`, outsider, undefined, {}, stale)).status, 403);
    assert.equal((await call('PUT', `/journeys/squads/${c.squads[0].id}/preferences`, outsider, { revision: 0, preferences: {} }, {}, stale)).status, 403);
    assert.equal((await call('POST', '/journeys/from-fixture', outsider, { eventId: W.matches[0].id, clubId: c.id, squadId: c.squads[0].id }, {}, stale)).status, 403);
    assert.deepEqual((await call('GET', '/journeys/schedule', outsider, undefined, {}, stale)).body, []);
    assert.deepEqual((await call('GET', '/map/plans/family', outsider, undefined, {}, stale)).body, []);
  }
  assert.equal(F.planById(plan.id).title, plan.title);
});

test('current read/write and finance grants expose only their exact club and squad scopes', async () => {
  const c = await club('Scoped planning'), a = await create(c), b = await create(c, c.squads[1]), staff = account('Scoped planning reader');
  const grant = appointment(c, staff, [c.squads[0]], ['MATCHES:READ']);
  const fa = finance(c, c.squads[0]), fb = finance(c, c.squads[1]);
  const normalSession = { id: W.newId(), clubId: c.id, squadId: c.squads[0].id, type: 'TRAINING', title: 'Current scoped training',
    start: new Date(Date.now() + 86400000), end: new Date(Date.now() + 90000000), visibility: 'PRIVATE' };
  W.events.push(normalSession);
  let rows = await context(staff, true);
  assert.equal(rows.length, 1); assert.equal(rows[0].id, c.id);
  assert.deepEqual(rows[0].squads, [{ id: c.squads[0].id, name: c.squads[0].name, canEdit: false }]);
  assert.ok(rows[0].participants.every(person => person.squad_id === c.squads[0].id)); assert.deepEqual(rows[0].financeRecords, []);
  assert.ok(rows[0].sessions.some(session => session.id === normalSession.id), 'confirmed scoped planning read includes normal sessions');
  assert.deepEqual((await call('GET', '/map/plans', staff, undefined, { clubId: c.id })).body.map(plan => plan.id), [a.id]);
  assert.equal((await call('GET', `/map/plans/${a.id}`, staff)).body.rights.edit, false);
  assert.equal((await call('GET', `/map/plans/${b.id}`, staff)).status, 403);
  assert.equal((await call('PUT', `/map/plans/${a.id}`, staff, { revision: a.revision, draft: a.draft })).status, 403);
  grant.permissions.push('MATCHES:WRITE', 'FINANCE:READ'); appointment(c, staff, [c.squads[1]], ['FINANCE:READ']);
  rows = await context(staff);
  assert.deepEqual(rows[0].squads.map(squad => [squad.id, squad.canEdit]), [[c.squads[0].id, true], [c.squads[1].id, false]]);
  assert.deepEqual(rows[0].financeRecords.map(record => record.id), [fa.id, fb.id]);
  assert.ok(rows[0].financeRecords.every(record => !('data' in record)));
  assert.equal((await call('GET', `/map/plans/${b.id}`, staff)).body.rights.edit, false);
  assert.equal((await call('GET', `/journeys/squads/${c.squads[1].id}/preferences`, staff)).status, 403, 'finance-only planning read does not grant journey-preferences access');
  assert.equal((await call('POST', `/map/plans/${a.id}/approve-budget`, staff, { revision: a.revision })).status, 403);
  grant.status = 'ENDED';
  rows = await context(staff);
  assert.deepEqual(rows[0].squads.map(squad => squad.id), [c.squads[1].id]);
  assert.equal((await call('GET', `/map/plans/${a.id}`, staff)).status, 403);
});

test('confirmed legacy coaches can plan their own squad without gaining finance or publication authority', async () => {
  const c = await club('Coach planning'), coach = account('Confirmed squad coach'); c.squads[0].headCoachId = coach.id;
  const rows = await context(coach, true);
  assert.deepEqual(rows[0].squads.map(squad => [squad.id, squad.canEdit]), [[c.squads[0].id, true]]);
  const plan = await create(c, c.squads[0], coach);
  assert.equal(plan.rights.finance, false); assert.equal(plan.rights.publish, false);
  assert.equal((await call('POST', `/map/plans/${plan.id}/publish`, coach, { revision: plan.revision })).status, 403);
  assert.equal((await call('POST', `/map/plans/${plan.id}/supplier`, coach, { revision: plan.revision })).status, 403, 'editing alone does not grant travel supplier confirmation');
  c.squads[0].headCoachId = null;
  assert.deepEqual(await context(coach), []);
  assert.equal((await call('PUT', `/map/plans/${plan.id}`, coach, { revision: plan.revision, draft: plan.draft })).status, 403);
});

test('account eligibility and current appointment dates are rechecked instead of trusting role descriptions', async () => {
  const c = await club('Eligible planning'), person = account('Planning eligibility'); c.page.staff.set(person.id, 'COACH');
  appointment(c, person, [c.squads[0]], ['MATCHES:WRITE'], { status: 'INVITED' });
  appointment(c, person, [c.squads[0]], ['MATCHES:WRITE'], { ends_on: '2001-01-01' });
  appointment(c, person, [c.squads[0]], ['MATCHES:WRITE'], { starts_on: '2099-01-01' });
  assert.deepEqual(await context(person), []);
  const active = appointment(c, person, [c.squads[0]], ['MATCHES:WRITE']);
  assert.equal((await context(person)).length, 1);
  for (const patch of [{ emailVerified: false }, { accountState: 'SUSPENDED' }, { dateOfBirth: '2015-01-01' }]) {
    const before = { ...person }; Object.assign(person, patch); assert.deepEqual(await context(person), []);
    for (const key of Object.keys(patch)) { if (key in before) person[key] = before[key]; else delete person[key]; }
  }
  active.status = 'REVOKED'; assert.deepEqual(await context(person), []);
});

test('new creation has no seeded private data, replays by actor/request and rechecks revoked authority', async () => {
  const a = await club('First owned plan'), b = await club('Second owned plan'), requestId = randomUUID(), value = draft(a.squads[0], 'Our own first plan');
  const first = await create(a, a.squads[0], a.owner, value, requestId);
  assert.equal(first.club_id, a.id); assert.equal(first.created_by, a.owner.id); assert.deepEqual(first.draft, value);
  assert.deepEqual(first.suppliers, {}); assert.deepEqual(first.passengers, []); assert.equal(first.published_version, 0);
  const retry = await call('POST', '/map/plans', a.owner, { clubId: a.id, squadId: a.squads[0].id, requestId, draft: value });
  assert.equal(retry.body.id, first.id);
  const other = await create(b, b.squads[0], b.owner, draft(b.squads[0]), requestId);
  assert.notEqual(other.id, first.id);
  assert.equal((await call('POST', '/map/plans', a.owner, { clubId: a.id, squadId: a.squads[1].id, requestId, draft: draft(a.squads[1]) })).status, 409);
  a.page.ownerId = null; a.page.staff.delete(a.owner.id);
  for (const squad of a.squads) if (squad.headCoachId === a.owner.id) squad.headCoachId = null;
  assert.equal((await call('POST', '/map/plans', a.owner, { clubId: a.id, squadId: a.squads[0].id, requestId, draft: value })).status, 403);
});

test('private edits require current revisions and cannot borrow another squad’s participants or finance links', async () => {
  const c = await club('Plan write boundary'), plan = await create(c), reviewer = account('Independent finance reviewer');
  assert.equal((await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 0, draft: plan.draft })).status, 409);
  assert.equal((await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 1, draft: { ...plan.draft, participants: [c.squads[1].playerIds[0]] } })).status, 400);
  const foreign = finance(c, c.squads[1]);
  assert.equal((await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 1, draft: { ...plan.draft, arrangements: [{ key: 'foreign', financeRecordId: foreign.id }] } })).status, 403);
  const saved = await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 1, draft: { ...plan.draft, title: 'Updated within scope' } });
  assert.equal(saved.status, 200); assert.equal(saved.body.revision, 2);
  assert.equal((await call('POST', `/map/plans/${plan.id}/publish`, c.owner, { revision: 1 })).status, 409);
  assert.equal((await call('POST', `/map/plans/${plan.id}/approve-budget`, c.owner, { revision: 2 })).status, 409);
  appointment(c, reviewer, [c.squads[0]], ['FINANCE:WRITE']);
  const approved = await call('POST', `/map/plans/${plan.id}/approve-budget`, reviewer, { revision: 2 });
  assert.equal(approved.status, 200); assert.equal(approved.body.approvedBy, reviewer.id);
  const renamed = await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 3, draft: { ...approved.body.draft, title: 'Same approved costs' } });
  assert.equal(renamed.body.budgetApproved, true, 'a name edit retains the unchanged financial review');
  const costChange = await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 4, draft: { ...renamed.body.draft, arrangements: [{ key: 'coach', amountMinor: 100 }] } });
  assert.equal(costChange.body.totalMinor, 100); assert.equal(costChange.body.budgetApproved, false);
  assert.equal((await call('POST', `/map/plans/${plan.id}/approve-budget`, reviewer, { revision: 5 })).status, 409, 'an independent reviewer cannot approve an estimate above the budget');
  const rebudgeted = await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 5, draft: { ...costChange.body.draft, budgetMinor: 100 } });
  assert.equal(rebudgeted.status, 200);
  assert.equal((await call('POST', `/map/plans/${plan.id}/approve-budget`, reviewer, { revision: 6 })).body.budgetApproved, true);
});

test('guardians receive only their frozen published children and cannot see drafts or reply for another family', async () => {
  const c = await club('Published family boundary'), guardian = account('Published guardian'), other = account('Other published guardian');
  const child = c.squads[0].playerIds[0], sibling = c.squads[0].playerIds[1]; guardian.children = [{ id: child, name: 'Own child' }]; other.children = [{ id: sibling }];
  const plan = await create(c);
  assert.equal((await call('POST', `/map/plans/${plan.id}/publish`, c.owner, { revision: 1 })).status, 200);
  assert.deepEqual(await context(guardian, true), []);
  assert.equal((await call('GET', `/map/plans/${plan.id}`, guardian)).status, 403);
  let shared = (await call('GET', '/map/plans/family', guardian)).body;
  assert.equal(shared.length, 1); assert.equal(shared[0].child_id, child); assert.equal(shared[0].permission, null);
  assert.equal('privateNotes' in shared[0].itinerary, false); assert.equal('participants' in shared[0].itinerary, false);
  c.state.records.push({ id: W.newId(), club_id: c.id, squad_id: c.squads[0].id, map_plan_id: plan.id, module: 'GUARDIANS', kind: 'CONSENT',
    title: 'Travel permission', status: 'PENDING', revision: 1, assigned_user_id: guardian.id, subject_user_id: child,
    privateNotes: 'Internal review', data: { wording: 'Review this published journey', version: `map-plan-${plan.id}-v1`, staffContact: 'Internal contact' } });
  const permission = (await call('GET', '/map/plans/family', guardian)).body[0].permission;
  assert.equal(permission.data.wording, 'Review this published journey'); assert.equal('privateNotes' in permission, false);
  assert.equal('staffContact' in permission.data, false); assert.deepEqual(permission.transitions, []);
  assert.deepEqual((await call('GET', '/map/plans/family', other, undefined, {}, true)).body, []);
  const schedule = (await call('GET', '/journeys/schedule', guardian, undefined, { childId: child })).body;
  assert.ok(schedule.length); assert.ok(schedule.every(row => !row.staff && row.subjects.every(subject => subject.id === child)));
  assert.deepEqual((await call('GET', '/journeys/schedule', other, undefined, { childId: child })).body, []);
  assert.equal((await call('POST', `/journeys/${plan.id}/reply`, other, { version: 1, subjectId: child, response: 'GOING' })).status, 403);
  assert.equal((await call('POST', `/journeys/${plan.id}/reply`, guardian, { version: 1, subjectId: child, response: 'GOING' })).status, 200);
  const saved = await call('PUT', `/map/plans/${plan.id}`, c.owner, { revision: 1, draft: { ...plan.draft, familyMessage: 'Not shared until republished', participants: [child, sibling] } });
  assert.equal(saved.status, 200);
  shared = (await call('GET', '/map/plans/family', guardian)).body;
  assert.equal(shared[0].itinerary.message, 'Shared first version');
  assert.deepEqual((await call('GET', '/map/plans/family', other)).body, []);
  assert.equal((await call('POST', `/map/plans/${plan.id}/publish`, c.owner, { revision: 2 })).status, 200);
  assert.equal((await call('POST', `/journeys/${plan.id}/reply`, guardian, { version: 1, subjectId: child, response: 'GOING' })).status, 409);
  assert.equal((await call('GET', '/map/plans/family', other)).body[0].child_id, sibling);
  guardian.children = [];
  assert.deepEqual((await call('GET', '/map/plans/family', guardian)).body, [], 'current own-child authority is required even for the frozen publication');
  guardian.children = [{ id: child }];
  c.squads[0].playerIds = c.squads[0].playerIds.filter(id => id !== child);
  assert.deepEqual((await call('GET', '/map/plans/family', guardian)).body, []);
  assert.equal((await call('POST', `/journeys/${plan.id}/reply`, guardian, { version: 2, subjectId: child, response: 'GOING' })).status, 403);
});

test('preferences and from-fixture drafting follow current club/squad write scope without a Dinamo fallback', async () => {
  const c = await club('Own fixture planning'), reader = account('Fixture read-only'); appointment(c, reader, [c.squads[0]], ['MATCHES:READ']);
  assert.equal((await call('GET', `/journeys/squads/${c.squads[0].id}/preferences`, reader)).status, 200);
  assert.equal((await call('PUT', `/journeys/squads/${c.squads[0].id}/preferences`, reader, { revision: 0, preferences: {} })).status, 403);
  assert.equal((await call('PUT', `/journeys/squads/${c.squads[0].id}/preferences`, c.owner, { revision: 0, preferences: { mode: 'MEET_AT_VENUE' } })).status, 200);
  assert.equal((await call('PUT', `/journeys/squads/${c.squads[0].id}/preferences`, c.owner, { revision: 0, preferences: {} })).status, 409);
  const fixture = { id: W.newId(), clubId: c.id, squadId: c.squads[0].id, opponentClubId: 1, venueId: 202, title: 'Our fixture', home: true, status: 'SCHEDULED', start: new Date(Date.now() + 86400000), end: new Date(Date.now() + 90000000) };
  W.matches.push(fixture);
  try {
    const body = { eventId: fixture.id, clubId: c.id, squadId: c.squads[0].id, preferences: { mode: 'MEET_AT_VENUE' } };
    assert.equal((await call('POST', '/journeys/from-fixture', reader, body)).status, 403);
    const made = await call('POST', '/journeys/from-fixture', c.owner, body);
    assert.equal(made.status, 201); assert.equal(made.body.club_id, c.id); assert.equal(made.body.created_by, c.owner.id);
    assert.ok(made.body.draft.participants.every(id => c.squads[0].playerIds.includes(id)));
    assert.equal((await call('POST', '/journeys/from-fixture', c.owner, body)).body.id, made.body.id);
    assert.equal((await call('POST', '/journeys/from-fixture', c.owner, { ...body, squadId: c.squads[1].id })).status, 404);
  } finally { W.matches.splice(W.matches.indexOf(fixture), 1); }
});
