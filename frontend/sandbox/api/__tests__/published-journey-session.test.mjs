import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import { squadSessionDto } from '../squad-session-dto.mjs';

const NOW = Date.parse('2030-01-01T12:00:17.123Z');
const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
const call = (method, path, actor, body, query = {}) => handleApi({ method, path, body, query: new URLSearchParams(query), headers: { cookie: `gk-sandbox-user=${actor.id}` } });

async function scenario(t) {
  t.mock.method(Date, 'now', () => NOW);
  const owner = account('Session journey owner'), guardian = account('Session journey guardian'), adult = account('Adult session traveller');
  const setup = await call('POST', '/organizations/setup', owner, { pageKind: 'CLUB', displayName: 'Session journey QA', location: { city: 'Tbilisi' }, requestId: randomUUID() });
  assert.equal(setup.status, 200);
  const clubId = setup.body.clubId;
  assert.equal((await call('PUT', `/clubs/${clubId}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }] } })).status, 200);
  const squad = W.squads.find(item => item.clubId === clubId), child = { id: W.newId(), fullName: 'Current invited child', birthYear: 2013 };
  W.people.push(child); squad.playerIds.push(child.id, adult.id); guardian.children = [{ id: child.id, name: child.fullName }];
  W.parents.push({ parentId: guardian.id, childId: child.id });
  const startsAt = new Date(NOW + 86400000).toISOString(), endsAt = new Date(NOW + 90000000).toISOString();
  const created = await call('POST', `/squad-communication/${squad.id}/events`, owner, { requestId: randomUUID(), title: 'Canonical journey training', eventType: 'TRAINING',
    description: 'Canonical source fixture', startsAt, endsAt, timezone: 'Asia/Tbilisi', location: 'School entrance pitch', playerIds: [child.id, adult.id], requestResponses: true, repeat: null });
  assert.equal(created.status, 200);
  const session = W.events.find(event => event.id === created.body.sessionIds[0]); assert.ok(session?.invitationPlan);
  assert.equal(session.start.toISOString(), startsAt); assert.equal(session.end.toISOString(), endsAt);
  const canonical = squadSessionDto(squad, session, { source: 'SINGLE' });
  assert.equal(canonical.id, session.id); assert.equal(canonical.status, 'SCHEDULED');
  const draft = { title: 'Our training journey', timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 0, startsAt, endsAt,
    destination: canonical.location, meetingPoint: 'School entrance', collectionPoint: 'School entrance', supervisionContact: 'QA coaching team',
    familyMessage: 'Published training journey', privateNotes: 'Unshared staff note', participants: [child.id, adult.id],
    places: [{ key: 'ground', name: canonical.location, address: '', latitude: 41.7, longitude: 44.8, type: 'MANUAL', entityId: null, notes: '' }],
    activities: [{ key: 'training', title: canonical.title, kind: 'TRAINING', startsAt, endsAt, placeKey: 'ground', eventId: null, sessionId: session.id, notes: '' }], arrangements: [] };
  const plan = await call('POST', '/map/plans', owner, { clubId, squadId: squad.id, requestId: randomUUID(), draft });
  assert.equal(plan.status, 201);
  const id = plan.body.id;
  assert.equal((await call('POST', `/map/plans/${id}/publish`, owner, { revision: 1 })).status, 200);
  const shared = (await call('GET', '/map/plans/family', guardian)).body.find(item => item.plan_id === id); assert.ok(shared);
  const entries = async query => (await call('GET', '/journeys/schedule', guardian, undefined, { from: new Date(NOW).toISOString(), to: new Date(NOW + 5 * 86400000).toISOString(), childId: child.id, ...query })).body.filter(row => row.planId === id);
  const replies = () => Promise.all([
    call('POST', `/journeys/${id}/reply`, guardian, { version: 1, subjectId: child.id, response: 'NOT_GOING' }),
    call('POST', `/map/plans/${id}/journey-response`, guardian, { version: 1, subjectId: child.id, response: 'NOT_GOING' }),
    call('POST', `/map/plans/${id}/my-response`, adult, { version: 1, response: 'GOING' }),
  ]);
  const unchanged = async () => {
    const current = (await call('GET', '/map/plans/family', guardian)).body.find(item => item.plan_id === id);
    assert.equal(current.version, 1); assert.deepEqual(current.itinerary, shared.itinerary); assert.equal(current.permission, null);
    assert.equal(current.canRespond, false, 'the family read capability uses the same canonical source gate');
    assert.equal(F.planById(id).published_version, 1);
  };
  return { owner, guardian, adult, child, squad, session, id, entries, replies, unchanged };
}

test('canonical cancellation closes all journey attendance aliases while preserving READ, the publication and the recorded answer', async t => {
  const s = await scenario(t);
  assert.equal((await call('POST', `/journeys/${s.id}/reply`, s.guardian, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 200);
  const cancelled = await call('POST', `/squad-communication/${s.squad.id}/sessions/${s.session.id}/cancel`, s.owner, { reason: 'QA weather cancellation', revision: 1 });
  assert.equal(cancelled.status, 200); assert.equal(cancelled.body.status, 'CANCELLED');
  const rows = await s.entries(), responses = await s.replies(); assert.ok(rows.length);
  assert.deepEqual({ statuses: [...new Set(rows.map(row => row.status))], sourceChanged: rows.some(row => row.sourceChanged),
    canRespond: rows.some(row => row.subjects.some(subject => subject.canRespond)), replies: responses.map(response => response.status) },
  { statuses: ['CANCELLED'], sourceChanged: false, canRespond: false, replies: [409, 409, 409] });
  assert.equal(F.planReplies.get(`${s.id}:1:${s.child.id}`), 'GOING');
  assert.equal((await call('POST', `/map/plans/${s.id}/acknowledge`, s.guardian, { version: 1, childId: s.child.id })).status, 200);
  assert.equal((await call('POST', `/map/plans/${s.id}/my-response`, s.adult, { version: 1, response: 'READ' })).status, 200);
  await s.unchanged();
});

test('a missing canonical session cannot resolve to a same-number football fixture', async t => {
  const s = await scenario(t), index = W.events.indexOf(s.session);
  const originalTitle = s.session.title;
  for (const field of ['clubId', 'squadId']) {
    const original = s.session[field]; s.session[field] = -1; s.session.title = 'Foreign source title';
    const refused = await s.entries();
    assert.ok(refused.every(row => row.status === 'CANCELLED' && row.title !== s.session.title), 'wrong source scope is not returned');
    for (const response of await s.replies()) assert.equal(response.status, 409);
    s.session[field] = original; s.session.title = originalTitle;
  }
  W.events.splice(index, 1);
  const other = { id: s.session.id, clubId: s.squad.clubId, squadId: s.squad.id, start: s.session.start, end: s.session.end, status: 'SCHEDULED', title: 'Different football namespace', venueId: 202 };
  W.matches.push(other);
  try {
    const rows = await s.entries(); assert.ok(rows.length);
    assert.ok(rows.every(row => row.status === 'CANCELLED' && !row.sourceChanged && row.sessionId === s.session.id && row.eventId == null));
    assert.ok(rows.every(row => row.title !== other.title));
    for (const response of await s.replies()) assert.equal(response.status, 409);
    await s.unchanged();
  } finally { W.events.splice(index, 0, s.session); W.matches.splice(W.matches.indexOf(other), 1); }
});

test('canonical time and location changes close attendance and show the new linked time without rebuilding the shared itinerary', async t => {
  const s = await scenario(t);
  s.session.start = new Date(s.session.start.getTime() + 2 * 86400000); s.session.end = new Date(s.session.end.getTime() + 2 * 86400000); s.session.location = 'Current school pitch';
  const rows = await s.entries(); assert.ok(rows.every(row => row.status === 'SCHEDULED' && row.sourceChanged && row.subjects.every(subject => !subject.canRespond)));
  assert.equal(rows[0].startsAt, s.session.start.toISOString()); assert.equal(rows[0].place.name, 'School entrance pitch');
  assert.ok((await s.entries({ from: s.session.start.toISOString(), to: s.session.end.toISOString() })).length);
  for (const response of await s.replies()) assert.equal(response.status, 409);
  await s.unchanged();
});

test('a canonical location-only change still invalidates the frozen dependency after a private draft unlinks it', async t => {
  const s = await scenario(t), plan = F.planById(s.id);
  assert.equal((await call('PUT', `/map/plans/${s.id}`, s.owner, { revision: plan.revision, draft: { ...plan.draft,
    familyMessage: 'Private changed message', activities: plan.draft.activities.map(activity => ({ ...activity, sessionId: null })) } })).status, 200);
  s.session.location = 'Different ground';
  assert.ok((await s.entries()).every(row => row.sourceChanged && row.status === 'SCHEDULED'));
  for (const response of await s.replies()) assert.equal(response.status, 409);
  await s.unchanged();
});

test('nonmaterial session metadata ignores football namespace collisions and retains subject, roster, version and audience boundaries', async t => {
  const s = await scenario(t), collision = { id: s.session.id, status: 'CANCELLED', start: s.session.start, end: s.session.end, venueId: 202 };
  W.matches.push(collision);
  try {
    s.session.title = 'Current session title'; s.session.location = '';
    const rows = await s.entries();
    assert.ok(rows.every(row => row.status === 'SCHEDULED' && !row.sourceChanged && row.subjects.every(subject => subject.canRespond)));
    assert.equal(rows[0].title, s.session.title, 'title-only and blank-location changes do not invent a material source change');
    assert.equal(JSON.stringify(rows).includes(s.adult.fullName), false, 'raw DTO attendance names do not escape the narrow source projection');
    for (const response of await s.replies()) assert.equal(response.status, 200);
    const outsider = account('Other session family');
    assert.equal((await call('POST', `/journeys/${s.id}/reply`, outsider, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 403);
    assert.equal((await call('POST', `/journeys/${s.id}/reply`, s.guardian, { version: 0, subjectId: s.child.id, response: 'GOING' })).status, 409);
    const newcomer = { id: W.newId(), fullName: 'Later uninvited child' }; W.people.push(newcomer); s.squad.playerIds.push(newcomer.id); outsider.children = [{ id: newcomer.id }];
    assert.equal((await call('POST', `/journeys/${s.id}/reply`, outsider, { version: 1, subjectId: newcomer.id, response: 'GOING' })).status, 403);
    assert.equal(JSON.stringify(await s.entries()).includes(newcomer.fullName), false);
    s.squad.playerIds = s.squad.playerIds.filter(id => id !== s.child.id);
    assert.equal((await call('POST', `/journeys/${s.id}/reply`, s.guardian, { version: 1, subjectId: s.child.id, response: 'GOING' })).status, 403);
  } finally { W.matches.splice(W.matches.indexOf(collision), 1); }
});

test('legacy canonical display timestamps are not reparsed as UTC source instants', async t => {
  const s = await scenario(t); s.session.invitationPlan = false;
  const dto = squadSessionDto(s.squad, s.session, { source: 'SINGLE' });
  assert.equal(dto.starts_at.endsWith('Z'), false);
  const rows = await s.entries(); assert.equal(rows[0].startsAt, s.session.start.toISOString());
  assert.ok(rows.every(row => !row.sourceChanged && row.subjects.every(subject => subject.canRespond)));
  for (const response of await s.replies()) assert.equal(response.status, 200);
});
