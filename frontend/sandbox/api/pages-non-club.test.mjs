import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from './router.mjs';
import * as P from './pages-data.mjs';
import * as V from './viewer.mjs';

const account = () => V.createAccount({ fullName: 'Non-club reviewer', email: `${randomUUID()}@example.org`, password: 'synthetic-only', dateOfBirth: '1985-05-02', town: 'Rustavi' });
const request = (viewer, method, path, body) => handleApi({ method, path, body, headers: { cookie: `gk-sandbox-user=${viewer.id}` }, query: new URLSearchParams() });
async function ok(viewer, method, path, body) {
  const response = await request(viewer, method, path, body);
  assert.equal(response?.status, 200, `${method} ${path}`);
  return response.body;
}

for (const kind of ['FAN_CLUB', 'BUSINESS', 'PAGE']) {
  test(`${kind}: name-only publication preserves organization identity, permissions and no football membership`, async () => {
    const owner = account(), outsider = account();
    const body = { requestId: randomUUID(), pageKind: kind, displayName: `${kind} ${randomUUID()}`, location: { city: 'Rustavi' } };
    const created = await ok(owner, 'POST', '/organizations/setup', body);
    assert.equal(created.clubId, null);
    assert.equal(created.profilePath, `/organizations/${created.id}`);
    assert.equal(created.workspacePath, `/organizations/${created.id}/workspace`);
    assert.deepEqual(await ok(owner, 'POST', '/organizations/setup', body), created, 'same receipt never creates another page');
    assert.equal((await request(owner, 'POST', '/organizations/setup', { ...body, pageKind: kind === 'PAGE' ? 'BUSINESS' : 'PAGE' })).status, 409, 'a receipt cannot change type');
    const path = `/organizations/${created.id}/page`;
    const draft = await ok(owner, 'GET', path);
    assert.equal(draft.kind, kind);
    assert.equal(draft.status, 'DRAFT');
    assert.equal(draft.viewer.canEdit, true);
    assert.equal(draft.setup.done, 0);
    assert.equal(draft.goLive.ready, true);
    assert.equal(draft.identity.crest.kept, false);
    assert.equal(draft.identity.aboutAuto, true);
    assert.equal((await request(outsider, 'GET', path)).status, 404);
    assert.equal((await request(outsider, 'POST', `${path}/live`, { requestId: randomUUID() })).status, 404);
    assert.equal((await request(owner, 'PUT', `${path}/boxes/squads`, { version: 1, data: { items: [{ ageGroup: 'U12', gender: 'MALE' }] } })).status, 400);
    const liveId = randomUUID();
    const live = await ok(owner, 'POST', `${path}/live`, { requestId: liveId });
    assert.equal(live.status, 'LIVE');
    assert.equal(live.setup.done, 0, 'publication does not implicitly confirm generated content');
    assert.equal(live.identity.crest.kept, false);
    assert.equal(live.identity.aboutAuto, true);
    assert.equal((await ok(owner, 'POST', `${path}/live`, { requestId: liveId })).liveAt, live.liveAt);
    const publicPage = await ok(outsider, 'GET', path);
    assert.equal(publicPage.viewer.canEdit, false);
    assert.equal(publicPage.suggestions, null);
    assert.deepEqual(publicPage.boxes.staff.invites, []);
    assert.equal((await request(outsider, 'PUT', `${path}/identity`, { version: live.identity.version, name: 'Unauthorized rename' })).status, 403);
    assert.equal((await request(outsider, 'POST', `${path}/live`, { requestId: randomUUID() })).status, 403);
    const me = await ok(owner, 'GET', '/users/me');
    assert.deepEqual(me.navigationCapabilities.workspaces.map(item => ({ id: item.id, context: item.context.id })), [{ id: 'organization.workspace', context: created.id }]);
    const membership = await ok(owner, 'GET', '/clubs/my-membership-context');
    assert.equal(membership.hasClubMembership, false);
    assert.equal(membership.clubId, null);
    assert.equal(P.clubOf(owner.id), null);
    assert.equal(P.ownedPages(owner.id).length, 1);
  });
}

test('edits and draft privacy remain separate across all three organization page types owned by one account', async () => {
  const owner = account(), outsider = account();
  const pages = [];
  for (const kind of ['FAN_CLUB', 'BUSINESS', 'PAGE']) {
    const created = await ok(owner, 'POST', '/organizations/setup', { requestId: randomUUID(), pageKind: kind, displayName: `${kind} isolated ${randomUUID()}` });
    pages.push(await ok(owner, 'GET', `/organizations/${created.id}/page`));
  }
  for (const original of pages) {
    const path = `/organizations/${original.organizationId}/page`;
    await ok(owner, 'PUT', `${path}/identity`, { version: original.identity.version, about: `Only ${original.kind}`, aboutAuto: false });
  }
  for (const original of pages) {
    const path = `/organizations/${original.organizationId}/page`;
    const current = await ok(owner, 'GET', path);
    assert.equal(current.kind, original.kind);
    assert.equal(current.identity.about, `Only ${original.kind}`);
    assert.equal(current.identity.aboutAuto, false);
    assert.equal(current.status, 'DRAFT');
    assert.equal((await request(outsider, 'GET', path)).status, 404);
  }
  assert.equal(P.clubOf(owner.id), null);
  assert.equal((await ok(owner, 'GET', '/users/me')).navigationCapabilities.workspaces.length, 3);
});
