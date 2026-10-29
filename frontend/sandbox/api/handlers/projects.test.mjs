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
  // Phase B2: Projects is Commercial's page.
  assert.ok(tabs(commercial).includes('club.projects'));
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

test('only the next step and steps due soon wait on someone; only the author edits their words', async () => {
  const commercial = await board('commercial');
  const sponsor = commercial.needsYou.filter(n => n.project.startsWith('Sponsor'));
  assert.deepEqual(sponsor.map(n => n.step), ['Send an offer']);
  assert.ok(!commercial.needsYou.some(n => n.step === 'Thank the givers'));
  assert.deepEqual(commercial.you, { role: null, jobs: ['Commercial and sponsorship'] });
  const kit = commercial.projects.find(p => p.goal === 'New kit for U12');
  const talk = (await request(null, 'GET', `/clubs/1/projects/${kit.id}`)).body.talk;
  const nanas = talk.find(c => c.author.name === 'Nana Beridze');
  assert.equal(nanas.canEdit, false);
  assert.equal(nanas.canDelete, true);
  assert.equal((await request(null, 'PATCH', `/clubs/1/projects/${kit.id}/talk/${nanas.id}`, { body: 'x' })).status, 403);
  assert.equal((await request('projectcoach', 'DELETE', `/clubs/1/projects/${kit.id}/talk/${nanas.id}`)).status, 403);
});

test('B2: the Projects tab follows the job, a parent joins one project by name and email and sees it on Home', async () => {
  const tabs = async persona => (await request(persona, 'GET', '/users/me')).body.navigationCapabilities.workspaces.map(w => w.id);
  assert.ok((await tabs('commercial')).includes('club.projects'));
  assert.ok(!(await tabs('commercial')).includes('club.office'));
  assert.ok((await tabs('facilities')).includes('club.office'));
  assert.ok((await tabs(null)).includes('club.projects'));
  assert.ok(!(await tabs('kitparent')).includes('club.projects'));

  const kit = (await board(null)).projects.find(p => p.goal === 'New kit for U12');
  const body = { name: 'Tamar Lomidze', email: 'tamar@example.test', requestId: 'b2-request' };
  const added = await request(null, 'POST', `/clubs/1/projects/${kit.id}/helpers`, body);
  assert.equal(added.status, 201);
  assert.ok(added.body.link);
  assert.equal((await request(null, 'POST', `/clubs/1/projects/${kit.id}/helpers`, body)).body.link, added.body.link);
  // Until they accept: the typed name only, waiting, no id.
  assert.equal(added.body.userId, null);
  assert.ok(!added.body.project.summary.people.some(p => p.name === 'Tamar Lomidze'));
  const waiting = added.body.project.waitingHelpers.find(h => h.name === 'Tamar Lomidze');
  assert.deepEqual(Object.keys(waiting).sort(), ['name', 'ref']);
  const off = await request(null, 'DELETE', `/clubs/1/projects/${kit.id}/helpers/${waiting.ref}`);
  assert.ok(!off.body.waitingHelpers.some(h => h.name === 'Tamar Lomidze'));

  // Nana answers on Home first; Accept puts her on the project.
  const home = (await request('kitparent', 'GET', '/projects/helping')).body;
  assert.deepEqual(home.map(p => [p.goal, Boolean(p.pending)]), [['Goals for Pitch 2', true], ['New kit for U12', false]]);
  assert.equal((await request('kitparent', 'POST', `/projects/${home[0].projectId}/helping/accept`)).status, 204);
  assert.deepEqual((await request('kitparent', 'GET', '/projects/helping')).body.map(p => p.pending), [false, false]);
  assert.deepEqual((await request(null, 'GET', '/projects/helping')).body, []);
});

test('fix round 3: those who publish take a fundraiser off the site, and it leaves the public pages', async () => {
  const kit = (await board(null)).projects.find(p => p.goal === 'New kit for U12');
  const f = (await request(null, 'GET', `/clubs/1/projects/${kit.id}`)).body.fundraiser;
  assert.equal((await request('facilities', 'POST', `/clubs/1/projects/${kit.id}/fundraiser/state`, { version: f.version, status: 'ARCHIVED' })).status, 403);
  assert.equal((await request(null, 'POST', `/clubs/1/projects/${kit.id}/fundraiser/state`, { version: f.version, status: 'ARCHIVED' })).status, 200);
  assert.equal((await request(null, 'GET', `/campaigns/${f.id}`)).status, 404);
});
