import assert from 'node:assert/strict';
import test from 'node:test';
import { listRoutes } from './router.mjs';
import './handlers/pages.mjs';

test('page handlers defer private squad projections without dropping public page/team actions', () => {
  const routes = listRoutes();
  for (const privateRoute of ['GET /squad-communication', 'GET /squad-communication/:id', 'GET /squad-communication/:id/messages']) {
    assert.equal(routes.includes(privateRoute), false, privateRoute + ' must reach the canonical access-controlled handler');
  }
  for (const publicRoute of ['POST /organizations/setup', 'GET /clubs/:id/page', 'PUT /clubs/:id/page/boxes/:key', 'GET /clubs/:id/squads', 'GET /clubs/:id/staff-directory']) {
    assert.equal(routes.includes(publicRoute), true, publicRoute + ' remains registered');
  }
});
