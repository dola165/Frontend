// My squads, step 3: the same squad page for every job on it, the buttons by the person's tools.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleApi } from './router.mjs';

const call = (method, path, body, headers = {}, query = '') => handleApi({ method, path, body, headers, query: new URLSearchParams(query) });
const as = persona => ({ cookie: `gk-sandbox-persona=${persona}` });

test('the next match card is the same for everyone on U16 Boys; only the buttons follow the job', async () => {
  const manager = (await call('GET', '/squad-communication/105/next-match', null, as('teammanager'))).body;
  const keeper = (await call('GET', '/squad-communication/105/next-match', null, as('gkcoach'))).body;
  assert.equal(manager.match.event_id, keeper.match.event_id);
  assert.deepEqual(manager.callUps.map(p => [p.id, p.response]), keeper.callUps.map(p => [p.id, p.response]));
  assert.deepEqual(Object.keys(manager.fitness).sort(), ['doubtful', 'fit', 'out', 'players']);
  assert.deepEqual(manager.can, { callUps: true, remind: true, checklist: true, bus: true });
  assert.deepEqual(keeper.can, { callUps: false, remind: false, checklist: false, bus: false });
  // Someone on no squad has no card.
  assert.equal((await call('GET', '/squad-communication/105/next-match', null, as('kit'))).status, 404);
});

test('joining is decided by the squad’s coaches and the head of coaching, in the real request shape', async () => {
  assert.equal((await call('GET', '/squad-communication/105/join-requests', null, as('teammanager'))).status, 403);
  assert.equal((await call('GET', '/squad-communication/103/join-requests', null, as('gkcoach'))).status, 403);
  for (const squad of [101, 103, 105]) {
    const rows = (await call('GET', `/squad-communication/${squad}/join-requests`, null, as('headofcoaching'))).body;
    for (const row of rows) {
      assert.equal(typeof row.version, 'number');
      assert.ok(Array.isArray(row.groups));
      assert.ok(row.setup && typeof row.setup.canConfigure === 'boolean');
    }
  }
  const waiting = await call('GET', '/recruitment/applications/waiting', null, as('headofcoaching'), 'clubId=1');
  assert.ok(waiting.body.length > 0);
});

test('a helper sees only the session they help at, and job holders carry no club role', async () => {
  const helping = (await call('GET', '/me/helping', null, as('helper'))).body;
  assert.equal(helping.length, 1);
  assert.equal(helping[0].squadName, 'U12 Mixed');
  assert.ok(helping[0].players.every(player => !('lastName' in player) && typeof player.firstName === 'string'));
  for (const persona of ['teammanager', 'kit', 'helper'])
    assert.deepEqual((await call('GET', '/club-memberships/me', null, as(persona))).body, []);
});
