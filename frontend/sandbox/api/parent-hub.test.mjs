import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from './router.mjs';
import * as F from './world-football.mjs';
import * as W from './world.mjs';

const call = (method, at, body, cookie) => { const url = new URL('http://sandbox' + at); return handleApi({ method, path: url.pathname, query: url.searchParams, headers: cookie ? { cookie } : {}, body }); };
const ana = 'gk-sandbox-user=9601', nika = 'gk-sandbox-user=9602';
before(() => call('GET', '/__load'));

test('a parent of two sees both children, the club child in two squads with the club’s prices and fees', async () => {
  const { body } = await call('GET', '/joining/children', null, ana);
  const [giorgi, mariam] = body.children;
  assert.deepEqual(giorgi.clubs[0].squads.map(s => [s.name, s.price?.amount]), [['U12 Mixed', 150], ['U14 Boys', 170]]);
  assert.equal(giorgi.clubs[0].fees.lines.find(line => line.squadId === 103).label, 'Tournament entry · Rustavi Cup');
  assert.deepEqual(mariam.clubs, []);
  assert.equal((await call('GET', '/users/me', null, nika)).body.navigationCapabilities.workspaces[0].id, 'parent.hub');
});

// What a booking carries (the backend's FirstVisitBooking): the terms and the training the family saw.
const seen = (open, shown, requestId, playerId) => ({ requestId, playerId, session: shown.reference, groupVersion: open.groupVersion, startsAt: shown.startsAt, endsAt: shown.endsAt, place: shown.place });

test('a family books a first visit into Beginners, once, and the coach sees it in Want to join and on the session', async () => {
  const open = (await call('GET', '/admissions/groups/1301/first-visits', null, ana)).body;
  assert.equal(open.places, 3);
  const shown = open.sessions[0], session = shown.sessionId, requestId = 'f1d2c3b4-0000-4000-8000-000000000001';
  assert.equal(shown.reference, `session:${session}`);
  assert.equal((await call('POST', '/admissions/groups/1301/first-visits', seen(open, shown, requestId, 9611 + 99), ana)).status, 403);
  const booked = await call('POST', '/admissions/groups/1301/first-visits', seen(open, shown, requestId, 9612), ana);
  assert.equal(booked.status, 201);
  assert.equal(booked.body.sessions[0].status, 'CONFIRMED');
  assert.equal((await call('POST', '/admissions/groups/1301/first-visits', seen(open, shown, requestId, 9612), ana)).body.id, booked.body.id, 'a retry is the same booking');
  const left = (await call('GET', '/admissions/groups/1301/first-visits', null, ana)).body.sessions.find(s => s.sessionId === session);
  assert.equal(left.placesLeft, 2);
  const rows = (await call('GET', '/squad-communication/160/join-requests')).body;
  const visit = rows.find(row => row.source === 'VISIT' && row.caseId === booked.body.id);
  assert.equal(visit.childName, 'Mariam Beridze');
  const register = (await call('GET', `/squad-communication/160/sessions/${session}/introductory-visitors`)).body.visitors;
  assert.equal(register.find(v => v.caseId === booked.body.id).firstVisit, true);
  const changedGroup = await call('POST', `/squad-communication/160/join-requests/cases/${booked.body.id}`, { requestId: 'w', expectedVersion: 1, action: 'APPROVE', groupId: 1301, groupVersion: open.groupVersion - 1 });
  assert.equal(changedGroup.body.code, 'GROUP_CHANGED', 'the terms the coach saw');
  const decided = await call('POST', `/squad-communication/160/join-requests/cases/${booked.body.id}`, { requestId: 'x', expectedVersion: 1, action: 'APPROVE', groupId: 1301, groupVersion: open.groupVersion });
  assert.equal(decided.body.outcome, 'PLACE_OFFERED');
  const retried = await call('POST', `/squad-communication/160/join-requests/cases/${booked.body.id}`, { requestId: 'x', expectedVersion: 1, action: 'APPROVE', groupId: 1301, groupVersion: open.groupVersion });
  assert.equal(retried.body.outcome, 'PLACE_OFFERED', 'a retried answer gets its own outcome');
  const again = await call('POST', `/squad-communication/160/join-requests/cases/${booked.body.id}`, { requestId: 'y', expectedVersion: 2, action: 'DECLINE' });
  assert.equal(again.status, 409); assert.equal(again.body.code, 'ALREADY_ANSWERED');
});

test('a booking that saw other terms or another time is refused with what changed, and nothing is booked', async () => {
  const open = (await call('GET', '/admissions/groups/1301/first-visits', null, ana)).body, shown = open.sessions.at(-1);
  const stale = await call('POST', '/admissions/groups/1301/first-visits', { ...seen(open, shown, 'f1d2c3b4-0000-4000-8000-000000000002', 9612), groupVersion: open.groupVersion - 1 }, ana);
  assert.equal(stale.status, 409); assert.equal(stale.body.code, 'TERMS_CHANGED');
  const moved = await call('POST', '/admissions/groups/1301/first-visits', { ...seen(open, shown, 'f1d2c3b4-0000-4000-8000-000000000003', 9612), startsAt: new Date(Date.parse(shown.startsAt) - 3600000).toISOString() }, ana);
  assert.equal(moved.status, 409); assert.equal(moved.body.code, 'SESSION_CHANGED');
  assert.equal((await call('GET', '/admissions/groups/1301/first-visits', null, ana)).body.sessions.at(-1).placesLeft, shown.placesLeft);
});

test('a group that needs the current club’s permission reserves the visit, and the coach sees the clearance step', async () => {
  const group = F.groupById(1301), before = group.terms.requirements;
  group.terms.requirements = [...before, 'CURRENT_CLUB_PERMISSION'];
  try {
    const open = (await call('GET', '/admissions/groups/1301/first-visits', null, nika)).body, shown = open.sessions.at(-1);
    const reserved = await call('POST', '/admissions/groups/1301/first-visits', seen(open, shown, 'f1d2c3b4-0000-4000-8000-000000000004', (await call('GET', '/joining/children', null, nika)).body.children[0].playerId), nika);
    assert.equal(reserved.status, 201);
    assert.equal(reserved.body.sessions[0].status, 'INVITED');
    assert.equal(reserved.body.sessions[0].introductionPermission.allowsParticipation, false);
    assert.equal(reserved.body.stage, 'ARRANGING_PARTICIPATION');
    const row = (await call('GET', '/squad-communication/160/join-requests')).body.find(item => item.caseId === reserved.body.id);
    assert.equal(row.visit.status, 'INVITED');
    // A reservation holds its place like a confirmed visit.
    assert.equal((await call('GET', '/admissions/groups/1301/first-visits', null, nika)).body.sessions.find(item => item.reference === shown.reference)?.placesLeft ?? 0, shown.placesLeft - 1);
  } finally { group.terms.requirements = before; }
});

test('the card’s versioned update declares a child’s gender, once per version', async () => {
  const [, mariam] = (await call('GET', '/joining/children', null, ana)).body.children;
  const body = { requestId: 'id-1', expectedVersion: mariam.identity.version, fullName: mariam.identity.fullName, dateOfBirth: mariam.identity.dateOfBirth, gender: 'FEMALE', photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null };
  const saved = await call('PUT', `/joining/players/${mariam.playerId}`, body, ana);
  assert.equal(saved.body.gender, 'FEMALE'); assert.equal(saved.body.version, mariam.identity.version + 1);
  assert.equal((await call('PUT', `/joining/players/${mariam.playerId}`, body, ana)).body.version, mariam.identity.version + 1, 'a retry is the same save');
  assert.equal((await call('PUT', `/joining/players/${mariam.playerId}`, { ...body, requestId: 'id-2' }, ana)).body.code, 'STALE_VERSION');
});

test('a child called up for a connected fixture answers it with the call-up’s and the match’s revisions', async () => {
  const [giorgi] = (await call('GET', '/joining/children', null, ana)).body.children;
  // The first connected fixture (a friendly through the match exchange) in one of Giorgi's squads, as the club's feed
  // lists it in the family's week, with the listing's revision.
  const squads = W.squads.filter(row => row.playerIds.includes(giorgi.playerId)).map(row => row.id);
  const feed = (await call('GET', '/schedule/clubs/1/events?from=2000-01-01T00:00:00&to=2100-01-01T00:00:00', null, ana)).body;
  const fixture = (feed.events ?? feed).find(item => item.origin === 'MATCH_EXCHANGE' && squads.includes(item.challengerSquadId) && F.listingById(item.eventId));
  const squad = W.squadById(fixture.challengerSquadId), listing = F.listingById(fixture.eventId);
  assert.equal(fixture.matchRevision, listing.revision);
  const team = (await call('GET', `/match-arrangements/${listing.id}/participants`, null, ana)).body.find(item => item.squadId === squad.id);
  const player = team.players.find(item => item.id === giorgi.playerId);
  assert.equal(player.canRespond, true);
  const answer = { playerId: giorgi.playerId, response: 'NOT_GOING', revision: player.revision, matchRevision: listing.revision };
  assert.equal((await call('POST', `/match-arrangements/${listing.id}/squads/${squad.id}/attendance`, { ...answer, matchRevision: listing.revision - 1 }, ana)).status, 409);
  assert.equal((await call('POST', `/match-arrangements/${listing.id}/squads/${squad.id}/attendance`, answer, ana)).status, 200);
  const after = (await call('GET', `/match-arrangements/${listing.id}/participants`, null, ana)).body.find(item => item.squadId === squad.id).players.find(item => item.id === giorgi.playerId);
  assert.equal(after.response, 'NOT_GOING');
  assert.equal((await call('POST', `/match-arrangements/${listing.id}/squads/${squad.id}/attendance`, answer, ana)).status, 409, 'the call-up changed');
});

test('the club map measures from “You” and keeps the clubs that train on the chosen days', async () => {
  const near = (await call('GET', '/clubs?lat=41.7151&lng=44.8271&km=10&day=SAT')).body;
  assert.ok(near.some(club => club.id === 1), 'Dinamo trains on Saturday (Beginners) within 10 km');
  const far = (await call('GET', '/clubs?lat=42.2679&lng=42.6946&km=5')).body;
  assert.ok(!far.some(club => club.id === 1), 'not from Kutaisi');
  const all = (await call('GET', '/clubs')).body;
  assert.ok(all.length > near.length);
});
