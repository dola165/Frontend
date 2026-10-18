import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import { stateFor } from '../handlers/workspace-context.mjs';

// Actual handlers; all accounts/plans/records are process-local fixtures, with no running server or browser.
const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
const call = (method, path, actor, body) => handleApi({ method, path, body, headers: { cookie: `gk-sandbox-user=${actor.id}` }, query: new URLSearchParams() });
async function fixture(published = true) {
  const owner = account('Connect fixture owner');
  const setup = await call('POST', '/organizations/setup', owner, { requestId: randomUUID(), pageKind: 'CLUB', displayName: `Connect ${randomUUID()}`, location: { city: 'Tbilisi' } });
  assert.equal(setup.status, 200);
  const clubId = setup.body.clubId;
  assert.equal((await call('PUT', `/clubs/${clubId}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }] } })).status, 200);
  const squad = W.squads.find(item => item.clubId === clubId), child = W.newId();
  W.people.push({ id: child, fullName: 'Connect fixture child', birthYear: 2013 }); squad.playerIds.push(child);
  const startsAt = new Date(Date.now() + 86400000).toISOString(), endsAt = new Date(Date.now() + 90000000).toISOString();
  const draft = { title: 'Published trip fixture', timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 0, startsAt, endsAt,
    destination: 'Away ground', meetingPoint: 'Club gate', collectionPoint: 'Club gate', supervisionContact: 'Coaching team',
    familyMessage: 'Published instructions', privateNotes: 'Private working notes', participants: [child], places: [],
    activities: [{ key: 'activity', title: 'Away training', kind: 'ACTIVITY', startsAt, endsAt, placeKey: null, eventId: null, sessionId: null, notes: '' }],
    arrangements: [{ key: 'bus', kind: 'TRANSPORT', title: 'Operator-provided minibus details', placeKey: null, amountMinor: 0, notes: 'Fixture only', financeRecordId: null }] };
  const made = await call('POST', '/map/plans', owner, { clubId, squadId: squad.id, requestId: randomUUID(), draft });
  assert.equal(made.status, 201);
  const plan = F.planById(made.body.id), state = stateFor(clubId);
  if (published) assert.equal((await call('POST', `/map/plans/${plan.id}/publish`, owner, { revision: plan.revision })).status, 200);
  return { owner, clubId, squad, child, plan, state };
}
const connect = (c, actor = c.owner, revision = c.plan.revision) => call('POST', `/map/plans/${c.plan.id}/connect-trip`, actor, { revision });
const snapshot = c => structuredClone({ plan: c.plan, records: c.state.records, history: [...c.state.history], replies: [...F.planReplies] });
function existingTrip(c, status) {
  const row = { id: W.newId(), club_id: c.clubId, squad_id: c.squad.id, module: 'TRAVEL', kind: 'TRIP', status, revision: 7,
    map_plan_id: c.plan.id, title: 'Existing trip fixture', data: {}, updated_at: W.iso(new Date()) };
  c.state.records.push(row); c.plan.trip_id = row.id; c.plan.trip = row;
  const passenger = { id: W.newId(), club_id: c.clubId, squad_id: c.squad.id, module: 'TRAVEL', kind: 'PASSENGER', status: 'PLANNED', revision: 4,
    related_record_id: row.id, subject_user_id: c.child, data: {}, updated_at: row.updated_at };
  c.state.records.push(passenger); c.plan.passengers = [passenger];
  return row;
}

test('refuses connection before any family publication without changing plan or operational records', async () => {
  const c = await fixture(false), before = snapshot(c), result = await connect(c);
  assert.equal(result.status, 409); assert.match(result.body.message, /Publish the family itinerary/);
  assert.deepEqual(snapshot(c), before);
});

test('requires the currently published draft as well as the exact command revision', async () => {
  const c = await fixture();
  const saved = await call('PUT', `/map/plans/${c.plan.id}`, c.owner, { revision: 1, draft: { ...c.plan.draft, title: 'Unpublished draft change' } });
  assert.equal(saved.status, 200);
  const before = snapshot(c);
  assert.equal((await connect(c, c.owner, 1)).status, 409);
  const result = await connect(c);
  assert.equal(result.status, 409); assert.match(result.body.message, /Publish the current draft/);
  assert.deepEqual(snapshot(c), before);
});

test('does not report a new connection or create partial records while linked travel checks are unavailable', async () => {
  const c = await fixture(), guardian = account('Current fixture guardian');
  guardian.children = [{ id: c.child, name: 'Own child' }];
  assert.equal((await call('POST', `/journeys/${c.plan.id}/reply`, guardian, { version: 1, subjectId: c.child, response: 'GOING' })).status, 200);
  const family = (await call('GET', '/map/plans/family', guardian)).body;
  assert.equal(family[0].permission, null, 'a GOING reply is not a permission grant');
  const before = snapshot(c), result = await connect(c);
  assert.equal(result.status, 409); assert.match(result.body.message, /travel record could not be connected/i);
  assert.equal(c.plan.trip_id, null); assert.equal(c.plan.trip, null); assert.deepEqual(c.plan.passengers, []);
  assert.deepEqual(snapshot(c), before, 'no fabricated consent, partial trip/passenger write, budget or publication change');
  assert.deepEqual((await call('GET', '/map/plans/family', guardian)).body, family);
  guardian.children = [];
  assert.deepEqual((await call('GET', '/map/plans/family', guardian)).body, [], 'current family identity remains required');
});

test('keeps current TRAVEL scope and stale revision refusals ahead of the unsupported-connection boundary', async () => {
  const c = await fixture(), finance = account('Finance-only fixture'), expired = account('Expired travel fixture'), outsider = account('Unrelated fixture');
  for (const [actor, permissions, ends_on] of [[finance, ['FINANCE:WRITE'], null], [expired, ['TRAVEL:WRITE'], '2000-01-01']]) c.state.appointments.push({
    id: W.newId(), club_id: c.clubId, user_id: actor.id, status: 'ACTIVE', starts_on: '1999-01-01', ends_on, squad_ids: [c.squad.id], club_wide: false, permissions,
  });
  const before = snapshot(c);
  for (const actor of [finance, expired, outsider]) assert.equal((await connect(c, actor)).status, 403);
  assert.equal((await connect(c, c.owner, 0)).status, 409);
  assert.deepEqual(snapshot(c), before);
});

test('preserves existing READY identity, revisions, passenger records and finances while refusing unsupported synchronization', async () => {
  const c = await fixture(); existingTrip(c, 'READY'); c.plan.budgetApproved = true; c.plan.approvedBy = account('Existing independent reviewer').id;
  const before = snapshot(c), result = await connect(c);
  assert.equal(result.status, 409); assert.deepEqual(snapshot(c), before);
});

for (const status of ['DEPARTED', 'RETURNED', 'CANCELLED']) test(`returns the existing ${status} shared trip unchanged after the publication/revision gates`, async () => {
  const c = await fixture(), row = existingTrip(c, status);
  c.plan.trip = { ...row, status: 'DRAFT' }; // An embedded projection cannot override the shared record.
  const before = snapshot(c), result = await connect(c);
  assert.equal(result.status, 200); assert.equal(result.body.trip.id, row.id); assert.equal(result.body.trip.status, status);
  assert.deepEqual(snapshot(c), before);
});

test('does not trust an embedded terminal label without the exact current club/squad TRIP record', async () => {
  const c = await fixture(), row = existingTrip(c, 'DEPARTED');
  row.squad_id = c.squad.id + 1000;
  const before = snapshot(c), result = await connect(c);
  assert.equal(result.status, 409); assert.deepEqual(snapshot(c), before);
});
