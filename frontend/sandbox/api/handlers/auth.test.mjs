import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../router.mjs';
import * as V from '../viewer.mjs';

const request = (method, path, body, headers = {}) => handleApi({ method, path, body, headers, query: new URLSearchParams() });
const clearedPersonas = response => {
  assert.ok(response.headers['set-cookie'].includes('gk-sandbox-family=; Path=/; Max-Age=0'));
  assert.ok(response.headers['set-cookie'].includes('gk-sandbox-persona=; Path=/; Max-Age=0'));
};

test('register/login/logout retire demo personas while preserving the registered account’s own family', async () => {
  const credentials = { email: 'auth-isolation@example.test', password: 'SyntheticOnly-2026' };
  const signup = await request('POST', '/auth/register', { ...credentials, fullName: 'Synthetic Person', role: 'FAN', dateOfBirth: '1995-05-12' }, { cookie: 'gk-sandbox-family=1; gk-sandbox-persona=member' });
  assert.equal(signup.status, 201);
  clearedPersonas(signup);
  const account = V.accountByLogin(credentials.email);
  const headers = { authorization: `Bearer ${V.accessToken(account.id)}` };
  const newcomer = await request('GET', '/users/me', undefined, headers);
  assert.deepEqual(newcomer.body.navigationCapabilities.workspaces, []);

  const signedIn = await request('POST', '/auth/login', credentials);
  assert.equal(signedIn.status, 200);
  clearedPersonas(signedIn);
  const child = await request('POST', '/family/children', { fullName: 'Own Child', dateOfBirth: '2015-03-04', responsible: true, requestId: 'isolation-child' }, headers);
  assert.equal(child.status, 201);
  const parent = await request('GET', '/users/me', undefined, headers);
  assert.deepEqual(parent.body.navigationCapabilities.workspaces.map(item => item.id), ['parent.hub']);
  const family = await request('GET', '/family', undefined, headers);
  assert.deepEqual(family.body.children.map(item => item.name), ['Own Child']);
  clearedPersonas(await request('POST', '/auth/logout', {}, headers));
  assert.equal(account.children.length, 1);
  clearedPersonas(await request('POST', '/auth/login', { email: 'coach@talanti.ge', password: 'synthetic' }));
});
