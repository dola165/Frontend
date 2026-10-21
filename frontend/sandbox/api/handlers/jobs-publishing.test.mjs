import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';

let sequence = 0;
const account = () => {
  const n = ++sequence, person = V.createAccount({ fullName: `Job Poster ${n}`, email: `job-poster-${n}@example.test`, password: 'TestOnly123', dateOfBirth: '1990-01-01', town: 'Kutaisi' });
  return { person, headers: { authorization: `Bearer ${V.accessToken(person.id)}` } };
};
const ownClub = actor => {
  const result = P.createPage(actor.person.id, { displayName: `Jobs Club ${sequence}`, pageKind: 'CLUB', location: { city: 'Kutaisi' } });
  assert.equal(result.status, 200); return result.body.clubId;
};
const input = { posterKind: 'PERSON', direction: 'HIRING', title: 'Weekend goalkeeper coach', description: 'Help our daughter with goalkeeper training.', category: 'COACHING', applyMethod: 'MESSAGE' };
const request = (actor, method, path, body) => handleApi({ method, path, body, query: new URLSearchParams(), headers: actor.headers });

test('a registered person publishes with their own identity and sees their own posting', async () => {
  const actor = account();
  const created = await request(actor, 'POST', '/jobs', input);
  assert.equal(created.status, 201); assert.equal(created.body.poster.kind, 'PERSON'); assert.equal(created.body.poster.id, actor.person.id);
  assert.equal(created.body.poster.name, actor.person.fullName); assert.equal(created.body.createdBy, actor.person.id); assert.equal(created.body.clubId, null);
  assert.equal(created.body.clubCityName, 'Kutaisi'); assert.equal(created.body.requiredRole, null);
  const front = await request(actor, 'GET', '/jobs/front');
  assert(front.body.postings.some(job => job.id === created.body.id));
  assert(!(await request(account(), 'GET', '/jobs/front')).body.postings.some(job => job.id === created.body.id));
});

test('unknown or unauthorized club publishing is refused and never silently becomes personal', async () => {
  const owner = account(), club = ownClub(owner), other = account();
  assert.equal((await request(other, 'POST', '/jobs', { ...input, posterKind: 'CLUB', clubId: club })).status, 403);
  assert.equal((await request(owner, 'POST', '/jobs', { ...input, posterKind: 'CLUB', clubId: 99999999 })).status, 404);
  assert.equal((await request(owner, 'POST', '/jobs', { ...input, posterKind: undefined })).status, 400);
});

test('confirmed club staff publish as that club and in-app coaching applications stay club-owned', async () => {
  const owner = account(), club = ownClub(owner), coach = account();
  P.clubPage(club).staff.set(coach.person.id, 'COACH');
  const created = await request(coach, 'POST', '/jobs', { ...input, posterKind: 'CLUB', clubId: club, applyMethod: 'IN_APP' });
  assert.equal(created.status, 201); assert.equal(created.body.poster.kind, 'CLUB'); assert.equal(created.body.poster.id, club); assert.equal(created.body.requiredRole, 'COACH');
});

test('personal and non-coaching listings cannot advertise an unsupported in-app application', async () => {
  const owner = account(), club = ownClub(owner);
  assert.equal((await request(owner, 'POST', '/jobs', { ...input, applyMethod: 'IN_APP' })).status, 400);
  assert.equal((await request(owner, 'POST', '/jobs', { ...input, posterKind: 'CLUB', clubId: club, category: 'MEDICAL', applyMethod: 'IN_APP' })).status, 400);
  assert.equal((await request(owner, 'POST', '/jobs', { ...input, posterKind: 'CLUB', clubId: club, direction: 'OFFERING' })).status, 400);
});
