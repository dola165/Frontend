import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as V from './viewer.mjs';
import * as W from './world.mjs';
import { FAMILY, familyOf, familyRequest } from './world-family.mjs';
import { handleApi } from './router.mjs';
import { createPage, ownedPages } from './pages-data.mjs';

const account = name => V.createAccount({ fullName: name, email: `${name.replaceAll(' ', '.')}@example.test`, password: 'synthetic-only', dateOfBirth: '1990-01-01' });
const headers = a => ({ authorization: `Bearer ${V.accessToken(a.id)}`, cookie: `gk-sandbox-user=${a.id}; gk-sandbox-family=1` });
const request = (path, actor, method = 'GET', body) => handleApi({ method, path, headers: actor, query: new URLSearchParams(), body });

test('a stale parent cookie cannot replace a registered account with Luka’s fixture family', async () => {
  const own = account('New parent'), h = headers(own);
  assert.equal(familyRequest(h), false); assert.equal(familyOf(h), null);
  const created = await request('/family/children', h, 'POST', { fullName: 'Own synthetic child', dateOfBirth: '2015-01-01', responsible: true, requestId: 'family-privacy-child' });
  assert.equal(created.status, 201);
  const directory = await request('/joining/children', h);
  assert.deepEqual(directory.body.children.map(child => child.identity.fullName), ['Own synthetic child']);
  assert.ok(directory.body.children.every(child => !FAMILY.some(seed => seed.id === child.playerId)));
  const admissions = await request('/admissions/home', h);
  assert.equal(admissions.body.participants[0].id, own.id);
});
test('two registered families remain separate even with an explicit parent-mode cookie', async () => {
  const first = account('First guardian'), second = account('Second guardian');
  await request('/family/children', headers(first), 'POST', { fullName: 'First family child', dateOfBirth: '2014-02-03', responsible: true, requestId: 'first-child' });
  assert.equal(familyOf(headers(second)), null);
  assert.deepEqual(familyOf(headers(first)).map(child => child.name), ['First family child']);
  assert.equal(familyRequest({ cookie: 'gk-sandbox-family=1' }), true);
});
test('registered outsiders cannot read or mutate seeded squad communication or coach join requests', async () => {
  const outsider = headers(account('Squad outsider'));
  for (const path of ['/squad-communication/103', '/squad-communication/103/messages', '/squad-communication/103/sessions', '/squad-communication/103/join-link', '/squad-communication/103/join-requests']) {
    assert.equal((await request(path, outsider)).status, 403, path);
  }
  assert.equal((await request('/squad-communication/103/messages', outsider, 'POST', { kind: 'CHAT', body: 'Should be refused' })).status, 403);
  assert.equal((await request('/squad-communication', outsider)).body.length, 0);
});
test('a confirmed roster link opens only that guardian’s squad and own private thread', async () => {
  const guardian = account('Confirmed guardian'), h = headers(guardian);
  const created = await request('/family/children', h, 'POST', { fullName: 'Roster linked child', dateOfBirth: '2014-01-01', responsible: true, requestId: 'roster-child' });
  const squad = W.squadById(103); squad.playerIds.push(created.body.childId);
  try {
    const overview = await request('/squad-communication/103', h);
    assert.equal(overview.status, 200); assert.equal(overview.body.viewer_id, guardian.id); assert.equal(overview.body.can_manage, false);
    assert.deepEqual(overview.body.threads.map(thread => thread.user_id), [guardian.id]);
    assert.equal((await request('/squad-communication', h)).body[0].id, 103);
    const forged = await handleApi({ method: 'GET', path: '/squad-communication/103/messages', headers: h, query: new URLSearchParams({ kind: 'CHAT', threadUserId: String(W.ME_ID) }) });
    assert.equal(forged.status, 403);
    assert.equal((await request('/squad-communication/103/messages', h, 'POST', { kind: 'ANNOUNCEMENT', body: 'Staff only' })).status, 403);
    const posted = await request('/squad-communication/103/messages', h, 'POST', { requestId: 'guardian-private-message', kind: 'CHAT', threadUserId: guardian.id, body: 'My own guardian question' });
    assert.equal(posted.status, 201);
    const ownThread = await handleApi({ method: 'GET', path: '/squad-communication/103/messages', headers: h, query: new URLSearchParams({ kind: 'CHAT', threadUserId: String(guardian.id) }) });
    assert.equal(ownThread.body[0].author_id, guardian.id);
    assert.equal((await request(`/squad-communication/103/messages/${posted.body.id}/comments`, {})).status, 200);
    const otherGuardian = account('Other linked guardian'); otherGuardian.children = [{ id: squad.playerIds[0] }];
    assert.equal((await request(`/squad-communication/103/messages/${posted.body.id}/comments`, headers(otherGuardian))).status, 403);
  } finally { squad.playerIds = squad.playerIds.filter(id => id !== created.body.childId); }
});
test('training preview and commit use one private schedule and retry the same saved series', async () => {
  const squad = W.squadById(103), before = W.events.length;
  const plan = { requestId: 'private-training-series', title: 'Synthetic setup training', eventType: 'TRAINING', description: null,
    startsAt: '2099-09-21T14:00:00.000Z', endsAt: '2099-09-21T15:30:00.000Z', location: 'Synthetic school ground', timezone: 'Asia/Tbilisi',
    playerIds: [squad.playerIds[0]], requestResponses: false, repeat: { endDate: '2099-10-04', intervalWeeks: 1, daysOfWeek: ['MONDAY', 'THURSDAY'] } };
  const preview = await request('/squad-communication/103/events/preview', {}, 'POST', plan);
  assert.equal(preview.status, 200); assert.ok(preview.body.occurrences.length > 1); assert.equal(W.events.length, before);
  const saved = await request('/squad-communication/103/events', {}, 'POST', plan);
  assert.equal(saved.status, 200); assert.equal(saved.body.sessionIds.length, preview.body.occurrences.length);
  const retry = await request('/squad-communication/103/events', {}, 'POST', plan);
  assert.deepEqual(retry.body, saved.body); assert.equal(W.events.length, before + saved.body.sessionIds.length);
  const schedule = await handleApi({ method: 'GET', path: '/squad-communication/103/sessions', headers: {}, query: new URLSearchParams({ from: '2099-09-20', to: '2099-10-05' }) });
  assert.equal(schedule.body.length, saved.body.sessionIds.length); assert.equal(schedule.body[0].location, plan.location);
  assert.deepEqual(schedule.body[0].attendance.map(p => p.id), plan.playerIds);
  const publicTimetable = await request('/clubs/1/squads/103/training-schedule', {});
  assert.ok(publicTimetable.body.sessions.every(session => !saved.body.sessionIds.includes(Number(session.id))));
  assert.equal((await request('/squad-communication/103/events', {}, 'POST', { ...plan, location: 'Another ground' })).status, 409);
  for (let index = W.events.length - 1; index >= before; index--) W.events.splice(index, 1);
});
test('a stale parent cookie grants no right to preview or create a training plan', async () => {
  const outsider = headers(account('Training outsider'));
  assert.equal((await request('/squad-communication/103/events/preview', outsider, 'POST', {})).status, 403);
  assert.equal((await request('/squad-communication/103/events', outsider, 'POST', {})).status, 403);
});
test('a private training invitation stays with its frozen children when other families share the squad', async () => {
  const invitedGuardian = headers(account('Invited training guardian')), otherGuardian = headers(account('Uninvited training guardian'));
  const addChild = async (actor, fullName, requestId) => {
    const result = await request('/family/children', actor, 'POST', { fullName, dateOfBirth: '2014-01-01', responsible: true, requestId });
    assert.equal(result.status, 201);
    return result.body.childId;
  };
  const invitedChild = await addChild(invitedGuardian, 'Invited sibling', 'invited-training-child');
  const sibling = await addChild(invitedGuardian, 'Uninvited sibling', 'uninvited-training-sibling');
  const otherChild = await addChild(otherGuardian, 'Other family child', 'uninvited-training-child');
  const squad = W.squadById(103), originalPlayers = [...squad.playerIds], originalEvents = W.events.length;
  squad.playerIds.push(invitedChild, sibling, otherChild);
  const from = new Date(W.NOW.getTime() - 86400000).toISOString(), to = new Date(W.NOW.getTime() + 7 * 86400000).toISOString();
  const sessions = (actor, playerId) => handleApi({ method: 'GET', path: '/squad-communication/103/sessions', headers: actor,
    query: new URLSearchParams({ from, to, ...(playerId == null ? {} : { playerId: String(playerId) }) }) });
  try {
    const before = await sessions(otherGuardian);
    assert.equal(before.status, 200); assert.ok(before.body.length > 0, 'legacy squad sessions remain available');
    const overviewBefore = await request('/squad-communication/103', otherGuardian);
    const start = new Date(W.NOW); start.setUTCDate(start.getUTCDate() + 2); start.setUTCHours(10, 0, 0, 0);
    const plan = { requestId: 'fixed-family-training-audience', title: 'Invited family training', eventType: 'TRAINING', description: null,
      startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 90 * 60000).toISOString(), location: 'Private synthetic ground', timezone: 'Asia/Tbilisi',
      playerIds: [invitedChild], requestResponses: true, repeat: null };
    const saved = await request('/squad-communication/103/events', {}, 'POST', plan);
    assert.equal(saved.status, 200);
    const sessionId = saved.body.sessionIds[0], attendancePath = `/squad-communication/103/sessions/${sessionId}/attendance`;
    const staffView = await sessions({}), invitedView = await sessions(invitedGuardian), otherView = await sessions(otherGuardian);
    assert.ok(staffView.body.some(session => session.id === sessionId));
    assert.deepEqual(invitedView.body.find(session => session.id === sessionId).attendance.map(player => player.id), [invitedChild]);
    assert.deepEqual(otherView.body.map(session => session.id), before.body.map(session => session.id));
    assert.deepEqual((await request('/squad-communication/103', otherGuardian)).body.attention, overviewBefore.body.attention);
    assert.ok(!(await sessions(invitedGuardian, sibling)).body.some(session => session.id === sessionId));
    assert.equal((await sessions(otherGuardian, invitedChild)).status, 403, 'a child filter cannot impersonate another family');
    assert.equal((await request(attendancePath, otherGuardian, 'PUT', { playerId: otherChild, response: 'GOING' })).status, 403);
    assert.equal((await request(attendancePath, invitedGuardian, 'PUT', { playerId: sibling, response: 'GOING' })).status, 403, 'an invited sibling does not invite the whole family');
    assert.equal((await request(attendancePath, {}, 'PUT', { playerId: otherChild, response: 'GOING' })).status, 403, 'staff cannot answer for an uninvited child');
    const answered = await request(attendancePath, invitedGuardian, 'PUT', { playerId: invitedChild, response: 'GOING' });
    assert.equal(answered.status, 200); assert.equal(answered.body.attendance[0].response, 'GOING');
  } finally {
    squad.playerIds = originalPlayers;
    W.events.splice(originalEvents);
  }
});

test('a newly created club can plan its own squad training without borrowing Dinamo records', async () => {
  const owner = account('New club training owner'), h = headers(owner);
  assert.equal(createPage(owner.id, { pageKind: 'CLUB', displayName: 'Synthetic first training club' }).status, 200);
  const page = ownedPages(owner.id).find(item => item.clubId);
  const squad = { id: W.newId(), clubId: page.clubId, name: 'U10 Mixed', ageGroup: 'U10', gender: 'MIXED', headCoachId: null, playerIds: [], format: '7v7', trainingDays: [], trainingTime: null };
  W.squads.push(squad);
  const current = await request(`/squad-communication/${squad.id}/sessions`, h);
  assert.equal(current.status, 200); assert.deepEqual(current.body, []);
  const plan = { requestId: 'new-club-first-training', title: 'First training', eventType: 'TRAINING', description: null, startsAt: '2099-09-21T14:00:00.000Z', endsAt: '2099-09-21T15:30:00.000Z', location: 'Our own school ground', timezone: 'Asia/Tbilisi', playerIds: [], requestResponses: false, repeat: null };
  const preview = await request(`/squad-communication/${squad.id}/events/preview`, h, 'POST', plan);
  assert.equal(preview.status, 200); assert.equal(preview.body.notificationRecipients, 0);
  const saved = await request(`/squad-communication/${squad.id}/events`, h, 'POST', plan);
  assert.equal(saved.status, 200); assert.equal(saved.body.sessionIds.length, 1);
  const outsider = headers(account('Other club outsider'));
  assert.equal((await request(`/squad-communication/${squad.id}/events/preview`, outsider, 'POST', plan)).status, 403);
  assert.equal((await request(`/squad-communication/${squad.id}/sessions`, outsider)).status, 403);
});
