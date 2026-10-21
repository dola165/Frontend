import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from './router.mjs';
import * as P from './pages-data.mjs';
import * as V from './viewer.mjs';
import * as C from './world-club.mjs';
import * as W from './world.mjs';

// Isolated in-process fixtures only: no running API, login or publication request.
const account = () => V.createAccount({ fullName: 'Directory fixture', email: `${randomUUID()}@example.org`, password: 'fixture-only', dateOfBirth: '1985-05-02' });
const fixture = (owner, kind, status = 'DRAFT') => {
  const result = P.createPage(owner, { pageKind: kind, displayName: `${kind} directory ${randomUUID()}` });
  assert.equal(result.status, 200);
  const page = P.pageOf(kind === 'CLUB' ? { type: 'club', id: result.body.clubId } : { type: 'organization', id: result.body.id });
  page.status = status;
  return page;
};
async function read(viewer, path) {
  const response = await handleApi({ method: 'GET', path, headers: { cookie: `gk-sandbox-user=${viewer}` }, query: new URLSearchParams() });
  assert.equal(response?.status, 200, path);
  return response.body;
}

test('the legacy coach retains the existing seed directory before opening any page', async () => {
  const rows = await read(W.ME_ID, '/organizations/workspaces');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, C.ORG_ID);
  assert.equal(rows[0].clubId, C.CLUB_ID);
  assert.equal(rows[0].venueCount, C.organization.venueRelationships.length);
  assert.deepEqual(rows[0].kinds, ['CLUB', 'VENUE']);
});

for (const kind of ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE']) {
  for (const status of ['DRAFT', 'LIVE']) {
    test(`${kind} ${status}: current owner's directory returns the existing page links and state`, async () => {
      const owner = account(), page = fixture(owner.id, kind, status);
      const mine = await read(owner.id, '/pages/mine');
      const rows = await read(owner.id, '/organizations/workspaces');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, mine[0].id);
      assert.equal(rows[0].displayName, mine[0].name);
      assert.equal(rows[0].status, mine[0].status);
      assert.equal(rows[0].clubId, page.clubId);
      assert.equal(rows[0].canOpenWorkspace, true);
      assert.equal(rows[0].venueCount, 0);
      assert.notEqual(rows[0].id, C.ORG_ID);
      const profile = page.clubId ? `/clubs/${page.clubId}` : `/organizations/${page.organizationId}`;
      assert.equal(mine[0].profilePath, profile);
      assert.equal(mine[0].workspacePath, `${profile}/workspace`);
      assert.equal(rows[0].profilePath, mine[0].profilePath);
      assert.equal(rows[0].workspacePath, mine[0].workspacePath);
    });
  }
}

test('an unrelated actor receives neither another owner’s private draft nor the fixed demo organization', async () => {
  const owner = account(), outsider = account();
  fixture(owner.id, 'CLUB'); fixture(owner.id, 'PAGE'); fixture(owner.id, 'BUSINESS', 'LIVE');
  assert.deepEqual(await read(outsider.id, '/pages/mine'), []);
  assert.deepEqual(await read(outsider.id, '/organizations/workspaces'), []);
});

test('the legacy coach keeps seed club and venue context alongside an owned nonclub page, once each', async () => {
  P.clubPage(C.CLUB_ID);
  const other = fixture(W.ME_ID, 'FAN_CLUB');
  const rows = await read(W.ME_ID, '/organizations/workspaces');
  const seed = rows.filter(row => row.id === C.ORG_ID);
  assert.equal(seed.length, 1);
  assert.equal(seed[0].clubId, C.CLUB_ID);
  assert.equal(seed[0].venueCount, C.organization.venueRelationships.length);
  assert.deepEqual(seed[0].kinds, ['CLUB', 'VENUE']);
  assert.equal(rows.filter(row => row.id === other.organizationId).length, 1);
  const legacy = await read(W.ME_ID, `/organizations/${C.ORG_ID}/workspace`);
  assert.equal(legacy.clubId, C.CLUB_ID);
  assert.equal(legacy.venueCount, seed[0].venueCount);
});

test('nonclub ownership stays separate from football membership and directory reads preserve one-club enforcement', async () => {
  const owner = account();
  fixture(owner.id, 'FAN_CLUB'); fixture(owner.id, 'BUSINESS'); fixture(owner.id, 'PAGE');
  assert.equal((await read(owner.id, '/organizations/workspaces')).length, 3);
  assert.equal(P.clubOf(owner.id), null);
  assert.equal((await read(owner.id, '/clubs/my-membership-context')).hasClubMembership, false);
  assert.ok((await read(owner.id, '/users/me')).navigationCapabilities.workspaces.every(row => row.id === 'organization.workspace'));
  const club = fixture(owner.id, 'CLUB');
  await read(owner.id, '/organizations/workspaces');
  const second = P.createPage(owner.id, { pageKind: 'CLUB', displayName: `Second ${randomUUID()}` });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'ONE_CLUB');
  assert.equal(P.clubOf(owner.id).ref.id, club.clubId);
});

test('staff return links follow existing page authority and disappear when that relationship ends', async () => {
  const owner = account(), admin = account(), coach = account();
  const organization = fixture(owner.id, 'PAGE'), club = fixture(owner.id, 'CLUB');
  organization.staff.set(admin.id, 'ADMIN'); organization.staff.set(coach.id, 'COACH'); club.staff.set(coach.id, 'COACH');
  assert.equal((await read(admin.id, '/organizations/workspaces'))[0].canOpenWorkspace, true);
  const rows = await read(coach.id, '/organizations/workspaces');
  assert.equal(rows.find(row => row.id === organization.organizationId)?.canOpenWorkspace, false);
  assert.equal(rows.find(row => row.id === club.organizationId)?.canOpenWorkspace, true);
  assert.equal((await read(coach.id, `/clubs/${club.clubId}/workspace-entry`)).canOpenWorkspace, true);
  organization.staff.delete(coach.id); club.staff.delete(coach.id);
  assert.deepEqual(await read(coach.id, '/organizations/workspaces'), []);
});
