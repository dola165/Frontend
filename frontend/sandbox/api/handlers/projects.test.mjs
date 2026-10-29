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

test('outside Projects each persona is its own person with its job’s tabs; the kit parent has no club tabs', async () => {
  const commercial = (await request('commercial', 'GET', '/users/me')).body;
  assert.equal(commercial.fullName, 'Irakli Kapanadze');
  const tabs = me => me.navigationCapabilities.workspaces.map(w => w.id);
  assert.ok(tabs(commercial).includes('club.office'));
  assert.ok(!tabs(commercial).includes('squad.workspace'));
  const parent = (await request('kitparent', 'GET', '/users/me')).body;
  assert.equal(parent.fullName, 'Nana Beridze');
  assert.deepEqual(tabs(parent), ['parent.hub']);
  assert.equal((await request('kitparent', 'GET', '/clubs/my-membership-context')).body.hasClubMembership, false);
  assert.equal((await request('kitparent', 'GET', '/access/clubs/1')).body.allowed.includes('see_staff'), false);
  // Projects still sees the real persona.
  assert.equal((await board('commercial')).projects.length, (await board(null)).projects.length);
});

test('fundraisers move and go public as the backend does, and the public record keeps the club’s ids to itself', async () => {
  const mine = (await request(null, 'GET', '/projects/mine')).body;
  assert.deepEqual(mine.map(entry => entry.club.id).sort(), [1, 6]);
  assert.equal((await request('commercial', 'GET', '/clubs/6/projects')).status, 404);
  const gldani = (await request(null, 'GET', '/clubs/6/projects')).body.projects[0];
  let detail = (await request(null, 'GET', `/clubs/6/projects/${gldani.id}`)).body;
  assert.equal(detail.fundraiser.clubVerified, false);
  assert.equal(detail.fundraiser.publicNow, false);
  detail = (await request(null, 'POST', `/clubs/6/projects/${gldani.id}/fundraiser/state`, { version: detail.fundraiser.version, status: 'PAUSED' })).body;
  assert.equal((await request(null, 'POST', `/clubs/6/projects/${gldani.id}/fundraiser/state`, { version: detail.fundraiser.version, status: 'PUBLISHED' })).status, 409);
  assert.equal((await request(null, 'GET', `/campaigns/${detail.fundraiser.id}`)).status, 404);

  const kit = (await board(null)).projects.find(p => p.goal === 'New kit for U12');
  const f = (await request(null, 'GET', `/clubs/1/projects/${kit.id}`)).body.fundraiser;
  assert.equal((await request(null, 'POST', `/clubs/1/projects/${kit.id}/fundraiser/state`, { version: f.version, status: 'DRAFT' })).status, 409);
  assert.equal((await request('facilities', 'PUT', `/clubs/1/projects/${kit.id}/fundraiser`, { version: f.version, donateUrl: 'https://www.gofundme.com/f/elsewhere' })).status, 403);
  assert.equal((await request(null, 'PUT', `/clubs/1/projects/${kit.id}/fundraiser`, { version: f.version, donateUrl: 'https://www.gofundme.com:443/f/x' })).status, 400);
  assert.equal((await request(null, 'POST', `/clubs/1/projects/${kit.id}/talk`, { body: '   ' })).status, 400);
  const shown = (await request(null, 'GET', `/campaigns/${f.id}`)).body;
  assert.equal(shown.title, 'New kit for U12');
  assert.equal('reportedBy' in shown || 'publishedBy' in shown || 'projectId' in shown, false);
});
