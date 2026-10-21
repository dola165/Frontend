import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';

const NOW = Date.parse('2030-01-01T12:00:00Z');
const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
const call = (method, path, actor, body, query = {}) => handleApi({ method, path, body, query: new URLSearchParams(query), headers: { cookie: `gk-sandbox-user=${actor?.id ?? W.ME_ID}` } });
async function scenario(t) {
  t.mock.method(Date, 'now', () => NOW);
  const owner = account('Published journey owner'), guardian = account('Published journey guardian'), adult = account('Adult traveller');
  const setup = await call('POST', '/organizations/setup', owner, { pageKind: 'CLUB', displayName: 'Published journey QA', location: { city: 'Tbilisi' }, requestId: randomUUID() });
  const clubId = setup.body.clubId;
  assert.equal((await call('PUT', `/clubs/${clubId}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MALE' }] } })).status, 200);
  const squad = W.squads.find(item => item.clubId === clubId), child = { id: W.newId(), fullName: 'Published journey child', birthYear: 2013 };
  W.people.push(child); squad.playerIds.push(child.id, adult.id); guardian.children = [{ id: child.id, name: child.fullName }];
  const made = await call('POST', '/match-arrangements', owner, { match: { squadId: squad.id, title: 'Published fixture', description: '',
    startsAt: new Date(NOW + 86400000).toISOString(), endsAt: new Date(NOW + 90000000).toISOString(), timezone: 'Asia/Tbilisi', city: 'Tbilisi',
    venueId: 202, locationName: W.venueById(202).name, ageGroup: 'U14', level: 'DEVELOPMENT', format: '11_A_SIDE', venuePreference: 'HOME',
    refereeRequired: false, requestId: randomUUID(), revision: 0 }, targetClubId: F.DINAMO, targetSquadId: 103,
    bookingId: null, matchType: 'FRIENDLY', hostingChoice: 'HOME', officialMode: 'NONE', officialResponsibility: 'HOST', volunteer: true, fee: 0, currency: 'GEL' });
  assert.equal(made.status, 201);
  const eventId = made.body.event_id;
  assert.equal((await call('POST', `/match-arrangements/${eventId}/response`, null, { action: 'ACCEPT', squadId: 103, revision: 1 })).status, 200);
  const fixture = F.listingById(eventId); assert.equal(fixture.status, 'ARRANGED');
  const started = await call('POST', '/journeys/from-fixture', owner, { clubId, squadId: squad.id, eventId,
    preferences: { mode: 'MEET_AT_VENUE', supervisionContact: 'QA coaching team' } });
  assert.equal(started.status, 201);
  const planId = started.body.id;
  assert.equal((await call('POST', `/map/plans/${planId}/publish`, owner, { revision: 1 })).status, 200);
  const shared = (await call('GET', '/map/plans/family', guardian)).body.find(item => item.plan_id === planId);
  assert.ok(shared);
  const entries = async query => (await call('GET', '/journeys/schedule', guardian, undefined, {
    from: new Date(NOW).toISOString(), to: new Date(NOW + 5 * 86400000).toISOString(), childId: child.id, ...query })).body.filter(item => item.planId === planId);
  const replies = () => [
    call('POST', `/journeys/${planId}/reply`, guardian, { version: 1, subjectId: child.id, response: 'NOT_GOING' }),
    call('POST', `/map/plans/${planId}/journey-response`, guardian, { version: 1, subjectId: child.id, response: 'NOT_GOING' }),
    call('POST', `/map/plans/${planId}/my-response`, adult, { version: 1, response: 'GOING' }),
  ];
  const unchanged = async () => {
    const current = (await call('GET', '/map/plans/family', guardian)).body.find(item => item.plan_id === planId);
    assert.equal(current.version, 1); assert.deepEqual(current.itinerary, shared.itinerary);
    assert.equal(F.planById(planId).published_version, 1); assert.equal(current.permission, null);
  };
  return { owner, guardian, adult, child, squad, planId, fixture, entries, replies, unchanged };
}

test('closing a newly arranged fixture marks its published journey cancelled, closes all attendance aliases and keeps READ separate', async t => {
  const s = await scenario(t);
  assert.equal((await call('POST', `/journeys/${s.planId}/reply`, s.guardian, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 200);
  assert.equal((await call('POST', `/match-exchange/${s.fixture.id}/close`, s.owner, {})).status, 200);
  const rows = await s.entries(); assert.ok(rows.length);
  const responses = await Promise.all(s.replies());
  assert.deepEqual({ status: [...new Set(rows.map(row => row.status))], sourceChanged: rows.some(row => row.sourceChanged),
    canRespond: rows.some(row => row.subjects.some(subject => subject.canRespond)), replyStatuses: responses.map(response => response.status) },
  { status: ['CANCELLED'], sourceChanged: false, canRespond: false, replyStatuses: [409, 409, 409] });
  assert.equal(F.planReplies.get(`${s.planId}:1:${s.child.id}`), 'GOING', 'refusal does not replace the recorded response');
  assert.equal((await call('POST', `/map/plans/${s.planId}/acknowledge`, s.guardian, { version: 1, childId: s.child.id })).status, 200);
  assert.equal((await call('POST', `/map/plans/${s.planId}/my-response`, s.adult, { version: 1, response: 'READ' })).status, 200);
  await s.unchanged();
});

test('a missing linked fixture is cancellation without rewriting the publication', async t => {
  const s = await scenario(t), index = F.exchange.indexOf(s.fixture);
  F.exchange.splice(index, 1);
  try {
    const rows = await s.entries(); assert.ok(rows.every(row => row.status === 'CANCELLED' && !row.sourceChanged));
    for (const response of await Promise.all(s.replies())) assert.equal(response.status, 409);
    await s.unchanged();
  } finally { F.exchange.splice(index, 0, s.fixture); }
});

test('legacy match sources remain readable and CANCELED is treated as cancellation', async t => {
  const s = await scenario(t), index = F.exchange.indexOf(s.fixture);
  F.exchange.splice(index, 1);
  const match = { id: s.fixture.id, clubId: s.squad.clubId, squadId: s.squad.id, opponentClubId: F.DINAMO,
    start: s.fixture.start, end: s.fixture.end, venueId: s.fixture.venueId, title: s.fixture.title, status: 'SCHEDULED' };
  W.matches.push(match);
  try {
    assert.ok((await s.entries()).every(row => row.status === 'SCHEDULED' && row.subjects.every(subject => subject.canRespond)));
    match.status = 'CANCELED';
    assert.ok((await s.entries()).every(row => row.status === 'CANCELLED' && !row.sourceChanged && row.subjects.every(subject => !subject.canRespond)));
    for (const response of await Promise.all(s.replies())) assert.equal(response.status, 409);
    await s.unchanged();
  } finally { W.matches.splice(W.matches.indexOf(match), 1); F.exchange.splice(index, 0, s.fixture); }
});

test('changed fixture times and ground close attendance without cancelling or rewriting the publication, including a newly moved date range', async t => {
  const s = await scenario(t), before = await s.entries(), warmup = before.find(row => row.kind !== 'MATCH');
  s.fixture.start = new Date(s.fixture.start.getTime() + 2 * 86400000); s.fixture.end = new Date(s.fixture.end.getTime() + 2 * 86400000); s.fixture.venueId = 203;
  const rows = await s.entries(); assert.ok(rows.every(row => row.status !== 'CANCELLED' && row.sourceChanged && row.subjects.every(subject => !subject.canRespond)));
  assert.equal(rows.find(row => row.kind === 'MATCH').startsAt, s.fixture.start.toISOString());
  assert.equal(rows.find(row => row.kind !== 'MATCH').startsAt, warmup.startsAt, 'other stops retain their published times');
  const moved = await s.entries({ from: s.fixture.start.toISOString(), to: s.fixture.end.toISOString() });
  assert.ok(moved.some(row => row.kind === 'MATCH'), 'current linked time is visible outside the original publication range');
  for (const response of await Promise.all(s.replies())) assert.equal(response.status, 409);
  await s.unchanged();
});

test('a ground-only change closes attendance and unshared draft edits cannot remove the frozen fixture dependency', async t => {
  const s = await scenario(t), plan = F.planById(s.planId);
  const saved = await call('PUT', `/map/plans/${s.planId}`, s.owner, { revision: plan.revision,
    draft: { ...plan.draft, familyMessage: 'Unshared work', activities: plan.draft.activities.map(activity => ({ ...activity, eventId: null })) } });
  assert.equal(saved.status, 200);
  s.fixture.venueId = 203;
  assert.ok((await s.entries()).every(row => row.sourceChanged && row.status !== 'CANCELLED'));
  for (const response of await Promise.all(s.replies())) assert.equal(response.status, 409);
  await s.unchanged();
});

test('current unchanged fixtures keep attendance available and current child/roster/version checks retain priority', async t => {
  const s = await scenario(t);
  const rows = await s.entries(); assert.ok(rows.every(row => !row.sourceChanged && row.status === 'SCHEDULED' && row.subjects.every(subject => subject.canRespond)));
  for (const response of await Promise.all(s.replies())) assert.equal(response.status, 200);
  assert.equal((await call('POST', `/journeys/${s.planId}/reply`, s.guardian, { version: 0, subjectId: s.child.id, response: 'GOING' })).status, 409);
  const outsider = account('Unrelated journey caller');
  assert.equal((await call('POST', `/journeys/${s.planId}/reply`, outsider, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 403);
  s.squad.playerIds = s.squad.playerIds.filter(id => id !== s.child.id);
  assert.equal((await call('POST', `/journeys/${s.planId}/reply`, s.guardian, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 403);
});

test('closed travel blocks attendance without changing travel or READ acknowledgement', async t => {
  const s = await scenario(t), plan = F.planById(s.planId);
  plan.trip_id = W.newId(); plan.trip = { id: plan.trip_id, status: 'DEPARTED' };
  assert.ok((await s.entries()).every(row => row.subjects.every(subject => !subject.canRespond)));
  for (const response of await Promise.all(s.replies())) assert.equal(response.status, 409);
  assert.equal((await call('POST', `/map/plans/${s.planId}/acknowledge`, s.guardian, { version: 1, childId: s.child.id })).status, 200);
  assert.equal(plan.trip.status, 'DEPARTED'); await s.unchanged();
});
