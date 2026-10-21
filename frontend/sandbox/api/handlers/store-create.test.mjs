import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';

let n = 0;
const owner = () => {
  const account = V.createAccount({ fullName: `Store fixture ${++n}`, email: `store-fixture-${n}@example.test`, password: 'ProcessOnly123', dateOfBirth: '1990-01-01' });
  const result = P.createPage(account.id, { displayName: `Store fixture club ${n}`, pageKind: 'CLUB', location: { city: 'Tbilisi' } });
  return { actor: account.id, club: result.body.clubId, headers: { authorization: `Bearer ${V.accessToken(account.id)}` } };
};
const input = { name: 'Fixture shirt', description: 'Unsubmitted process-local data', price: 12.3, currency: 'EUR', category: 'SHIRT', active: false, images: [], variants: [{ label: 'L', stock: 4 }] };
const call = async (a, body = input, key = randomUUID()) => structuredClone(await handleApi({ method: 'POST', path: `/clubs/${a.club}/store/products`, query: new URLSearchParams(), body, headers: { ...a.headers, ...(key === null ? {} : { 'Idempotency-Key': key }) } }));

test('same key replays the current record and never overwrites later edits', async () => {
  const a = owner(), key = randomUUID(), first = await call(a, input, key);
  assert.equal(first.status, 201);
  const product = C.products.find(p => p.id === first.body.id);
  Object.assign(product, { version: 3, active: true, currency: 'GBP', name: 'Later saved name' }); product.variants[0].stock = 9;
  const replay = await call(a, input, key);
  assert.equal(replay.status, 201); assert.equal(replay.body.id, first.body.id); assert.equal(replay.body.version, 3); assert.equal(replay.body.variants[0].stock, 9); assert.equal(replay.body.currency, 'GBP'); assert.equal(replay.body.active, true);
  assert.equal((await call(a, { ...input, price: 14 }, key)).status, 409);
  assert.equal(C.products.filter(p => p.clubId === a.club).length, 1);
});
test('receipt scope and present leadership/lifecycle apply on every replay', async () => {
  const a = owner(), b = owner(), key = randomUUID(), first = await call(a, input, key), other = await call(b, input, key);
  assert.notEqual(first.body.id, other.body.id);
  P.clubPage(a.club).staff.set(b.actor, 'ADMIN');
  const sameClubOtherActor = await call({ ...b, club: a.club }, input, key);
  assert.notEqual(sameClubOtherActor.body.id, first.body.id);
  P.clubPage(a.club).ownerId = b.actor; P.clubPage(a.club).staff.delete(a.actor);
  assert.equal((await call(a, input, key)).status, 403);
  P.clubPage(a.club).ownerId = a.actor; W.clubById(a.club).status = 'DISSOLVED';
  assert.equal((await call(a, input, key)).status, 409);
});
test('deleted, archived and moved accepted products consume their keys permanently', async () => {
  for (const mode of ['deleted', 'archived', 'moved']) {
    const a = owner(), key = randomUUID(), first = await call(a, input, key), product = C.products.find(p => p.id === first.body.id);
    if (mode === 'deleted') C.products.splice(C.products.indexOf(product), 1);
    if (mode === 'archived') product.archivedAt = C.nowIso();
    if (mode === 'moved') product.clubId = -1;
    const count = C.products.length; assert.equal((await call(a, input, key)).status, 409); assert.equal(C.products.length, count);
  }
});
test('effective normalization ignores create version, preserves ordered intent, and distinct keys remain distinct', async () => {
  const a = owner(), key = randomUUID(), first = await call(a, input, key);
  assert.equal((await call(a, { ...input, name: ` ${input.name} `, version: 99 }, key)).body.id, first.body.id);
  assert.equal((await call(a, { ...input, active: true }, key)).status, 409);
  assert.equal((await call(a, { ...input, variants: [{ label: 'L', stock: 5 }] }, key)).status, 409);
  assert.notEqual((await call(a, input)).body.id, first.body.id);
  assert.equal((await call(a, input, 'invalid')).status, 400);
});
test('omitting the key preserves separate legacy seed-club creates', async () => {
  const a = { club: C.CLUB_ID, headers: { authorization: `Bearer ${V.accessToken(W.ME_ID)}` } };
  const first = await call(a, input, null), second = await call(a, input, null);
  assert.equal(first.status, 201); assert.equal(second.status, 201); assert.notEqual(first.body.id, second.body.id);
});
