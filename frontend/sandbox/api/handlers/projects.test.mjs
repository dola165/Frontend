import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../router.mjs';

const as = persona => ({ cookie: persona ? `gk-sandbox-persona=${persona}` : '' });
const request = async (persona, method, path, body) => {
  const url = new URL(path, 'http://sandbox.test');
  return structuredClone(await handleApi({ method, path: url.pathname, query: url.searchParams, body, headers: as(persona) }));
};
const board = async persona => (await request(persona, 'GET', '/clubs/1/projects')).body;

test('the commercial lead, the facilities coordinator and an admin see every project; others only theirs', async () => {
  const all = (await board(null)).projects.length;
  assert.ok(all >= 6);
  assert.equal((await board('commercial')).projects.length, all);
  assert.equal((await board('facilities')).projects.length, all);
  const coach = await board('projectcoach');
  assert.deepEqual(coach.projects.map(p => p.goal), ['New kit for U12']);
  assert.equal(coach.needsYou.length, 1);
  const parent = await board('kitparent');
  assert.deepEqual(parent.projects.map(p => p.goal), ['New kit for U12']);
  assert.equal(parent.canStart, false);
  const hidden = (await board(null)).projects.find(p => p.goal === 'Goals for Pitch 2');
  assert.equal((await request('kitparent', 'GET', `/clubs/1/projects/${hidden.id}`)).status, 404);
});

test('the person a step waits on ticks it off but does not rename it; the money decides progress', async () => {
  const kit = (await board('projectcoach')).projects[0];
  assert.equal(kit.progressFromMoney, true);
  assert.equal(kit.progress, 62);
  const detail = (await request('projectcoach', 'GET', `/clubs/1/projects/${kit.id}`)).body;
  const mine = detail.steps.find(step => step.mine);
  assert.equal(detail.can.change, false);
  assert.equal((await request('projectcoach', 'PATCH', `/clubs/1/projects/${kit.id}/steps/${mine.id}`, { version: mine.version, title: 'Mine' })).status, 403);
  const done = await request('projectcoach', 'PATCH', `/clubs/1/projects/${kit.id}/steps/${mine.id}`, { version: mine.version, done: true });
  assert.equal(done.status, 200);
  assert.equal(done.body.steps.find(step => step.id === mine.id).done, true);
  assert.equal((await board('projectcoach')).needsYou.length, 0);
});

test('a kind fills in the first steps, and a second publish changes nothing', async () => {
  const started = await request('facilities', 'POST', '/clubs/1/projects', { goal: 'Lights for Pitch 1', kind: 'FIX_OR_BUILD', language: 'ka' });
  assert.equal(started.status, 201);
  assert.deepEqual(started.body.steps.map(step => step.title), ['ფასების შეგროვება', 'სამუშაოს დაჯავშნა', 'შემოწმება']);
  const kit = (await board(null)).projects.find(p => p.goal === 'New kit for U12');
  const detail = (await request('facilities', 'GET', `/clubs/1/projects/${kit.id}`)).body;
  assert.equal(detail.can.publish, false);
  const again = await request(null, 'POST', `/clubs/1/projects/${kit.id}/fundraiser/state`, { version: detail.fundraiser.version, status: 'PUBLISHED' });
  assert.equal(again.status, 200);
  assert.equal(again.body.fundraiser.publishedBy.name, 'Irakli Kapanadze');
});
