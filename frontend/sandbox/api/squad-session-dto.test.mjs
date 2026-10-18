import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from './world.mjs';
import * as V from './viewer.mjs';
import * as S from './world-social.mjs';
import * as P from './world-profile.mjs';
import { createPage, ownedPages } from './pages-data.mjs';
import { squadSessionDto, squadSessionForViewer, projectSquadSession } from './squad-session-dto.mjs';
import { squadAccess } from './squad-access.mjs';
import { handleApi } from './router.mjs';

const account = name => V.createAccount({ fullName: name, dateOfBirth: '1990-01-01' });
const headers = actor => ({ cookie: `gk-sandbox-user=${actor.id}; gk-sandbox-family=1` });
const event = (squad, invitedPlayerIds) => ({ id: W.newId(), clubId: squad.clubId, squadId: squad.id, type: 'TRAINING', title: 'Synthetic private invitation',
  start: new Date(Date.now() + 2 * 86400000), end: new Date(Date.now() + 2 * 86400000 + 90 * 60000), location: 'Synthetic school ground',
  invitedPlayerIds, invitationPlan: true, seriesId: 'squad-training-fixed-series', revision: 3, visibility: 'PRIVATE', publicationState: 'PRIVATE' });
function fixture() {
  const owner = account('Session DTO club owner');
  assert.equal(createPage(owner.id, { pageKind: 'CLUB', displayName: 'Synthetic session DTO club' }).status, 200);
  const page = ownedPages(owner.id).find(page => page.clubId), first = W.newId(), second = W.newId();
  const squad = { id: W.newId(), clubId: page.clubId, name: 'U12', ageGroup: 'U12', headCoachId: null, playerIds: [first, second] };
  W.squads.push(squad);
  const guardian = account('Session DTO invited guardian'), other = account('Session DTO other guardian');
  guardian.children = [{ id: first }]; other.children = [{ id: second }];
  const plan = event(squad, [first]); P.confirmation.set(plan.id, true);
  return { owner, squad, first, second, guardian, other, plan };
}

test('fresh private invitations have no invented legacy answers or absence reasons', () => {
  const squad = W.squadById(103), plan = { ...event(squad, [41, 42]), id: 94000 };
  assert.ok(plan.invitedPlayerIds.every(id => !S.sessionResponses.has(`${plan.id}:${id}`)));
  P.confirmation.set(plan.id, true);
  const dto = squadSessionDto(squad, plan);
  assert.deepEqual(dto.attendance.map(player => player.response), ['UNANSWERED', 'UNANSWERED']);
  assert.ok(dto.attendance.every(player => player.reason === null && player.recorded_by === null));
  assert.equal(dto.series_id, plan.seriesId); assert.equal(dto.response_requested, true);
});

test('a new page club keeps canonical series, reply flag and frozen attendance under current viewer authority', () => {
  const f = fixture(), staff = squadSessionForViewer(f.squad, f.plan, headers(f.owner));
  assert.equal(staff.id, f.plan.id); assert.equal(staff.series_id, f.plan.seriesId); assert.equal(staff.response_requested, true);
  assert.equal(staff.event_type, 'TRAINING'); assert.equal(staff.starts_at, f.plan.start.toISOString()); assert.equal(staff.revision, 3);
  assert.deepEqual(staff.attendance.map(player => player.id), [f.first]);
  assert.deepEqual(squadSessionForViewer(f.squad, f.plan, headers(f.guardian)).attendance.map(player => player.id), [f.first]);
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.other)), null);
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(account('Session DTO outsider'))), null);
  assert.equal(squadSessionForViewer(f.squad, { ...f.plan, clubId: 1 }, headers(f.owner)), null);
});

test('recorded answers and staff cancellation history survive while family output omits other participants', () => {
  const f = fixture(); f.plan.invitedPlayerIds = [f.first, f.second];
  S.sessionResponses.set(`${f.plan.id}:${f.first}`, 'GOING');
  S.sessionResponses.set(`${f.plan.id}:${f.second}`, 'NOT_GOING'); P.replyReasons.set(`${f.plan.id}:${f.second}`, 'Synthetic absence reason');
  f.plan.cancelled = 'Synthetic cancelled session';
  const staff = squadSessionForViewer(f.squad, f.plan, headers(f.owner));
  assert.deepEqual(staff.attendance.map(player => player.response), ['GOING', 'NOT_GOING']);
  assert.equal(staff.attendance[1].reason, 'Synthetic absence reason'); assert.equal(staff.status, 'CANCELLED');
  const family = squadSessionForViewer(f.squad, f.plan, headers(f.guardian));
  assert.deepEqual(family.attendance.map(player => player.id), [f.first]); assert.equal(family.attendance[0].response, 'GOING');
  assert.equal(family.cancellation_reason, f.plan.cancelled);
});

test('a sibling, later roster entry or removed child link never widens an existing invitation', () => {
  const f = fixture(); f.guardian.children.push({ id: f.second });
  assert.deepEqual(squadSessionForViewer(f.squad, f.plan, headers(f.guardian)).attendance.map(player => player.id), [f.first]);
  f.guardian.children = [{ id: f.second }];
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.guardian)), null);
  f.guardian.children = [{ id: f.first }, { id: f.second }]; f.squad.playerIds = [f.second];
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.guardian)), null);
  const later = W.newId(); f.squad.playerIds.push(later); f.other.children = [{ id: later }];
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.other)), null);
  assert.deepEqual(squadSessionForViewer(f.squad, f.plan, headers(f.owner)).attendance.map(player => player.id), [f.first]);
});

test('source options preserve real one-off identity, legacy grouping and existing metadata', () => {
  const f = fixture(), single = { ...event(f.squad, f.squad.playerIds), invitationPlan: false, responseRevision: 4,
    venue_reservation: { status: 'CONFIRMED', venueName: 'Synthetic venue' } };
  delete single.seriesId;
  const dto = squadSessionDto(f.squad, single, { source: 'SINGLE' });
  assert.equal(dto.series_id, null); assert.equal(dto.response_requested, false); assert.equal(dto.response_revision, 4);
  assert.deepEqual(dto.venue_reservation, single.venue_reservation); assert.ok(dto.attendance.every(player => player.response === 'UNANSWERED'));
  assert.equal(squadSessionDto(f.squad, single, { source: 'PROGRAMME' }).series_id, `squad-${f.squad.id}-training`);
  assert.equal(squadSessionDto(f.squad, { ...single, seriesId: null }).series_id, null);
  P.confirmation.set(single.id, true); S.sessionResponses.set(`${single.id}:${f.first}`, 'GOING');
  assert.equal(squadSessionDto(f.squad, single, { source: 'SINGLE' }).response_requested, true);
  assert.equal(squadSessionDto(f.squad, single, { source: 'SINGLE' }).attendance[0].response, 'GOING');
});

test('validated selected-child projection narrows both family and staff without granting a foreign child', () => {
  const f = fixture(); f.plan.invitedPlayerIds = [f.first, f.second]; f.guardian.children.push({ id: f.second });
  assert.deepEqual(squadSessionForViewer(f.squad, f.plan, headers(f.guardian), { selectedPlayerId: f.second }).attendance.map(player => player.id), [f.second]);
  assert.deepEqual(squadSessionForViewer(f.squad, f.plan, headers(f.owner), { selectedPlayerId: f.first }).attendance.map(player => player.id), [f.first]);
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.other), { selectedPlayerId: f.first }), null);
  f.plan.invitedPlayerIds = [f.first];
  assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.guardian), { selectedPlayerId: f.second }), null);
});

test('inactive participants remain staff history and family projection removes audit and visitor fields', () => {
  const f = fixture(); f.plan.invitedPlayerIds = [f.first, f.second]; f.guardian.children.push({ id: f.second });
  f.squad.playerIds = [f.second];
  const dto = { ...squadSessionDto(f.squad, f.plan), created_by: f.owner.id, request_id: 'synthetic-private-receipt', introductory_visitors: [{ id: 1 }] };
  assert.equal(dto.attendance[0].active, false);
  assert.strictEqual(projectSquadSession(f.squad, dto, squadAccess(f.squad, headers(f.owner))), dto);
  const family = projectSquadSession(f.squad, dto, squadAccess(f.squad, headers(f.guardian)));
  assert.deepEqual(family.attendance.map(player => player.id), [f.second]);
  assert.equal('created_by' in family, false); assert.equal('request_id' in family, false); assert.deepEqual(family.introductory_visitors, []);
});

const sessionQuery = plan => ({ from: new Date(plan.start.getTime() - 1000).toISOString(), to: new Date(plan.end.getTime() + 1000).toISOString() });
const read = (f, actor, query = {}) => handleApi({ method: 'GET', path: `/squad-communication/${f.squad.id}/sessions`, headers: headers(actor), query: new URLSearchParams({ ...sessionQuery(f.plan), ...query }) });
test('actual canonical page-club reads expose only active own rows and honor selected-child authority', async () => {
  const f = fixture(); f.plan.invitedPlayerIds = [f.first, f.second]; f.guardian.children.push({ id: f.second }); W.events.push(f.plan);
  try {
    const other = await read(f, f.other); assert.equal(other.status, 200); assert.deepEqual(other.body[0].attendance.map(player => player.id), [f.second]);
    const selected = await read(f, f.guardian, { playerId: String(f.first) });
    assert.equal(selected.status, 200); assert.deepEqual(selected.body[0].attendance.map(player => player.id), [f.first]);
    assert.equal((await read(f, f.other, { playerId: String(f.first) })).status, 403);
    f.squad.playerIds = [f.second];
    assert.deepEqual((await read(f, f.guardian)).body[0].attendance.map(player => player.id), [f.second]);
    const staff = await read(f, f.owner); assert.deepEqual(staff.body[0].attendance.map(player => player.id), [f.first, f.second]);
    assert.equal(staff.body[0].attendance[0].active, false);
  } finally { W.events.splice(W.events.indexOf(f.plan), 1); }
});

test('confirmed roster self-membership reads and replies only for that active invited self', async () => {
  const f = fixture(), self = account('Session DTO roster player'); f.squad.playerIds.push(self.id); f.plan.invitedPlayerIds.push(self.id); W.events.push(f.plan);
  const reply = playerId => handleApi({ method: 'PUT', path: `/squad-communication/${f.squad.id}/sessions/${f.plan.id}/attendance`, headers: headers(self), query: new URLSearchParams(), body: { playerId, response: 'GOING', revision: f.plan.revision } });
  try {
    const own = await read(f, self); assert.equal(own.status, 200); assert.deepEqual(own.body[0].attendance.map(player => player.id), [self.id]);
    assert.equal((await reply(f.first)).status, 403); assert.equal((await reply(self.id)).status, 200);
    f.squad.playerIds = f.squad.playerIds.filter(id => id !== self.id);
    assert.equal((await read(f, self)).status, 403); assert.equal((await reply(self.id)).status, 403);
  } finally { W.events.splice(W.events.indexOf(f.plan), 1); }
});

test('trusted scoped read projection grants no global management and cannot come from a client flag', async () => {
  const f = fixture(); W.events.push(f.plan);
  try {
    const access = squadAccess(f.squad, headers(f.other)); assert.equal(access.canManage, false);
    assert.deepEqual(squadSessionForViewer(f.squad, f.plan, headers(f.other), { staffRead: true }).attendance.map(player => player.id), [f.first]);
    assert.equal(squadSessionForViewer(f.squad, f.plan, headers(f.other), { staffRead: 'true' }), null);
    assert.equal(squadAccess(f.squad, headers(f.other)).canManage, false);
    const forged = await read(f, f.other, { staffRead: 'true' }); assert.equal(forged.status, 200); assert.deepEqual(forged.body, []);
    const denied = await handleApi({ method: 'PUT', path: `/squad-communication/${f.squad.id}/sessions/${f.plan.id}/attendance`, headers: headers(f.other), query: new URLSearchParams(), body: { playerId: f.first, response: 'GOING', staffRead: true } });
    assert.equal(denied.status, 403);
  } finally { W.events.splice(W.events.indexOf(f.plan), 1); }
});
