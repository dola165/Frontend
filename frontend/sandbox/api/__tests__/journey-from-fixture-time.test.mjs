import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as P from '../pages-data.mjs';

const call = (method, path, actor, body) => handleApi({ method, path, body, headers: { cookie: `gk-sandbox-user=${actor.id}` }, query: new URLSearchParams() });

test('new fixture journeys require a strictly future resolved kickoff while authorized purpose reuse survives elapsed time', async t => {
  let now = Date.parse('2030-01-01T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const owner = V.createAccount({ fullName: 'Fixture time owner', email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
  const setup = await call('POST', '/organizations/setup', owner, { requestId: randomUUID(), pageKind: 'CLUB', displayName: 'Fixture time QA', location: { city: 'Tbilisi' } });
  assert.equal(setup.status, 200);
  const clubId = setup.body.clubId;
  assert.equal((await call('PUT', `/clubs/${clubId}/page/boxes/squads`, owner, { data: { items: [{ ageGroup: 'U14', gender: 'MIXED' }] } })).status, 200);
  const squad = W.squads.find(item => item.clubId === clubId), createdFixtures = [];
  const fixture = instant => {
    const start = new Date(instant), match = { id: W.newId(), clubId, squadId: squad.id, opponentClubId: 1, venueId: 202,
      title: 'Fixture time boundary', home: true, status: 'SCHEDULED', start, end: new Date(start.getTime() + 90 * 60000) };
    W.matches.push(match); createdFixtures.push(match); return match;
  };
  const body = match => ({ eventId: match.id, clubId, squadId: squad.id, preferences: { mode: 'MEET_AT_VENUE' } });
  try {
    const before = F.plans.length;
    const elapsed = fixture(now - 2 * 86400000), exact = fixture('2030-01-01T16:00:00+04:00');
    for (const match of [elapsed, exact]) {
      const result = await call('POST', '/journeys/from-fixture', owner, body(match));
      assert.equal(result.status, 409, 'SCHEDULED status does not make an elapsed or exactly-now kickoff upcoming');
      assert.equal(F.plans.length, before, 'a refused attempt creates no private plan');
    }
    const future = fixture('2030-01-01T16:00:00.001+04:00');
    const made = await call('POST', '/journeys/from-fixture', owner, body(future));
    assert.equal(made.status, 201); assert.equal(made.body.club_id, clubId); assert.equal(F.plans.length, before + 1);
    now += 3 * 86400000;
    const replay = await call('POST', '/journeys/from-fixture', owner, body(future));
    assert.equal(replay.status, 200); assert.equal(replay.body.id, made.body.id); assert.equal(F.plans.length, before + 1);
    const outsider = V.createAccount({ fullName: 'Fixture time outsider', email: `${randomUUID()}@example.test`, dateOfBirth: '1990-01-01' });
    assert.equal((await call('POST', '/journeys/from-fixture', outsider, body(elapsed))).status, 403, 'authority is checked before time');
    const page = P.clubPage(clubId); page.ownerId = null; page.staff.delete(owner.id); squad.headCoachId = null;
    assert.equal((await call('POST', '/journeys/from-fixture', owner, body(future))).status, 403, 'purpose reuse rechecks revoked authority');
  } finally {
    for (const match of createdFixtures) W.matches.splice(W.matches.indexOf(match), 1);
  }
});
