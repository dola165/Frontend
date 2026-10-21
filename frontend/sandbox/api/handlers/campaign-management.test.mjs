import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';

let sequence = 0;
const owner = () => {
  const n = ++sequence;
  const account = V.createAccount({ fullName: `Campaign manager ${n}`, email: `campaign-manager-${n}@example.test`, password: 'TestOnly123', dateOfBirth: '1990-01-01', town: 'Tbilisi' });
  const page = P.createPage(account.id, { displayName: `Campaign Recovery Club ${n}`, pageKind: 'CLUB', location: { city: 'Tbilisi' } });
  assert.equal(page.status, 200);
  return { account, club: page.body.clubId, headers: { authorization: `Bearer ${V.accessToken(account.id)}` } };
};
const input = { title: 'Travel for the girls', summary: 'A tournament trip for 18 players.', description: 'Travel and accommodation for the club team.', beneficiary: 'The youth team', useOfFunds: 'Coach travel and two nights', category: 'TRAVEL', currency: 'GEL', goalAmount: 5000, reportedAmount: null, reportedNote: '', startsOn: null, endsOn: null, images: [] };
const request = async (actor, method, path, body, extraHeaders = {}) => {
  const url = new URL(path, 'http://sandbox.test');
  const response = await handleApi({ method, path: url.pathname, query: url.searchParams, body, headers: { ...actor.headers, ...extraHeaders } });
  // Copy the HTTP-shaped receipt; later in-memory changes must not rewrite earlier assertions.
  return structuredClone(response);
};

test('a new club owns its fundraiser, its list and its private draft', async () => {
  const a = owner(), b = owner();
  const created = await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, clubId: b.club, status: 'PUBLISHED' });
  assert.equal(created.status, 201); assert.equal(created.body.clubId, a.club); assert.equal(created.body.status, 'DRAFT');
  const list = await request(a, 'GET', `/clubs/${a.club}/campaigns`);
  assert.deepEqual(list.body.map(c => c.id), [created.body.id]);
  assert.equal((await request(b, 'GET', `/clubs/${a.club}/campaigns/${created.body.id}`)).status, 403);
  assert.equal((await request(a, 'GET', `/campaigns/${created.body.id}`)).status, 404);
});

test('create replay keeps the same record and returns its current publication status/version', async () => {
  const a = owner(), key = randomUUID(), headers = { 'Idempotency-Key': key };
  const created = await request(a, 'POST', `/clubs/${a.club}/campaigns`, input, headers);
  const live = await request(a, 'POST', `/clubs/${a.club}/campaigns/${created.body.id}/state`, { version: 1, status: 'PUBLISHED' });
  assert.equal(live.status, 200);
  const replay = await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, title: ` ${input.title} ` }, headers);
  assert.equal(replay.body.id, created.body.id); assert.equal(replay.body.status, 'PUBLISHED'); assert.equal(replay.body.version, 2);
  assert.equal((await request(a, 'GET', `/clubs/${a.club}/campaigns`)).body.length, 1);
  assert.equal((await request(a, 'GET', `/campaigns/${created.body.id}`)).status, 200);
  assert.equal((await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, title: 'Changed request' }, headers)).status, 409);
});

test('replay rechecks current manager authority and keys are scoped to the actor and club', async () => {
  const a = owner(), b = owner(), key = randomUUID(), headers = { 'idempotency-key': key };
  const first = await request(a, 'POST', `/clubs/${a.club}/campaigns`, input, headers);
  const other = await request(b, 'POST', `/clubs/${b.club}/campaigns`, input, headers);
  assert.notEqual(first.body.id, other.body.id);
  const page = P.clubPage(a.club); page.ownerId = b.account.id; page.staff.delete(a.account.id);
  assert.equal((await request(a, 'POST', `/clubs/${a.club}/campaigns`, input, headers)).status, 403);
  assert.equal((await request(a, 'PUT', `/clubs/${a.club}/campaigns/${first.body.id}`, { ...input, version: 1 })).status, 403);
});

test('publication validates the real limits, required details, versions and transitions', async () => {
  const a = owner();
  assert.equal((await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, summary: 'x'.repeat(241) })).status, 400);
  assert.equal((await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, goalAmount: 1.001 })).status, 400);
  const created = await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, useOfFunds: '' });
  const path = `/clubs/${a.club}/campaigns/${created.body.id}`;
  assert.equal((await request(a, 'POST', `${path}/state`, { status: 'PUBLISHED' })).status, 409);
  assert.equal((await request(a, 'POST', `${path}/state`, { version: 1, status: 'PUBLISHED' })).status, 400);
  assert.equal((await request(a, 'PUT', path, { ...input, version: 1 })).body.version, 2);
  assert.equal((await request(a, 'POST', `${path}/state`, { version: 2, status: 'PUBLISHED' })).body.version, 3);
  assert.equal((await request(a, 'POST', `${path}/state`, { version: 3, status: 'CLOSED' })).body.version, 4);
  assert.equal((await request(a, 'POST', `${path}/state`, { version: 4, status: 'PUBLISHED' })).status, 409);
});

test('new campaign photos must be uploaded by the current account', async () => {
  const a = owner(), b = owner();
  const upload = await request(a, 'POST', '/media/upload?context=CAMPAIGN', { _raw: 100 });
  assert.equal(upload.status, 201);
  assert.equal((await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, images: [upload.body.url] })).status, 201);
  assert.equal((await request(b, 'POST', `/clubs/${b.club}/campaigns`, { ...input, images: [upload.body.url] })).status, 400);
  assert.equal((await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...input, images: ['https://example.test/unowned.png'] })).status, 400);
});

test('editing a prototype fundraiser keeps its known giving link and report date', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-17T00:00:00Z') });
  const a = owner(), donateUrl = 'https://www.gofundme.com/f/synthetic-test';
  const body = { ...input, reportedAmount: 100, reportedNote: 'Recorded by the treasurer' };
  const created = await request(a, 'POST', `/clubs/${a.club}/campaigns`, { ...body, donateUrl });
  context.mock.timers.tick(60_000);
  const edited = await request(a, 'PUT', `/clubs/${a.club}/campaigns/${created.body.id}`, { ...body, version: 1, title: 'Updated title' });
  assert.equal(edited.body.donateUrl, donateUrl);
  assert.equal(edited.body.reportedAt, created.body.reportedAt);
  const changed = await request(a, 'PUT', `/clubs/${a.club}/campaigns/${created.body.id}`, { ...body, version: 2, reportedNote: 'New treasury report' });
  assert.equal(changed.body.reportedAt, '2026-10-17T00:01:00.000Z');
});
