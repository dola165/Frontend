import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import { publicationOf } from './map-planning-access.mjs';
import { stateFor } from './workspace-context.mjs';

// All route calls and facts are approved process-local fixtures; never a running HTTP service.
const call = (c, method, tail, body, actor = c.actor) => handleApi({ method, path: tail.startsWith('/') ? tail : `/clubs/${c.clubId}/operations/${tail}`, body, headers: { cookie: `gk-sandbox-user=${actor.id}` }, query: new URLSearchParams() });
async function fixture(linked = true) {
  const actor = V.createAccount({ fullName: 'Guard fixture owner', email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' }), c = { actor };
  const setup = await call(c, 'POST', '/organizations/setup', { requestId: randomUUID(), pageKind: 'CLUB', displayName: `Guard ${randomUUID()}`, location: { city: 'Tbilisi' } });
  assert.equal(setup.status, 200); c.clubId = setup.body.clubId;
  assert.equal((await call(c, 'PUT', `/clubs/${c.clubId}/page/boxes/squads`, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }] } })).status, 200);
  c.squad = W.squads.find(s => s.clubId === c.clubId); c.child = W.newId(); W.people.push({ id: c.child, fullName: 'Guard fixture child', birthYear: 2013 }); c.squad.playerIds.push(c.child);
  const startsAt = new Date(Date.now() + 86400000).toISOString(), endsAt = new Date(Date.now() + 90000000).toISOString();
  c.tripBody = { kind: 'TRIP', title: 'Guard trip', squadId: c.squad.id, assignedUserId: actor.id, data: { departureAt: startsAt, returnAt: endsAt, destination: 'Away ground', transport: 'MINIBUS', meetingPoint: 'Gate' } };
  const trip = await call(c, 'POST', 'records', c.tripBody); assert.equal(trip.status, 201); c.state = stateFor(c.clubId); c.trip = c.state.records.find(r => r.id === trip.body.id);
  const passenger = await call(c, 'POST', 'records', { kind: 'PASSENGER', title: 'Guard passenger', squadId: c.squad.id, subjectUserId: c.child, relatedRecordId: c.trip.id, data: {} }); assert.equal(passenger.status, 201); c.passenger = c.state.records.find(r => r.id === passenger.body.id);
  if (linked) {
    const draft = { title: 'Guard published plan', timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 0, startsAt, endsAt, destination: 'Away ground', meetingPoint: 'Gate', collectionPoint: 'Gate', supervisionContact: 'Coach', familyMessage: 'Fixture instructions', privateNotes: '', participants: [c.child], places: [], activities: [{ key: 'activity', title: 'Away training', kind: 'ACTIVITY', startsAt, endsAt, placeKey: null, eventId: null, sessionId: null, notes: '' }], arrangements: [] };
    const made = await call(c, 'POST', '/map/plans', { clubId: c.clubId, squadId: c.squad.id, requestId: randomUUID(), draft }); assert.equal(made.status, 201);
    c.plan = F.planById(made.body.id); assert.equal((await call(c, 'POST', `/map/plans/${c.plan.id}/publish`, { revision: c.plan.revision })).status, 200);
    c.plan.trip_id = c.trip.id; c.plan.trip = c.trip; c.trip.map_plan_id = c.plan.id;
  }
  return c;
}
const snapshot = c => structuredClone({ records: c.state.records, history: [...c.state.history], plan: c.plan, publication: c.plan ? publicationOf(c.plan) : null, replies: [...F.planReplies] });
async function refused(c, tail, body, method = 'POST', actor) { const before = snapshot(c), result = await call(c, method, tail, body, actor); assert.equal(result.status, 409, JSON.stringify(result.body)); assert.deepEqual(snapshot(c), before, 'Refusal must not mutate record IDs, data/status/revision, history, plan or publication'); return result; }
const board = c => `records/${c.passenger.id}/transition`;

test('standalone legacy records retain boarding, trip edits and ordinary stale/terminal refusal', async () => {
  const c = await fixture(false);
  assert.equal((await call(c, 'POST', board(c), { revision: 0, status: 'BOARDED' })).status, 200);
  assert.equal((await call(c, 'PUT', `records/${c.trip.id}`, { ...c.tripBody, title: 'Updated standalone trip', revision: 0 })).status, 200);
  await refused(c, board(c), { revision: 0, status: 'ARRIVED' });
  for (const status of ['ARRIVED', 'RETURNED']) assert.equal((await call(c, 'POST', board(c), { revision: c.passenger.revision, status })).status, 200);
  await refused(c, board(c), { revision: c.passenger.revision, status: 'BOARDED' });
});
test('linked boarding refuses an unpublished changed draft without partial writes', async () => {
  const c = await fixture(); assert.equal((await call(c, 'PUT', `/map/plans/${c.plan.id}`, { revision: c.plan.revision, draft: { ...c.plan.draft, title: 'Changed unpublished plan' } })).status, 200);
  await refused(c, board(c), { revision: 0, status: 'BOARDED' });
});
test('linked current publication cannot fabricate missing readiness/permission representation', async () => {
  const c = await fixture(); const result = await refused(c, board(c), { revision: 0, status: 'BOARDED', permissionReference: 'trusted-by-client', permission: 'GRANTED', publishedRevision: c.plan.revision, mapPlanId: null });
  assert.match(result.body.message, /cannot be confirmed/i);
});
test('linked trip departure refuses unsupported readiness but historical return remains available', async () => {
  const c = await fixture(); assert.equal((await call(c, 'POST', `records/${c.trip.id}/transition`, { revision: 0, status: 'CONFIRMED' })).status, 200);
  await refused(c, `records/${c.trip.id}/transition`, { revision: 1, status: 'DEPARTED' });
  // A preexisting historical fact is not created by the guard or a claim of new readiness.
  c.trip.status = 'DEPARTED'; assert.equal((await call(c, 'POST', `records/${c.trip.id}/transition`, { revision: 1, status: 'RETURNED' })).status, 200);
  await refused(c, `records/${c.trip.id}/transition`, { revision: c.trip.revision, status: 'DEPARTED' });
});
for (const broken of ['missing-plan', 'foreign-club', 'foreign-squad', 'backlink-mismatch', 'duplicate-link', 'canonical-link-only']) test(`stored ${broken} linkage cannot be overridden by boarding input`, async () => {
  const c = await fixture();
  if (broken === 'missing-plan') F.plans.splice(F.plans.indexOf(c.plan), 1);
  if (broken === 'foreign-club') c.plan.club_id = c.clubId + 9000;
  if (broken === 'foreign-squad') c.plan.squad_id = c.squad.id + 9000;
  if (broken === 'backlink-mismatch') c.trip.map_plan_id = c.plan.id + 9000;
  if (broken === 'duplicate-link') F.plans.push({ ...c.plan, id: c.plan.id + 9000 });
  if (broken === 'canonical-link-only') c.trip.map_plan_id = null;
  await refused(c, board(c), { revision: 0, status: 'BOARDED', linked: false, relatedRecordId: null, planId: null, data: { permissionReference: 'GRANTED' } });
});
test('linked trip edit refuses unverifiable itinerary facts and retains known IDs/history', async () => {
  const c = await fixture(); await refused(c, `records/${c.trip.id}`, { ...c.tripBody, title: 'Override linked itinerary', revision: 0, mapPlanId: null }, 'PUT');
});
test('current actor and revision checks still refuse before linked state mutation', async () => {
  const c = await fixture(), other = V.createAccount({ fullName: 'Unrelated guard fixture', email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
  const before = snapshot(c); assert.equal((await call(c, 'POST', board(c), { revision: 0, status: 'BOARDED' }, other)).status, 403); assert.deepEqual(snapshot(c), before);
  await refused(c, board(c), { revision: 900, status: 'BOARDED' });
  await refused(c, board(c), { revision: 0, status: 'CANCELLED', note: 'No new cancellation state is invented' });
});
