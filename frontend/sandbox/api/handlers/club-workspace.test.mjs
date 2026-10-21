import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../router.mjs';
import { createAccount, accessToken } from '../viewer.mjs';
import { createPage, clubPage } from '../pages-data.mjs';
import * as C from '../world-club.mjs';
import { stateFor } from './workspace-context.mjs';
const owner = createAccount({ fullName: 'Workspace owner', email: 'workspace@example.test', password: 'local-test', dateOfBirth: '1990-01-01' });
const other = createAccount({ fullName: 'Other owner', email: 'other-workspace@example.test', password: 'local-test', dateOfBirth: '1990-01-01' });
const clubId = createPage(owner.id, { pageKind: 'CLUB', displayName: 'Workspace isolation academy' }).body.clubId;
const otherClub = createPage(other.id, { pageKind: 'CLUB', displayName: 'Other workspace academy' }).body.clubId;
const headers = actor => ({ authorization: `Bearer ${accessToken(actor)}` });
const call = (method, path, actor = owner.id, body, extra = {}) => handleApi({ method, path, body, headers: { ...headers(actor), ...extra }, query: new URLSearchParams() });
test('new club has its own bootstrap, squad list and empty work queue', async () => {
  const boot = await call('GET', `/clubs/${clubId}/operations`);
  assert.equal(boot.status, 200); assert.equal(boot.body.clubId, clubId); assert.equal(boot.body.actorId, owner.id); assert.equal(boot.body.leadership, true);
  assert.deepEqual(boot.body.people, []); assert.deepEqual(boot.body.sessions, []); assert.deepEqual(boot.body.links, []);
  assert.deepEqual(boot.body.staff.map(p => p.id), [owner.id]);
  const roles = await call('GET', `/clubs/${clubId}/workspace-roles`);
  assert.equal(roles.status, 200); assert.deepEqual(roles.body.squads, []); assert.deepEqual(roles.body.requests, []); assert.deepEqual(roles.body.invitations, []);
  assert.deepEqual((await call('GET', `/clubs/${clubId}/workspace-roles/work`)).body, []);
  assert.deepEqual((await call('GET', `/clubs/${clubId}/management/applications`)).body, []);
});
test('created operational work stays in its club and cannot be read or mutated across clubs', async () => {
  const payload = { kind: 'ASSET', title: 'First match balls', squadId: null, data: { category: 'BALL', quantity: '3' } };
  const saved = await call('POST', `/clubs/${clubId}/operations/records`, owner.id, payload);
  assert.equal(saved.status, 201); assert.equal(saved.body.club_id, clubId);
  const id = saved.body.id;
  assert.equal((await call('GET', `/clubs/${clubId}/operations/records/${id}`)).body.id, id);
  assert.equal((await call('GET', `/clubs/${otherClub}/operations/records/${id}`, other.id)).status, 404);
  assert.equal((await call('GET', `/clubs/${clubId}/operations/records/${id}`, other.id)).status, 403);
  assert.equal((await call('PUT', `/clubs/${clubId}/operations/records/${id}`, other.id, { ...payload, revision: 0 })).status, 403);
  assert.equal((await call('POST', `/clubs/${otherClub}/operations/records`, other.id, { ...payload, squadId: C.squads[0].id })).status, 400);
  const edit = await call('PUT', `/clubs/${clubId}/operations/records/${id}`, owner.id, { ...payload, title: 'Five match balls', revision: 0 });
  assert.equal(edit.body.revision, 1);
  assert.equal((await call('PUT', `/clubs/${clubId}/operations/records/${id}`, owner.id, { ...payload, revision: 0 })).status, 409);
  assert.equal((await call('GET', `/clubs/${otherClub}/operations/records/${C.records[0].id}`, other.id)).status, 404);
});
test('registered account cannot borrow Dinamo data or staff authority', async () => {
  for (const path of ['/operations', '/workspace-roles', '/workspace-roles/work', '/management/applications', '/player-cards'])
    assert.equal((await call('GET', `/clubs/1${path}`)).status, 403, path);
  assert.equal((await call('POST', '/clubs/1/operations/records', owner.id, { kind: 'OBSERVATION', title: 'Other club', data: {} })).status, 403);
});
test('member and analyst access stay limited on reads, writes and direct record URLs', async () => {
  const member = { cookie: 'gk-sandbox-persona=member' }, analyst = { cookie: 'gk-sandbox-persona=analyst' };
  const boot = await call('GET', '/clubs/1/operations', C.ME, undefined, member);
  assert.deepEqual(boot.body.modules, []); assert.deepEqual((await call('GET', '/clubs/1/workspace-roles/work', C.ME, undefined, member)).body, []);
  assert.equal((await call('POST', '/clubs/1/operations/records', C.ME, { kind: 'ASSET', title: 'Blocked', data: {} }, member)).status, 403);
  const finance = C.records.find(r => r.module === 'FINANCE');
  assert.equal((await call('GET', `/clubs/1/operations/records/${finance.id}`, C.ME, undefined, analyst)).status, 404);
  const restriction = C.records.find(r => r.module === 'AVAILABILITY' && C.myCoaching.squad_ids.includes(r.squad_id));
  const read = await call('GET', `/clubs/1/operations/records/${restriction.id}`, C.ME, undefined, analyst);
  assert.equal(read.body.canEdit, false); assert.deepEqual(read.body.transitions, []);
  assert.equal((await call('PUT', `/clubs/1/operations/records/${restriction.id}`, C.ME, { kind: restriction.kind, title: restriction.title, data: restriction.data, revision: restriction.revision }, analyst)).status, 403);
});
test('membership alone never grants leadership', async () => {
  clubPage(clubId).staff.set(other.id, 'COACH');
  const boot = await call('GET', `/clubs/${clubId}/operations`, other.id);
  assert.equal(boot.body.leadership, false); assert.deepEqual(boot.body.modules, []);
  assert.equal((await call('PUT', `/clubs/${clubId}/operations/settings`, other.id, { revision: 0 })).status, 403);
  assert.equal((await call('POST', `/clubs/${clubId}/workspace-roles/assignments`, other.id, { userId: owner.id, roleKey: 'HEAD_COACH', clubWide: true })).status, 403);
});
test('staff invitation is visible to its person and grants access only after acceptance', async () => {
  const staff = createAccount({ fullName: 'New staff adult', email: 'staff-workspace@example.test', password: 'local-test', dateOfBirth: '1995-01-01' });
  const invited = await call('POST', `/clubs/${clubId}/operations/appointments`, owner.id, { userId: staff.id, title: 'Training coach', specialisations: ['HEAD_COACH'], clubWide: true, permissions: ['DEVELOPMENT:READ'], startsOn: C.date(0) });
  assert.equal(invited.status, 201); assert.equal((await call('GET', `/clubs/${clubId}/operations`, staff.id)).status, 403);
  const personal = await call('GET', '/club-operations/mine', staff.id);
  assert.equal(personal.body.appointments[0].id, invited.body.id);
  const accepted = await call('POST', `/clubs/${clubId}/operations/appointments/${invited.body.id}/transition`, staff.id, { revision: 0, status: 'ACTIVE' });
  assert.equal(accepted.status, 200); assert.equal(accepted.body.status, 'ACTIVE');
  const access = await call('GET', `/clubs/${clubId}/operations`, staff.id);
  assert.equal(access.body.leadership, false); assert.equal(access.body.modules[0].id, 'DEVELOPMENT'); assert.equal(access.body.modules[0].writable, false);
  const refused = await call('POST', `/clubs/${clubId}/operations/appointments`, owner.id, { userId: other.id, title: 'Other club owner', specialisations: ['HEAD_COACH'], clubWide: true, permissions: [], startsOn: C.date(0) });
  assert.equal(refused.status, 409);
});
test('single-session creation replays the same request and remains on the actual squad', async () => {
  const outsider = createAccount({ fullName: 'Schedule outsider', email: 'schedule-outsider@example.test', password: 'local-test', dateOfBirth: '1990-01-01' });
  const squad = await call('POST', `/clubs/${clubId}/squads`, owner.id, { name: 'U12 new academy', category: 'U12' });
  assert.equal(squad.status, 201);
  const path = `/squad-communication/${squad.body.id}/sessions`;
  const start = new Date(Date.now() + 864e5);
  const payload = { requestId: 'training-request-1', title: 'Evening training', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 90 * 60000).toISOString(), location: 'Confirmed school ground' };
  const saved = await call('POST', path, owner.id, payload), again = await call('POST', path, owner.id, payload);
  assert.equal(saved.status, 201); assert.equal(again.status, 200); assert.equal(again.body.id, saved.body.id);
  assert.equal((await call('POST', path, owner.id, { ...payload, title: 'Different session' })).status, 409);
  assert.equal((await call('POST', path, other.id, payload)).status, 403);
  assert.equal((await call('GET', path, outsider.id)).status, 403);
  assert.equal((await call('GET', path, other.id)).status, 403); // club membership without squad responsibilities
  const sessions = await call('GET', path);
  assert.equal(sessions.body.filter(s => s.id === saved.body.id).length, 1);
  const boot = await call('GET', `/clubs/${clubId}/operations`);
  assert.equal(boot.body.sessions.find(s => s.id === saved.body.id).squad_id, squad.body.id);
});
test('record UUID replay returns the current record and refuses changed original details', async () => {
  const key = '11111111-2222-4333-8444-555555555555', extra = { 'idempotency-key': key };
  const payload = { kind: 'ASSET', title: 'Replay match balls', squadId: null, data: { quantity: '3', category: 'BALL' } };
  const saved = await call('POST', `/clubs/${clubId}/operations/records`, owner.id, payload, extra);
  assert.equal(saved.status, 201);
  const edited = await call('PUT', `/clubs/${clubId}/operations/records/${saved.body.id}`, owner.id, { ...payload, title: 'Renamed match balls', revision: 0 });
  assert.equal(edited.status, 200);
  const replay = await call('POST', `/clubs/${clubId}/operations/records`, owner.id, { ...payload, data: { category: 'BALL', quantity: '3' } }, { 'idempotency-key': key.toUpperCase() });
  assert.equal(replay.status, 200); assert.equal(replay.body.id, saved.body.id); assert.equal(replay.body.title, 'Renamed match balls'); assert.equal(replay.body.revision, 1);
  assert.equal((await call('POST', `/clubs/${clubId}/operations/records`, owner.id, { ...payload, title: 'Changed request' }, extra)).status, 409);
  const otherSave = await call('POST', `/clubs/${otherClub}/operations/records`, other.id, payload, extra);
  assert.equal(otherSave.status, 201); assert.notEqual(otherSave.body.id, saved.body.id);
});
test('record UUID replay rechecks access and consumes a deleted record identity', async () => {
  const key = '99999999-2222-4333-8444-555555555555', extra = { 'idempotency-key': key };
  const payload = { kind: 'ASSET', title: 'Deleted replay', squadId: null, data: { category: 'BALL', quantity: '1' } };
  const saved = await call('POST', `/clubs/${clubId}/operations/records`, owner.id, payload, extra);
  assert.equal(saved.status, 201);
  assert.equal((await call('POST', `/clubs/${clubId}/operations/records`, other.id, payload, extra)).status, 403);
  const page = clubPage(clubId); page.staff.delete(owner.id); const previousOwner = page.ownerId; page.ownerId = null;
  assert.equal((await call('POST', `/clubs/${clubId}/operations/records`, owner.id, payload, extra)).status, 403);
  page.ownerId = previousOwner; page.staff.set(owner.id, 'OWNER');
  const records = stateFor(clubId).records; records.splice(records.findIndex(r => r.id === saved.body.id), 1);
  assert.equal((await call('POST', `/clubs/${clubId}/operations/records`, owner.id, payload, extra)).status, 409);
});

