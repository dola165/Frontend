import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as C from '../world-club.mjs';
import * as P from '../pages-data.mjs';
import { handleApi } from '../router.mjs';
import { stateFor, workspaceContext } from './workspace-context.mjs';
import { squadAccess } from '../squad-access.mjs';

let accountNumber = 0;
const account = name => V.createAccount({ fullName: name, email: `page-session-${++accountNumber}@example.test`, password: 'synthetic-only', dateOfBirth: '1990-01-01' });
const headers = actor => ({ authorization: `Bearer ${V.accessToken(actor.id)}`, cookie: `gk-sandbox-user=${actor.id}; gk-sandbox-family=1` });
const call = (path, actor, method = 'GET', body, query = {}, extra = {}) => handleApi({ method, path, headers: { ...headers(actor), ...extra }, body, query: new URLSearchParams(query) });
const owner = account('Page session owner'), parent = account('Invited family'), other = account('Uninvited family');
const page = P.createPage(owner.id, { pageKind: 'CLUB', displayName: 'Page session boundary' });
assert.equal(page.status, 200);
const clubId = page.body.clubId;
async function child(actor, key) {
  const response = await call('/family/children', actor, 'POST', { fullName: `Synthetic child ${key}`, dateOfBirth: '2014-01-01', responsible: true, requestId: `session-${actor.id}-${key}` });
  assert.equal(response.status, 201); return response.body.childId;
}
const invited = await child(parent, 'invited'), uninvited = await child(other, 'uninvited'), sibling = await child(parent, 'sibling');
const squad = { id: W.newId(), clubId, name: 'Page U12', ageGroup: 'U12', gender: 'MIXED', headCoachId: null, playerIds: [invited, uninvited, sibling], format: '7v7', trainingDays: [], trainingTime: null };
W.squads.push(squad);
const path = `/squad-communication/${squad.id}/sessions`;
const plan = await call(`/squad-communication/${squad.id}/events`, owner, 'POST', { requestId: 'page-club-frozen-plan', title: 'Private page training', eventType: 'TRAINING',
  startsAt: '2099-09-21T14:00:00.000Z', endsAt: '2099-09-21T15:30:00.000Z', timezone: 'Asia/Tbilisi', location: 'Synthetic ground', playerIds: [invited], requestResponses: true,
  repeat: { endDate: '2099-10-04', intervalWeeks: 1, daysOfWeek: ['MONDAY', 'THURSDAY'] } });
assert.equal(plan.status, 200);
const ids = new Set(plan.body.sessionIds), window = { from: '2099-09-20', to: '2099-10-05' };
assert.equal(ids.size, 4);
const read = (actor, query = {}, extra) => call(path, actor, 'GET', undefined, { ...window, ...query }, extra);
const privateRows = response => Array.isArray(response.body) ? response.body.filter(row => ids.has(row.id)) : [];

test('page-club reader preserves the actual series, response request and frozen attendance', async () => {
  const response = await read(owner); assert.equal(response.status, 200);
  const rows = privateRows(response); assert.equal(rows.length, 4);
  for (const row of rows) {
    const event = W.events.find(event => event.id === row.id);
    assert.equal(row.series_id, event.seriesId); assert.equal(row.response_requested, true);
    assert.deepEqual(row.attendance.map(player => player.id), [invited]);
  }
});
test('an invited page-club guardian reads the frozen child audience only', async () => {
  const response = await read(parent, { playerId: String(invited) }); assert.equal(response.status, 200);
  assert.equal(privateRows(response).length, 4);
  for (const row of privateRows(response)) assert.deepEqual(row.attendance.map(player => player.id), [invited]);
});
test('current squad membership does not give an uninvited guardian private sessions', async () => {
  const response = await read(other); assert.equal(privateRows(response).length, 0);
});
test('a forged other-child filter is denied before session data is returned', async () => {
  const response = await read(other, { playerId: String(invited) }); assert.equal(response.status, 403); assert.equal(privateRows(response).length, 0);
});
test('selecting a current uninvited sibling does not inherit the invited sibling sessions', async () => {
  const response = await read(parent, { playerId: String(sibling) }); assert.equal(privateRows(response).length, 0);
});
test('a later roster child is not added to the frozen page-club invitation', async () => {
  const laterParent = account('Later family'), later = await child(laterParent, 'later'); squad.playerIds.push(later);
  try { assert.equal(privateRows(await read(laterParent)).length, 0); }
  finally { squad.playerIds = squad.playerIds.filter(id => id !== later); }
});
test('current roster removal revokes the invited guardian even with a current sibling', async () => {
  const roster = squad.playerIds; squad.playerIds = roster.filter(id => id !== invited);
  try { assert.equal(privateRows(await read(parent)).length, 0); assert.equal((await read(parent, { playerId: String(invited) })).status, 403); }
  finally { squad.playerIds = roster; }
});
test('current family-link removal revokes the invitation without borrowing an old cookie', async () => {
  const actor = V.account(parent.id), children = actor.children; actor.children = children.filter(child => child.id !== invited);
  try { assert.equal(privateRows(await read(parent)).length, 0); }
  finally { actor.children = children; }
});
test('stale coach/person cookies do not turn an unrelated guardian into staff', async () => {
  const response = await read(other, {}, { cookie: `gk-sandbox-user=${owner.id}; gk-sandbox-persona=coach; gk-sandbox-family=1` });
  assert.equal(privateRows(response).length, 0);
});
test('the page-club reader retains a saved response and its reason', async () => {
  const id = [...ids][0];
  const changed = await call(`${path}/${id}/attendance`, parent, 'PUT', { playerId: invited, response: 'NOT_GOING', reason: 'Synthetic absence' });
  assert.equal(changed.status, 200);
  const row = privateRows(await read(parent)).find(row => row.id === id);
  assert.equal(row.attendance[0].response, 'NOT_GOING'); assert.equal(row.attendance[0].reason, 'Synthetic absence');
});
test('confirmed module READ retains scoped sessions without granting management/writes and rechecks revocation', async () => {
  const staff = account('Scoped attendance reader');
  const offered = await call(`/clubs/${clubId}/operations/appointments`, owner, 'POST', { userId: staff.id, title: 'Attendance reader', specialisations: ['HEAD_COACH'], permissions: ['ATTENDANCE:READ'], startsOn: C.date(0), clubWide: false, squadIds: [squad.id] });
  assert.equal(offered.status, 201);
  assert.equal((await call(`/clubs/${clubId}/operations/appointments/${offered.body.id}/transition`, staff, 'POST', { status: 'ACTIVE', revision: 0 })).status, 200);
  const ctx = workspaceContext({ id: clubId }, headers(staff)); assert.equal(ctx.coaching.includes(squad.id), false);
  assert.ok(ctx.modules.some(module => module.id === 'ATTENDANCE' && module.readSquads.includes(squad.id)));
  assert.equal(squadAccess(squad, headers(staff)), null);
  const ordinary = await call(path, owner, 'POST', { requestId: 'ordinary-module-read', title: 'Ordinary scoped session', startsAt: '2099-09-24T14:00:00Z', endsAt: '2099-09-24T15:00:00Z' });
  assert.equal(ordinary.status, 201);
  const response = await read(staff); assert.equal(response.status, 200); assert.equal(privateRows(response).length, 4);
  assert.deepEqual(privateRows(response)[0].attendance.map(player => player.id), [invited]);
  assert.ok(response.body.some(row => row.id === ordinary.body.id));
  assert.equal((await call(path, staff, 'POST', { requestId: 'reader-must-not-create', title: 'Denied reader write', startsAt: '2099-09-21T14:00:00Z', endsAt: '2099-09-21T15:00:00Z' })).status, 403);
  const appointment = stateFor(clubId).appointments.find(item => item.id === offered.body.id); const previous = appointment.status; appointment.status = 'ENDED';
  try { assert.equal((await read(staff)).status, 403); }
  finally { appointment.status = previous; }
});
test('ordinary single-session replay and existing programme occurrences remain available', async () => {
  const start = new Date(Date.now() + 864e5), body = { requestId: 'page-single-replay', title: 'One saved session', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(), location: 'Synthetic ground' };
  const first = await call(path, owner, 'POST', body), again = await call(path, owner, 'POST', body);
  assert.equal(first.status, 201); assert.equal(again.status, 200); assert.equal(first.body.id, again.body.id);
  assert.equal(first.body.series_id, null);
  assert.equal(first.body.response_requested, false); assert.equal(W.events.find(event => event.id === first.body.id).visibility, 'PRIVATE');
  squad.trainingDays = [1]; squad.trainingTime = '17:00';
  const legacy = P.trainingOf(P.clubPage(clubId), squad.id); assert.ok(legacy.length > 0);
  const result = await call(path, owner);
  assert.equal(result.status, 200); assert.equal(result.body.filter(row => row.id === first.body.id).length, 1);
  assert.equal(result.body.find(row => row.id === first.body.id).series_id, null);
  assert.ok(result.body.some(row => legacy.some(item => item.id === row.id)));
});
test('saved absence reasons stay with the owning family and authorized staff', async () => {
  const saved = await call(`/squad-communication/${squad.id}/events`, owner, 'POST', { requestId: 'page-two-family-session', title: 'Two-family invitation', eventType: 'TRAINING',
    startsAt: '2099-09-23T14:00:00.000Z', endsAt: '2099-09-23T15:00:00.000Z', timezone: 'Asia/Tbilisi', location: 'Synthetic ground', playerIds: [invited, uninvited], requestResponses: true });
  assert.equal(saved.status, 200); const id = saved.body.sessionIds[0];
  assert.equal((await call(`${path}/${id}/attendance`, other, 'PUT', { playerId: uninvited, response: 'NOT_GOING', reason: 'Other family synthetic reason' })).status, 200);
  const staffRow = (await read(owner)).body.find(row => row.id === id);
  assert.equal(staffRow.attendance.find(player => player.id === uninvited).reason, 'Other family synthetic reason');
  const ownRow = (await read(other, { playerId: String(uninvited) })).body.find(row => row.id === id);
  assert.deepEqual(ownRow.attendance.map(player => player.id), [uninvited]);
  assert.equal(ownRow.attendance.find(player => player.id === uninvited).reason, 'Other family synthetic reason');
  const otherRow = (await read(parent, { playerId: String(invited) })).body.find(row => row.id === id);
  assert.deepEqual(otherRow.attendance.map(player => player.id), [invited]);
  assert.equal(otherRow.attendance.find(player => player.id === uninvited)?.reason ?? null, null);
});
test('a selected current child narrows the DTO when both siblings are invited', async () => {
  const saved = await call(`/squad-communication/${squad.id}/events`, owner, 'POST', { requestId: 'page-two-own-children', title: 'Two own children', eventType: 'TRAINING',
    startsAt: '2099-09-25T14:00:00.000Z', endsAt: '2099-09-25T15:00:00.000Z', timezone: 'Asia/Tbilisi', location: 'Synthetic ground', playerIds: [invited, sibling], requestResponses: true });
  assert.equal(saved.status, 200); const id = saved.body.sessionIds[0];
  const row = (await read(parent, { playerId: String(invited) })).body.find(row => row.id === id);
  assert.deepEqual(row.attendance.map(player => player.id), [invited]);
});
test('a current invited player reads their own active participation without family/staff impersonation', async () => {
  const self = account('Invited player self'); squad.playerIds.push(self.id);
  try {
    const saved = await call(`/squad-communication/${squad.id}/events`, owner, 'POST', { requestId: 'page-self-invitation', title: 'Self invitation', eventType: 'TRAINING',
      startsAt: '2099-09-26T14:00:00.000Z', endsAt: '2099-09-26T15:00:00.000Z', timezone: 'Asia/Tbilisi', location: 'Synthetic ground', playerIds: [self.id], requestResponses: true });
    assert.equal(saved.status, 200); const id = saved.body.sessionIds[0];
    const result = await read(self, { playerId: String(self.id) }); assert.equal(result.status, 200);
    const row = result.body.find(row => row.id === id); assert.ok(row); assert.deepEqual(row.attendance.map(player => player.id), [self.id]);
  } finally { squad.playerIds = squad.playerIds.filter(id => id !== self.id); }
});
test('reply and cancellation boundaries remain separate from read access and cancellation metadata survives', async () => {
  const id = [...ids][1], event = W.events.find(event => event.id === id), revision = event.revision ?? 1;
  assert.equal((await call(`${path}/${id}/attendance`, other, 'PUT', { playerId: invited, response: 'GOING' })).status, 403);
  assert.equal((await call(`${path}/${id}/attendance`, parent, 'PUT', { playerId: sibling, response: 'GOING' })).status, 403);
  assert.equal((await call(`${path}/${id}/cancel`, parent, 'POST', { revision, reason: 'Denied family cancellation', requestId: 'parent-cannot-cancel' })).status, 403);
  assert.equal(event.cancelled, undefined);
  assert.equal((await call(`${path}/${id}/cancel`, owner, 'POST', { revision, reason: 'Synthetic staff cancellation', requestId: 'owner-cancel-once' })).status, 200);
  const row = privateRows(await read(parent)).find(row => row.id === id);
  assert.equal(row.status, 'CANCELLED'); assert.equal(row.cancellation_reason, 'Synthetic staff cancellation'); assert.equal(row.revision, revision + 1);
});
test('a current uninvited page-club guardian does not gain private overview counts', async () => {
  const overview = async actor => (await call(`/squad-communication/${squad.id}`, actor)).body.attention.upcoming_sessions;
  const ownerBefore = await overview(owner), otherBefore = await overview(other);
  const start = new Date(Date.now() + 864e5);
  const saved = await call(`/squad-communication/${squad.id}/events`, owner, 'POST', { requestId: 'page-near-term-private', title: 'Private count boundary', eventType: 'TRAINING',
    startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(), timezone: 'Asia/Tbilisi', location: 'Synthetic ground', playerIds: [invited], requestResponses: true });
  assert.equal(saved.status, 200);
  assert.equal(await overview(owner), ownerBefore + 1); assert.equal(await overview(other), otherBefore);
});
