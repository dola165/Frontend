import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';

// All actors/pages/products are process-local fixtures; no HTTP or actual account/role operation.
globalThis.fetch = () => { throw new Error('Network is forbidden in Store mutation probes.'); };
let seq = 0;
const owner = () => {
  const n = ++seq, actor = V.createAccount({ fullName: `Mutation fixture ${n}`, email: `store-mutation-${n}@example.test`, password: 'ProcessLocalOnly123', dateOfBirth: '1990-01-01' }).id;
  return { actor, club: P.createPage(actor, { displayName: `Mutation club ${n}`, pageKind: 'CLUB', location: { city: 'Tbilisi' } }).body.clubId, headers: { authorization: `Bearer ${V.accessToken(actor)}` } };
};
const seed = () => ({ actor: W.ME_ID, club: C.CLUB_ID, headers: { authorization: `Bearer ${V.accessToken(W.ME_ID)}` } });
const input = { name: 'Process-local mutation item', description: 'Not a real product', price: 12.3, currency: 'EUR', category: 'SHIRT', active: false, images: [], variants: [{ label: 'L', stock: 4 }] };
const route = async (a, method, suffix = '', body, query = new URLSearchParams(), headers = {}) => structuredClone(await handleApi({ method, path: `/clubs/${a.club}/store/products${suffix}`, body, query, headers: { ...a.headers, ...headers } }));
const create = async (a, key = randomUUID()) => route(a, 'POST', '', input, undefined, { 'Idempotency-Key': key });
const version = value => new URLSearchParams({ version: String(value) });
const current = id => C.products.find(p => p.id === id);

test('new-club recovery supports explicit current-version update, stable variants and consumed archive receipt', async () => {
  const a = owner(), key = randomUUID(), created = await create(a, key), replay = await create(a, key);
  assert.equal(created.status, 201); assert.equal(replay.body.id, created.body.id); assert.notEqual(a.club, C.CLUB_ID);
  const list = await route(a, 'GET', '/all'); assert.equal(list.body.filter(p => p.id === created.body.id).length, 1);
  const update = { name: 'Explicit held answer', price: 19.5, currency: 'GBP', active: true, version: replay.body.version, variants: replay.body.variants.map(v => ({ ...v, label: 'Adult L', stock: 8 })) };
  const edited = await route(a, 'PATCH', `/${created.body.id}`, update);
  assert.equal(edited.status, 200); assert.equal(edited.body.name, update.name); assert.equal(edited.body.version, 1);
  assert.deepEqual(edited.body.variants, update.variants); assert.equal(edited.body.currency, 'GBP'); assert.equal(edited.body.active, true);
  const latest = await create(a, key); assert.deepEqual(latest.body, edited.body);
  const archived = await route(a, 'DELETE', `/${created.body.id}`, undefined, version(edited.body.version));
  assert.equal(archived.status, 200); assert.equal(archived.body.message, 'Store product archived.');
  assert.equal(current(created.body.id), undefined);
  const publicRead = await handleApi({ method: 'GET', path: `/store/products/${created.body.id}`, query: new URLSearchParams(), headers: a.headers });
  assert.equal(publicRead.status, 404);
  const remaining = C.products.length;
  assert.equal((await create(a, key)).status, 409);
  assert.equal((await route(a, 'GET', '/all')).body.some(p => p.id === created.body.id), false);
  assert.equal(C.products.length, remaining);
});

test('foreign club path and outsider actor cannot update or archive another clubs product', async () => {
  const a = seed(), outsider = owner(), product = (await create(a)).body, before = structuredClone(current(product.id));
  const results = [];
  for (const [actor, expected] of [[outsider, 404], [{ ...outsider, club: a.club }, 403]]) {
    results.push([(await route(actor, 'PATCH', `/${product.id}`, { name: 'Forbidden change', version: product.version })).status, expected]);
    results.push([(await route(actor, 'DELETE', `/${product.id}`, undefined, version(product.version))).status, expected]);
  }
  assert.deepEqual(results, [[404, 404], [404, 404], [403, 403], [403, 403]]);
  assert.deepEqual(current(product.id), before);
});

test('withdrawn current leadership is refused for both mutations without changing the record', async () => {
  const a = seed(), product = (await create(a)).body, page = P.clubPage(a.club), savedOwner = page.ownerId, savedStaff = new Map(page.staff);
  const before = structuredClone(current(product.id));
  try {
    page.ownerId = null; page.staff.delete(a.actor);
    const patch = await route(a, 'PATCH', `/${product.id}`, { name: 'No longer allowed', version: product.version });
    const archive = await route(a, 'DELETE', `/${product.id}`, undefined, version(product.version));
    assert.equal(patch.status, 403); assert.equal(archive.status, 403); assert.deepEqual(current(product.id), before);
  } finally { page.ownerId = savedOwner; page.staff = savedStaff; }
});

test('a non-operating club refuses both mutations before changing the record', async () => {
  const a = seed(), product = (await create(a)).body, club = W.clubById(a.club), before = structuredClone(current(product.id)), status = club.status;
  try {
    club.status = 'DISSOLVED';
    const patch = await route(a, 'PATCH', `/${product.id}`, { active: true, version: product.version });
    const archive = await route(a, 'DELETE', `/${product.id}`, undefined, version(product.version));
    assert.equal(patch.status, 409); assert.equal(archive.status, 409); assert.deepEqual(current(product.id), before);
  } finally { club.status = status; }
});

test('body PATCH revision, query archive revision and variant ownership are checked atomically', async () => {
  const a = seed(), product = (await create(a)).body, other = (await create(a)).body, before = structuredClone(current(product.id));
  for (const patch of [{ name: 'Missing revision' }, { name: 'Stale revision', version: 9 }, { version: product.version, variants: other.variants }]) {
    const response = await route(a, 'PATCH', `/${product.id}`, patch);
    assert.equal(response.status, patch.variants ? 400 : 409); assert.deepEqual(current(product.id), before);
  }
  for (const query of [new URLSearchParams(), version(9)]) {
    const response = await route(a, 'DELETE', `/${product.id}`, { version: product.version }, query);
    assert.equal(response.status, 409); assert.deepEqual(current(product.id), before);
  }
  const valid = await route(a, 'PATCH', `/${product.id}`, { version: product.version, variants: product.variants });
  assert.equal(valid.status, 200); assert.equal(valid.body.version, product.version + 1); assert.deepEqual(valid.body.variants, product.variants);
});

test('existing seed product permits submitted updates while preserving unchanged fixture attachments', async () => {
  const a = seed(), product = C.products.find(p => p.clubId === a.club && p.images?.some(url => url.startsWith('/sandbox-media/'))), before = structuredClone(product);
  assert.ok(product);
  try {
    const toggle = await route(a, 'PATCH', `/${product.id}`, { active: !product.active, version: product.version });
    assert.equal(toggle.status, 200); assert.equal(toggle.body.active, !before.active); assert.deepEqual(toggle.body.images, before.images);
    const edit = await route(a, 'PATCH', `/${product.id}`, { name: 'Explicit seed edit', images: before.images, variants: before.variants, version: product.version });
    assert.equal(edit.status, 200); assert.equal(edit.body.name, 'Explicit seed edit'); assert.deepEqual(edit.body.images, before.images); assert.deepEqual(edit.body.variants, before.variants);
    const currentState = structuredClone(product);
    const invalid = await route(a, 'PATCH', `/${product.id}`, { images: ['/sandbox-media/not-an-existing-attachment.svg'], version: product.version });
    assert.equal(invalid.status, 400); assert.deepEqual(product, currentState);
  } finally { for (const key of Object.keys(product)) delete product[key]; Object.assign(product, before); }
});
