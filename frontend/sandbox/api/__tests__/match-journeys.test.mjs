import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as F from '../world-football.mjs';
import * as W from '../world.mjs';

const call = (method, path, body, actor) => handleApi({ method, path, body, query: new URLSearchParams(), headers: actor ? { cookie: `gk-sandbox-user=${actor}` } : {} });

async function newClub(name) {
  const actor = V.createAccount({ fullName: `${name} Owner`, email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01', password: 'synthetic-only' }).id;
  const created = await call('POST', '/organizations/setup', { pageKind: 'CLUB', displayName: name, location: { city: 'Tbilisi' }, requestId: randomUUID() }, actor);
  assert.equal(created.status, 200);
  const club = created.body.clubId;
  const saved = await call('PUT', `/clubs/${club}/page/boxes/squads`, { data: { items: [{ ageGroup: 'U14', gender: 'MALE' }] } }, actor);
  assert.equal(saved.status, 200);
  const squads = await call('GET', '/match-exchange/squads', null, actor);
  assert.equal(squads.body.length, 1);
  assert.equal(squads.body[0].club_id, club);
  return { actor, club, squad: squads.body[0].id };
}

function terms(squad, requestId = randomUUID(), targetClubId = null, targetSquadId = null) {
  return { match: { squadId: squad, title: 'U14 friendly', description: '', startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 90000000).toISOString(), timezone: 'Asia/Tbilisi', city: 'Tbilisi', locationName: 'Ground to be arranged', ageGroup: 'U14', level: 'DEVELOPMENT', format: '11_A_SIDE', venuePreference: 'HOME', refereeRequired: false, requestId, revision: 0 },
    targetClubId, targetSquadId, bookingId: null, matchType: 'FRIENDLY', hostingChoice: 'HOME', officialMode: 'NONE', officialResponsibility: 'HOST', refereeId: null, externalRefereeName: null, volunteer: true, fee: 0, currency: 'GEL' };
}

test('a new club creates its own match; retry is stable and cannot reuse another account’s authority', async () => {
  const a = await newClub('World Test Academy A'), b = await newClub('World Test Academy B');
  const body = terms(a.squad), first = await call('POST', '/match-arrangements', body, a.actor);
  assert.equal(first.status, 201);
  assert.equal(first.body.club_id, a.club);
  assert.equal(first.body.can_manage, true);
  const retry = await call('POST', '/match-arrangements', body, a.actor);
  assert.equal(retry.body.event_id, first.body.event_id);
  assert.equal((await call('POST', '/match-arrangements', body, b.actor)).status, 403);
  const theirBody = { ...body, match: { ...body.match, squadId: b.squad } };
  const theirs = await call('POST', '/match-arrangements', theirBody, b.actor);
  assert.equal(theirs.status, 201);
  assert.notEqual(theirs.body.event_id, first.body.event_id);
  assert.equal((await call('GET', `/match-exchange/${first.body.event_id}`, null, b.actor)).body.can_manage, false);
});

test('open match proposals keep identity, revision and one pending offer per squad', async () => {
  const a = await newClub('World Proposal Academy'), b = await newClub('World Challenger Academy');
  const created = await call('POST', '/match-arrangements', terms(a.squad), a.actor), id = created.body.event_id;
  const path = `/match-exchange/${id}/proposals`;
  assert.equal((await call('POST', path, { squadId: a.squad, revision: 1 }, a.actor)).status, 403);
  assert.equal((await call('POST', path, { squadId: b.squad, revision: 99 }, b.actor)).status, 409);
  assert.equal((await call('POST', path, { squadId: b.squad, revision: 1, note: 'We can play.' }, b.actor)).status, 204);
  assert.equal((await call('POST', path, { squadId: b.squad, revision: 2 }, b.actor)).status, 204);
  const match = await call('GET', `/match-exchange/${id}`, null, a.actor);
  assert.equal(match.body.proposals.length, 1);
  const decision = `${path}/${match.body.proposals[0].id}/decision`;
  assert.equal((await call('POST', decision, { action: 'ACCEPT', revision: 2 }, b.actor)).status, 403);
  assert.equal((await call('POST', decision, { action: 'ACCEPT', revision: 1 }, a.actor)).status, 409);
  assert.equal((await call('POST', decision, { action: 'ACCEPT', revision: 2 }, a.actor)).status, 204);
  const arranged = await call('GET', `/match-exchange/${id}`, null, b.actor);
  assert.equal(arranged.body.opponent_club_id, b.club);
  assert.equal(arranged.body.can_arrange, true);
});

test('a direct invitation can only be answered by the invited club and exact squad', async () => {
  const a = await newClub('World Invitation Academy');
  const created = await call('POST', '/match-arrangements', terms(a.squad, randomUUID(), F.DINAMO, 103), a.actor), id = created.body.event_id;
  const path = `/match-arrangements/${id}/response`;
  assert.equal((await call('POST', path, { action: 'ACCEPT', squadId: a.squad, revision: 1 }, a.actor)).status, 403);
  assert.equal((await call('POST', path, { action: 'ACCEPT', squadId: 101, revision: 1 })).status, 400);
  assert.equal((await call('POST', path, { action: 'ACCEPT', squadId: 103, revision: 0 })).status, 409);
  const accepted = await call('POST', path, { action: 'ACCEPT', squadId: 103, revision: 1 });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.target_squad_id, 103);
  assert.equal(accepted.body.listing_status, 'ARRANGED');
  const spectator = V.createAccount({ fullName: 'Private Match Spectator', dateOfBirth: '1990-01-01' }).id;
  assert.equal((await call('GET', `/match-exchange/${id}`, null, spectator)).status, 404);
  assert.equal((await call('GET', `/match-exchange/${id}/result/summary`, null, spectator)).status, 404);
});

test('new-club results need independent confirmation; corrections and retries keep honest state', async () => {
  const a = await newClub('World Results Academy');
  const created = await call('POST', '/match-arrangements', terms(a.squad), a.actor), id = created.body.event_id;
  await call('POST', `/match-exchange/${id}/proposals`, { squadId: 103, revision: 1 });
  const proposalId = F.listingById(id).proposals[0].id;
  await call('POST', `/match-exchange/${id}/proposals/${proposalId}/decision`, { action: 'ACCEPT', revision: 2 }, a.actor);
  const listing = F.listingById(id);
  listing.start = new Date(Date.now() - 7200000); listing.end = new Date(Date.now() - 3600000);
  const path = `/match-exchange/${id}/result`;
  const initial = await call('GET', path, null, a.actor);
  assert.deepEqual(initial.body.authority.roles, ['HOME']);
  assert.equal(initial.body.revision, 0);
  const proposal = { side: 'HOME', revision: 0, requestId: randomUUID(), homeScore: 2, awayScore: 1 };
  assert.equal((await call('POST', path, proposal, a.actor)).body.status, 'PROPOSED');
  assert.equal((await call('POST', path, proposal, a.actor)).body.revision, 1);
  assert.equal((await call('POST', path, { ...proposal, homeScore: 3 }, a.actor)).status, 409);
  assert.equal((await call('POST', `${path}/confirm`, { side: 'HOME', revision: 1, requestId: randomUUID() }, a.actor)).status, 403);
  assert.equal((await call('POST', `${path}/confirm`, { side: 'AWAY', revision: 0, requestId: randomUUID() })).status, 409);
  const confirmed = await call('POST', `${path}/confirm`, { side: 'AWAY', revision: 1, requestId: randomUUID() });
  assert.equal(confirmed.body.status, 'CONFIRMED');
  listing.refereeRequired = true; listing.refereeId = V.viewerId({});
  const correction = await call('POST', `${path}/correct`, { side: 'HOME', revision: 2, requestId: randomUUID(), homeScore: 3, awayScore: 1, reason: 'Checked the match sheet.' }, a.actor);
  assert.equal(correction.body.status, 'PROPOSED');
  assert.equal(correction.body.history.length, 3);
  assert.equal((await call('POST', `${path}/confirm`, { side: 'AWAY', revision: 3, requestId: randomUUID() })).body.status, 'PROPOSED');
  // One person cannot provide both independent confirmations by changing their result side.
  assert.equal((await call('POST', `${path}/confirm`, { side: 'REFEREE', revision: 4, requestId: randomUUID() })).status, 403);
  const spectator = V.createAccount({ fullName: 'World Spectator', dateOfBirth: '1990-01-01' }).id;
  assert.equal((await call('GET', path, null, spectator)).status, 403);
  const summary = await call('GET', `${path}/summary`, null, spectator);
  assert.equal(summary.body.official, false);
  assert.equal(summary.body.canReadAudit, false);
  assert.equal('history' in summary.body, false);
  assert.equal((await call('GET', `/match-exchange/${id}`, null, spectator)).body.home_score, null);
});

test('a new club calendar combines saved single sessions, recurring training and matches with private-session access', async () => {
  const a = await newClub('World Calendar Academy'), b = await newClub('World Other Calendar Academy');
  await call('PUT', `/clubs/${a.club}/page/boxes/squads`, { data: { items: [{ id: a.squad, ageGroup: 'U14', gender: 'MALE', days: [2], time: '17:30' }] } }, a.actor);
  const arranged = await call('POST', '/match-arrangements', terms(a.squad, randomUUID(), F.DINAMO, 103), a.actor);
  await call('POST', `/match-arrangements/${arranged.body.event_id}/response`, { action: 'ACCEPT', squadId: 103, revision: 1 });
  // Exact W.events record produced by lane 03's owned POST /squad-communication/:id/sessions handler.
  const session = { id: W.newId(), clubId: a.club, squadId: a.squad, type: 'TRAINING', title: 'First session', start: new Date(Date.now() + 172800000), end: new Date(Date.now() + 178200000), location: 'Our school pitch', revision: 1, venueId: null, pitch: '', status: 'SCHEDULED' };
  W.events.push(session);
  const calendar = await call('GET', `/schedule/clubs/${a.club}/events`, null, a.actor);
  const single = calendar.body.events.filter(event => event.eventId === session.id);
  assert.equal(single.length, 1);
  assert.equal(single[0].occurrenceId, `squad:${a.squad}:${session.id}`);
  assert.equal(single[0].locationName, session.location);
  assert.equal(single[0].visibility, 'PRIVATE');
  assert.ok(calendar.body.events.some(event => event.recurring && event.eventType === 'TRAINING'));
  assert.ok(calendar.body.events.some(event => event.matchExchangeId === arranged.body.event_id));
  assert.equal((await call('GET', `/schedule/events/${session.id}`, null, a.actor)).body.eventId, session.id);
  const other = await call('GET', `/schedule/clubs/${a.club}/events`, null, b.actor);
  assert.equal(other.body.events.some(event => event.eventId === session.id), false);
  assert.equal(other.body.events.some(event => event.matchExchangeId === arranged.body.event_id), false);
  assert.equal((await call('GET', `/schedule/events/${session.id}`, null, b.actor)).status, 404);
  const cancelled = { ...session, cancelled: 'Ground unavailable' };
  Object.assign(session, cancelled);
  assert.equal((await call('GET', `/schedule/events/${session.id}`, null, a.actor)).body.status, 'CANCELLED');
});
