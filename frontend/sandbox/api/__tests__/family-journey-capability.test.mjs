import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';

const NOW = Date.parse('2030-01-01T12:00:00Z');
const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
const call = (method, path, actor, body) => handleApi({ method, path, body, query: new URLSearchParams(), headers: { cookie: `gk-sandbox-user=${actor.id}` } });
async function scenario(t) {
  t.mock.method(Date, 'now', () => NOW);
  const owner = account('Family hint owner'), guardian = account('Family hint guardian'), adult = account('Family hint adult');
  const created = await call('POST', '/organizations/setup', owner, { pageKind: 'CLUB', displayName: 'Family hint QA', location: { city: 'Tbilisi' }, requestId: randomUUID() });
  assert.equal(created.status, 200); const clubId = created.body.clubId;
  assert.equal((await call('PUT', `/clubs/${clubId}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }] } })).status, 200);
  const squad = W.squads.find(item => item.clubId === clubId), child = { id: W.newId(), fullName: 'Own family hint child', birthYear: 2013 };
  W.people.push(child); squad.playerIds.push(child.id, adult.id); guardian.children = [{ id: child.id }];
  const fixture = { id: W.newId(), clubId, squadId: squad.id, opponentClubId: 1, title: 'Family hint fixture', status: 'SCHEDULED',
    start: new Date(NOW + 86400000), end: new Date(NOW + 90000000), venueId: 202, home: true };
  W.matches.push(fixture); t.after(() => W.matches.includes(fixture) && W.matches.splice(W.matches.indexOf(fixture), 1));
  const startsAt = fixture.start.toISOString(), endsAt = fixture.end.toISOString(), name = W.venueById(202).name;
  const draft = { title: 'Shared family hint journey', timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 0, startsAt, endsAt,
    destination: name, meetingPoint: name, collectionPoint: name, supervisionContact: 'QA staff', familyMessage: 'Published message', privateNotes: 'Private staff note',
    participants: [child.id, adult.id], places: [{ key: 'ground', name, address: '', latitude: 41.7, longitude: 44.8 }],
    activities: [{ key: 'fixture', title: fixture.title, kind: 'MATCH', startsAt, endsAt, placeKey: 'ground', eventId: fixture.id, sessionId: null }], arrangements: [] };
  const made = await call('POST', '/map/plans', owner, { clubId, squadId: squad.id, requestId: randomUUID(), draft });
  assert.equal(made.status, 201); const id = made.body.id;
  assert.equal((await call('POST', `/map/plans/${id}/publish`, owner, { revision: 1 })).status, 200);
  const family = async actor => (await call('GET', '/map/plans/family', actor)).body.find(row => row.plan_id === id);
  return { id, owner, guardian, adult, child, fixture, family };
}

for (const state of ['cancelled', 'missing', 'moved', 'departed']) test(`family refresh closes attendance capability for ${state} journeys while retaining separate READ`, async t => {
  const s = await scenario(t), original = await s.family(s.guardian);
  assert.equal(original.canRespond, true);
  if (state === 'cancelled') s.fixture.status = 'CANCELLED';
  if (state === 'missing') W.matches.splice(W.matches.indexOf(s.fixture), 1);
  if (state === 'moved') { s.fixture.start = new Date(s.fixture.start.getTime() + 1800000); s.fixture.end = new Date(s.fixture.end.getTime() + 1800000); }
  if (state === 'departed') { const plan = F.planById(s.id); plan.trip_id = W.newId(); plan.trip = { id: plan.trip_id, status: 'DEPARTED' }; }
  assert.equal((await call('POST', `/journeys/${s.id}/reply`, s.guardian, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 409);
  for (const actor of [s.guardian, s.adult]) assert.equal((await s.family(actor)).canRespond, false, 'the read hint must agree with the attendance guard');
  assert.equal((await call('POST', `/map/plans/${s.id}/acknowledge`, s.guardian, { version: 1, childId: s.child.id })).status, 200);
  assert.equal((await call('POST', `/map/plans/${s.id}/my-response`, s.adult, { version: 1, response: 'READ' })).status, 200);
  const refreshed = await s.family(s.guardian);
  assert.equal(refreshed.canRespond, false); assert.equal(refreshed.version, 1); assert.deepEqual(refreshed.itinerary, original.itinerary); assert.equal(refreshed.permission, null);
});

test('unchanged published journeys keep guardian and adult family capability available', async t => {
  const s = await scenario(t);
  assert.equal((await s.family(s.guardian)).canRespond, true); assert.equal((await s.family(s.adult)).canRespond, true);
  assert.equal((await call('POST', `/journeys/${s.id}/reply`, s.guardian, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 200);
});
