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

test('the first answer to a join request counts; a second is told who answered and when', async () => {
  const code = (await call('GET', '/squad-communication/103/join-link', null, as('headcoach'))).body.code;
  const made = await call('POST', `/join/${code}`, { childFirstName: 'Saba', childLastName: 'Test', birthDate: '2013-05-01' });
  assert.equal(made.status, 201);
  const decide = () => call('POST', `/squad-communication/103/join-requests/${made.body.id}`, { action: 'DECLINE', expectedVersion: 1 }, as('headcoach'));
  assert.equal((await decide()).body.status, 'DECLINED');
  const second = await decide();
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'ALREADY_ANSWERED');
  assert.match(second.body.message, /already answered this request at \d\d:\d\d on \d+ \w+\./);
});

test('a helper’s save writes only what changed, keeps the coach’s ticks, refuses an older register and saves a retry once', async () => {
  const [session] = (await call('GET', '/me/helping', null, as('helper'))).body;
  const first = session.players[0].id, second = session.players[1].id;
  assert.equal(session.players[0].register, 'ARRIVED', 'the head coach ticked the first player');
  assert.ok(session.players.every(player => 'lastInitial' in player));
  const save = (came, requestId, revision) => call('PUT', `/me/helping/sessions/${session.sessionId}/register`, { came, requestId, revision }, as('helper'));
  const saved = await save([second], 'retry-1', session.registerRevision);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.players.find(player => player.id === first).register, 'ARRIVED', 'never taken back');
  assert.equal(saved.body.players.find(player => player.id === second).register, 'ARRIVED');
  assert.deepEqual((await save([], 'retry-1', session.registerRevision)).body, saved.body, 'a retry saves nothing again');
  const stale = await save([], 'retry-2', session.registerRevision);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'REGISTER_CHANGED');
  assert.equal((await call('GET', `/me/helping/sessions/${session.sessionId}/register`, null, as('helper'))).body.revision, saved.body.revision);
});

test('Want to join keeps a join-code request answered lately, saying who answered', async () => {
  const waiting = (await call('GET', '/squad-communication/105/join-requests', null, as('headcoach'))).body;
  assert.ok(waiting.every(row => !row.answeredAt), 'only those waiting by default');
  const all = (await call('GET', '/squad-communication/105/join-requests', null, as('headcoach'), 'answered=true')).body;
  const luka = all.find(row => row.childName === 'Luka Chkheidze');
  assert.ok(luka?.answeredBy && luka.answeredAt);
  assert.deepEqual(luka.groups, []);
});
