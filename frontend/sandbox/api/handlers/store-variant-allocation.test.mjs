import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { handleApi } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';

globalThis.fetch = () => { throw new Error('Process-local allocator control forbids network.'); };
test('seed, legacy and keyed variant identities stay consumed after removal and archive', async () => {
  const headers = { authorization: `Bearer ${V.accessToken(W.ME_ID)}` }, club = C.CLUB_ID;
  const input = { name: 'Allocator fixture', price: 12.3, currency: 'EUR', active: true, images: [], variants: [{ label: 'Small', stock: 4 }] };
  const call = async (method, suffix = '', body, query = new URLSearchParams(), key) => structuredClone(await handleApi({ method, path: `/clubs/${club}/store/products${suffix}`, body, query, headers: { ...headers, ...(key ? { 'Idempotency-Key': key } : {}) } }));
  const consumed = new Set(C.products.flatMap(p => p.variants ?? []).map(v => v.id));
  const fresh = (product, kept = new Set()) => {
    for (const v of product.variants) {
      if (kept.has(v.id)) continue;
      assert.ok(Number.isSafeInteger(v.id) && v.id > 0); assert.equal(consumed.has(v.id), false, `Variant ${v.id} was already consumed`); consumed.add(v.id);
    }
  };
  const highestSeed = Math.max(...consumed), seed = C.products.find(p => p.clubId === club && p.variants?.some(v => v.id === highestSeed));
  assert.ok(seed);
  assert.equal((await call('DELETE', `/${seed.id}`, undefined, new URLSearchParams({ version: String(seed.version) }))).status, 200);
  const legacy = await call('POST', '', input); assert.equal(legacy.status, 201); fresh(legacy.body);
  const added = await call('PATCH', `/${legacy.body.id}`, { version: legacy.body.version, variants: [...legacy.body.variants, ...Array.from({ length: 10 }, (_, i) => ({ label: `Option ${i + 1}`, stock: 2 }))] });
  assert.equal(added.status, 200); fresh(added.body, new Set(legacy.body.variants.map(v => v.id)));
  const removedId = added.body.variants.find(v => v.label === 'Option 10').id;
  const kept = added.body.variants.filter(v => v.id !== removedId);
  const removed = await call('PATCH', `/${legacy.body.id}`, { version: added.body.version, variants: kept });
  assert.equal(removed.status, 200); assert.deepEqual(removed.body.variants, kept);
  const legacyAfterRemoval = await call('POST', '', input); assert.equal(legacyAfterRemoval.status, 201); fresh(legacyAfterRemoval.body);
  const key = randomUUID(), keyed = await call('POST', '', input, undefined, key); assert.equal(keyed.status, 201); fresh(keyed.body);
  assert.equal((await call('DELETE', `/${keyed.body.id}`, undefined, new URLSearchParams({ version: String(keyed.body.version) }))).status, 200);
  assert.equal((await call('POST', '', input, undefined, key)).status, 409);
  const keyedAfterArchive = await call('POST', '', input, undefined, randomUUID()); assert.equal(keyedAfterArchive.status, 201); fresh(keyedAfterArchive.body);
  const legacyAfterArchive = await call('POST', '', input); assert.equal(legacyAfterArchive.status, 201); fresh(legacyAfterArchive.body);
  console.log(JSON.stringify({ highestSeed, removedId, legacyAfterRemovalIds: legacyAfterRemoval.body.variants.map(v => v.id), archivedKeyedIds: keyed.body.variants.map(v => v.id), keyedAfterArchiveIds: keyedAfterArchive.body.variants.map(v => v.id), legacyAfterArchiveIds: legacyAfterArchive.body.variants.map(v => v.id) }));
});
