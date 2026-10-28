import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleApi } from './api/router.mjs';
const call = (method, path, body, headers = {}) => handleApi({ method, path, body, headers, query: new URLSearchParams() });
test('Dinamo People and staff links expose invented step 1 jobs and isolate access', async () => {
  const people = await call('GET', '/clubs/1/people');
  assert.equal(people.status, 200);
  for (const [job, title] of [['SPECIALIST_COACH', 'Goalkeeper coach'], ['HEAD_OF_COACHING', 'Head of coaching'], ['TRAVEL_COORDINATOR', 'Travel coordinator']])
    assert.ok(people.body.people.some(p => p.jobs.some(j => j.job === job && j.title === title)));
  const links = await call('GET', '/clubs/1/staff-links');
  assert.equal(links.status, 200); assert.equal(links.body.length, 1);
  assert.equal(links.body[0].job, 'HEAD_COACH');
  assert.equal((await call('GET', '/clubs/1/people', null, { cookie: 'gk-sandbox-persona=member' })).status, 403);
  assert.equal((await call('GET', '/clubs/1/staff-links', null, { cookie: 'gk-sandbox-persona=analyst' })).status, 403);
  assert.equal((await call('GET', '/clubs/99/people')).status, 403);
});
test('synthetic invites retain the saved title and bulk links allow only the four main jobs', async () => {
  const invite = await call('POST', '/clubs/1/people/invites', { name: 'Synthetic colleague', email: 'colleague@example.test', job: 'SPECIALIST_COACH', title: 'Technique and goalkeepers', squadIds: [103] });
  assert.equal(invite.status, 200);
  const people = (await call('GET', '/clubs/1/people')).body.people;
  assert.equal(people.find(p => p.userId === invite.body.userId).jobs[0].title, 'Technique and goalkeepers');
  for (const job of ['HEAD_OF_COACHING', 'DOCTOR', 'WELFARE_OFFICER', 'CUSTOM', 'ADMIN'])
    assert.equal((await call('POST', '/clubs/1/staff-links', { job, clubWide: true, requestId: job })).status, 400);
  assert.equal((await call('POST', '/clubs/1/staff-links', { job: 'HEAD_COACH', squadIds: [999], requestId: 'wrong-club' })).status, 400);
  const body = { job: 'ASSISTANT_COACH', squadIds: [103], requestId: 'same-request' };
  const made = await call('POST', '/clubs/1/staff-links', body);
  assert.equal(made.status, 200);
  assert.equal((await call('POST', '/clubs/1/staff-links', body)).body.id, made.body.id);
  assert.equal((await call('DELETE', '/clubs/1/staff-links/' + made.body.id)).body.status, 'REVOKED');
});
