import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import { stateFor } from '../handlers/workspace-context.mjs';

// Actual router/handlers, with new entities entirely inside this Node process; no server or network.
const account = name => V.createAccount({ fullName: name, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
const call = (method, path, actor, body) => handleApi({ method, path, body, headers: { cookie: `gk-sandbox-user=${actor.id}` }, query: new URLSearchParams() });
const answer = { arrangementKey: 'transport', status: 'PENDING', source: '  Operator note, 17 Oct 09:00  ', evidence: 'Reference QA-17\n  Preserve this exact note.  ' };
const appointment = (c, actor, squads, permissions, extra = {}) => {
  const grant = { id: W.newId(), club_id: c.clubId, user_id: actor.id, status: 'ACTIVE', starts_on: '2000-01-01', ends_on: null,
    squad_ids: squads.map(squad => squad.id), club_wide: false, permissions, ...extra };
  c.state.appointments.push(grant); return grant;
};
async function fixture(key = 'transport') {
  const owner = account('Supplier plan owner');
  const setup = await call('POST', '/organizations/setup', owner, { requestId: randomUUID(), pageKind: 'CLUB', displayName: `Supplier fixture ${randomUUID()}`, location: { city: 'Tbilisi' } });
  assert.equal(setup.status, 200);
  const clubId = setup.body.clubId;
  assert.equal((await call('PUT', `/clubs/${clubId}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }, { ageGroup: 'U16', gender: 'MIXED' }] } })).status, 200);
  const squads = W.squads.filter(squad => squad.clubId === clubId), child = W.newId();
  W.people.push({ id: child, fullName: 'Fixture traveller', birthYear: 2013 }); squads[0].playerIds.push(child);
  const startsAt = new Date(Date.now() + 86400000).toISOString(), endsAt = new Date(Date.now() + 90000000).toISOString();
  const draft = { title: 'Fixture journey', timezone: 'Asia/Tbilisi', currency: 'GEL', budgetMinor: 50000, startsAt, endsAt,
    destination: 'Away ground', meetingPoint: 'Club entrance', collectionPoint: 'Club entrance', supervisionContact: 'Coaching team',
    familyMessage: 'Frozen family instructions', privateNotes: 'Private working notes', participants: [child], places: [],
    activities: [{ key: 'activity', title: 'Away training', kind: 'ACTIVITY', startsAt, endsAt, placeKey: null, eventId: null, sessionId: null, notes: '' }],
    arrangements: [{ key, kind: 'TRANSPORT', title: 'Minibus estimate', placeKey: null, amountMinor: 15000, notes: 'Estimate only', financeRecordId: null }] };
  const made = await call('POST', '/map/plans', owner, { clubId, squadId: squads[0].id, requestId: randomUUID(), draft });
  assert.equal(made.status, 201);
  return { owner, clubId, squads, child, state: stateFor(clubId), plan: made.body };
}
const read = async c => { const response = await call('GET', `/map/plans/${c.plan.id}`, c.owner); assert.equal(response.status, 200); return response.body; };
const supplier = (c, payload, actor = c.owner) => call('POST', `/map/plans/${c.plan.id}/supplier`, actor, payload);

for (const status of ['PENDING', 'CONFIRMED', 'DECLINED']) test(`stores and reads back ${status} operator evidence once with the server actor, fingerprint and history`, async () => {
  const c = await fixture(), before = await read(c);
  const saved = await supplier(c, { revision: 1, ...answer, status, actor: -1, at: 'forged', fingerprint: 'forged' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.revision, 2, 'a successful supplier command must advance the plan');
  const record = saved.body.suppliers.transport;
  assert.equal(record.status, status); assert.equal(record.source, answer.source); assert.equal(record.evidence, answer.evidence);
  assert.equal(record.actor, c.owner.id); assert.ok(Number.isFinite(Date.parse(record.at))); assert.match(record.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual((await read(c)).suppliers.transport, record, 'GET must read the saved answer');
  assert.deepEqual(saved.body.draft, before.draft); assert.equal(saved.body.published_version, 0); assert.equal(saved.body.trip, null);
  assert.equal(saved.body.history[0].action, 'SUPPLIER_EVIDENCE'); assert.equal(saved.body.history[0].revision, 2);
  assert.equal(saved.body.history[0].note, `${status}: Minibus estimate`); assert.equal(saved.body.history[0].actor, c.owner.fullName);
});

test('validates the exact Java supplier bounds and arrangement membership without changing state on refusal', async () => {
  const c = await fixture(), before = structuredClone(F.planById(c.plan.id));
  const invalid = [
    { arrangementKey: '' }, { arrangementKey: ' ' }, { arrangementKey: 'k'.repeat(81) }, { arrangementKey: 'not-in-this-plan' },
    { status: 'REVIEW_REQUIRED' }, { status: null }, { status: 'confirmed' },
    { source: '' }, { source: ' \n ' }, { source: 's'.repeat(161) }, { source: 12 },
    { evidence: '' }, { evidence: '\t' }, { evidence: 'e'.repeat(2001) }, { evidence: {} },
  ];
  for (const value of invalid) {
    assert.equal((await supplier(c, { revision: 1, ...answer, ...value })).status, 400, JSON.stringify(value));
    assert.deepEqual(F.planById(c.plan.id), before);
  }
  const bounded = await fixture('k'.repeat(80));
  const result = await supplier(bounded, { revision: 1, arrangementKey: 'k'.repeat(80), status: 'CONFIRMED', source: 's'.repeat(160), evidence: 'e'.repeat(2000) });
  assert.equal(result.status, 200); assert.equal(result.body.suppliers['k'.repeat(80)].evidence.length, 2000);
});

test('preserves current exact TRAVEL write authority without accepting finance, coaching, expired or other-squad grants', async () => {
  const c = await fixture(), travel = account('Travel writer'), finance = account('Finance writer'), reader = account('Travel reader');
  const wrongSquad = account('Other squad travel'), expired = account('Expired travel'), coach = account('Current coach'), outsider = account('Unrelated actor');
  const grant = appointment(c, travel, [c.squads[0]], ['TRAVEL:WRITE']);
  appointment(c, finance, [c.squads[0]], ['FINANCE:WRITE']); appointment(c, reader, [c.squads[0]], ['TRAVEL:READ']);
  appointment(c, wrongSquad, [c.squads[1]], ['TRAVEL:WRITE']); appointment(c, expired, [c.squads[0]], ['TRAVEL:WRITE'], { ends_on: '2000-01-02' });
  c.squads[0].headCoachId = coach.id;
  const before = structuredClone(F.planById(c.plan.id));
  for (const actor of [finance, reader, wrongSquad, expired, coach, outsider]) {
    assert.equal((await supplier(c, { revision: 1, ...answer }, actor)).status, 403);
    assert.deepEqual(F.planById(c.plan.id), before);
  }
  assert.equal((await supplier(c, { revision: 1, ...answer }, travel)).status, 200);
  const after = structuredClone(F.planById(c.plan.id)); grant.status = 'ENDED';
  assert.equal((await supplier(c, { revision: after.revision, ...answer }, travel)).status, 403);
  assert.deepEqual(F.planById(c.plan.id), after);
});

test('serializes competing revisions and refuses stale or retired answers without replacing the winning evidence', async () => {
  const c = await fixture();
  const replies = await Promise.all([
    supplier(c, { revision: 1, ...answer, status: 'CONFIRMED' }), supplier(c, { revision: 1, ...answer, status: 'DECLINED' }),
  ]);
  assert.deepEqual(replies.map(result => result.status).sort(), [200, 409]);
  const winner = await read(c);
  assert.equal(winner.revision, 2); assert.equal(winner.history.filter(row => row.action === 'SUPPLIER_EVIDENCE').length, 1);
  for (const revision of [0, 1, '2', null]) assert.equal((await supplier(c, { revision, ...answer, evidence: 'Stale overwrite' })).status, 409);
  assert.deepEqual(await read(c), winner);
});

test('keeps independent budget approval, financial records and the itinerary intact when evidence is recorded', async () => {
  const c = await fixture(), reviewer = account('Independent finance reviewer');
  appointment(c, reviewer, [c.squads[0]], ['FINANCE:WRITE']);
  c.state.records.push({ id: W.newId(), club_id: c.clubId, squad_id: c.squads[0].id, module: 'FINANCE', kind: 'BUDGET', status: 'APPROVED', data: { privateInvoice: 'Finance-only record' } });
  assert.equal((await call('POST', `/map/plans/${c.plan.id}/approve-budget`, reviewer, { revision: 1 })).status, 200);
  const before = await read(c), ledger = structuredClone(c.state.records), editor = F.planById(c.plan.id).last_editor;
  const result = await supplier(c, { revision: before.revision, ...answer, status: 'CONFIRMED' });
  assert.equal(result.status, 200); assert.equal(result.body.revision, before.revision + 1);
  assert.equal(result.body.budgetApproved, true); assert.equal(result.body.approvedBy, reviewer.id);
  assert.deepEqual(result.body.draft, before.draft); assert.equal(result.body.totalMinor, before.totalMinor);
  assert.deepEqual(c.state.records, ledger); assert.equal(F.planById(c.plan.id).last_editor, editor);
  assert.equal(JSON.stringify(result.body).includes('Finance-only record'), false);
});

test('retains the frozen family version and response while private evidence changes, without adding recipients or exposing staff notes', async () => {
  const c = await fixture(), guardian = account('Fixture guardian'), other = account('Other guardian');
  guardian.children = [{ id: c.child, name: 'Own child' }];
  assert.equal((await call('POST', `/map/plans/${c.plan.id}/publish`, c.owner, { revision: 1 })).status, 200);
  assert.equal((await call('POST', `/journeys/${c.plan.id}/reply`, guardian, { version: 1, subjectId: c.child, response: 'GOING' })).status, 200);
  const before = (await call('GET', '/map/plans/family', guardian)).body;
  const plan = await read(c), publication = structuredClone(plan.published), records = structuredClone(c.state.records);
  assert.equal((await supplier(c, { revision: 1, ...answer, evidence: 'Private supplier reference' })).status, 200);
  const saved = await read(c);
  assert.equal(saved.published_version, 1); assert.equal(saved.published_revision, 1); assert.deepEqual(saved.published, publication);
  assert.deepEqual((await call('GET', '/map/plans/family', guardian)).body, before); assert.deepEqual(c.state.records, records);
  assert.equal(JSON.stringify(before).includes('Private supplier reference'), false);
  assert.deepEqual((await call('GET', '/map/plans/family', other)).body, []);
  assert.equal((await supplier(c, { revision: saved.revision, ...answer }, guardian)).status, 403);
  guardian.children = [];
  assert.deepEqual((await call('GET', '/map/plans/family', guardian)).body, []);
  assert.equal((await call('POST', `/journeys/${c.plan.id}/reply`, guardian, { version: 1, subjectId: c.child, response: 'GOING' })).status, 403);
});

test('projects evidence as REVIEW_REQUIRED only when that arrangement changes and hides removed arrangements without rewriting stored evidence', async () => {
  const c = await fixture();
  const recorded = await supplier(c, { revision: 1, ...answer, status: 'CONFIRMED' });
  assert.equal(recorded.status, 200);
  const original = structuredClone(F.planById(c.plan.id).suppliers.transport), draft = recorded.body.draft;
  const renamed = await call('PUT', `/map/plans/${c.plan.id}`, c.owner, { revision: recorded.body.revision, draft: { ...draft, title: 'Renamed journey', arrangements: draft.arrangements.map(item => Object.fromEntries(Object.entries(item).reverse())) } });
  assert.equal(renamed.body.suppliers.transport.status, 'CONFIRMED', 'field order and unrelated title do not change arrangement identity');
  const changed = await call('PUT', `/map/plans/${c.plan.id}`, c.owner, { revision: renamed.body.revision, draft: { ...draft, arrangements: [{ ...draft.arrangements[0], notes: 'Different supplier terms' }] } });
  assert.equal(changed.body.suppliers.transport.status, 'REVIEW_REQUIRED');
  assert.deepEqual(F.planById(c.plan.id).suppliers.transport, original); assert.equal(changed.body.suppliers.transport.fingerprint, original.fingerprint);
  const removed = await call('PUT', `/map/plans/${c.plan.id}`, c.owner, { revision: changed.body.revision, draft: { ...draft, arrangements: [] } });
  assert.deepEqual(removed.body.suppliers, {}); assert.deepEqual(F.planById(c.plan.id).suppliers.transport, original);
  const restored = await call('PUT', `/map/plans/${c.plan.id}`, c.owner, { revision: removed.body.revision, draft });
  assert.equal(restored.body.suppliers.transport.status, 'CONFIRMED');
});

test('supports an otherwise valid __proto__ arrangement key as data without changing object prototypes', async () => {
  const c = await fixture('__proto__');
  const saved = await supplier(c, { revision: 1, ...answer, arrangementKey: '__proto__' });
  assert.equal(saved.status, 200); assert.equal(Object.hasOwn(saved.body.suppliers, '__proto__'), true);
  assert.equal((await read(c)).suppliers.__proto__.source, answer.source);
  assert.equal(Object.getPrototypeOf(F.planById(c.plan.id).suppliers), Object.prototype);
  assert.equal({}.evidence, undefined);
});
