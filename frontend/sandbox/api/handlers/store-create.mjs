// Process-local counterpart of the accepted Store create contract. No DB/concurrency parity is claimed.
import { reply } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as W from '../world.mjs';
import * as P from '../pages-data.mjs';
import * as V from '../viewer.mjs';

const receipts = new Map();
// Seed once, before any archive/removal. Every create/update path shares this process-lifetime registry.
const consumedVariantIds = new Set(C.products.flatMap(p => (p.variants ?? []).map(v => v.id).filter(Number.isSafeInteger)));
let variantSequence = Math.max(0, ...consumedVariantIds);
export function allocateStoreVariantId() {
  do { variantSequence++; } while (consumedVariantIds.has(variantSequence));
  consumedVariantIds.add(variantSequence);
  return variantSequence;
}
const problem = (status, message) => reply(status, { status, message });
const header = (headers, name) => Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
function manager(clubId, headers) {
  const club = W.clubById(Number(clubId)), actor = V.viewerId(headers), page = P.clubPage(Number(clubId));
  if (!club) return { error: problem(404, 'Club not found.') };
  if (club.status === 'DISSOLVED' || page?.status === 'DELETED') return { error: problem(409, 'This club is not operating.') };
  const restrictedPersona = actor === W.ME_ID && Number(clubId) === C.CLUB_ID && /gk-sandbox-persona=(analyst|member)(?:;|$)/.test(headers?.cookie ?? '');
  if (restrictedPersona || !['OWNER', 'ADMIN', 'CLUB_ADMIN'].includes(P.roleOf(page, actor))) return { error: problem(403, 'Current owner or administrator access is required.') };
  return { club, actor };
}
function normalize(body) {
  const variants = body?.variants ?? (body?.sizes?.length ? body.sizes.map(label => ({ label, stock: 0 })) : [{ label: 'One size', stock: 0 }]);
  return { name: String(body?.name ?? '').trim(), description: body?.description ?? null, price: body?.price,
    currency: body?.currency ?? 'GEL', category: body?.category ?? 'OTHER', active: body?.active ?? false,
    images: body?.images ?? [], sizes: variants.map(v => v.label), variants: variants.map(v => ({ id: v.id, label: v.label, stock: v.stock })) };
}
function invalid(p) {
  if (!p.name || p.name.length > 120 || (p.description != null && (typeof p.description !== 'string' || p.description.length > 2000))) return true;
  if (!Number.isFinite(p.price) || p.price <= 0 || p.price > 99999999.99 || Number(p.price.toFixed(2)) !== p.price) return true;
  if (!['GEL', 'EUR', 'GBP', 'USD'].includes(p.currency) || !['SHIRT','FOOTWEAR','TRAINING','EQUIPMENT','ACCESSORIES','TICKETS','MEMBERSHIP','EVENT','OTHER'].includes(p.category) || typeof p.active !== 'boolean') return true;
  if (!Array.isArray(p.images) || p.images.length > 8 || p.images.some(s => typeof s !== 'string' || s.length > 2048 || /[|\\]/.test(s) || s.includes('..') || !/^(https:\/\/|\/uploads\/|\/api\/media\/)/.test(s))) return true;
  if (!p.variants.length || p.variants.length > 20 || p.variants.some(v => v.id != null || typeof v.label !== 'string' || !v.label.trim() || v.label.trim().length > 40 || v.label.includes('|') || v.label.startsWith('__edit_') || !Number.isInteger(v.stock) || v.stock < 0 || v.stock > 1000000)) return true;
  return new Set(p.variants.map(v => v.label.trim().toLowerCase())).size !== p.variants.length;
}
const fingerprint = p => JSON.stringify({ ...p, price: p.price.toFixed(2), variants: p.variants.map(v => ({ label: v.label.trim(), stock: v.stock })) });
export function storeManagerProducts({ params, headers }) {
  const access = manager(params.id, headers);
  return access.error ?? C.products.filter(p => p.clubId === Number(params.id) && !p.archivedAt).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function storeCreate(request, legacyCreate) {
  const { params, body, headers } = request, access = manager(params.id, headers);
  if (access.error) return access.error; // Every replay checks present authority/lifecycle before revealing a receipt.
  const key = header(headers, 'idempotency-key');
  if (key == null) return legacyCreate();
  if (typeof key !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key)) return problem(400, 'Idempotency-Key must be a UUID.');
  let input;
  try { input = normalize(body); if (invalid(input)) return problem(400, 'Invalid product details.'); }
  catch { return problem(400, 'Invalid product details.'); }
  const receiptKey = `${access.actor}:${Number(params.id)}:${key.toLowerCase()}`, intent = fingerprint(input), prior = receipts.get(receiptKey);
  if (prior) {
    if (prior.intent !== intent) return problem(409, 'This create key belongs to different product details.');
    const product = C.products.find(p => p.id === prior.id && p.clubId === Number(params.id) && !p.archivedAt);
    return product ? reply(201, product) : problem(409, 'The accepted product is no longer available for this create.');
  }
  const id = C.nextId(), club = access.club;
  const product = { ...input, id, clubId: Number(params.id), version: 0, clubName: club.name, clubLogoUrl: club.logoUrl,
    clubCityName: club.city ?? club.cityName, clubCountryName: club.country ?? 'Georgia', sellerKind: 'CLUB', collection: null,
    createdAt: C.nowIso(), variants: input.variants.map(v => ({ id: allocateStoreVariantId(), label: v.label.trim(), stock: v.stock })) };
  C.products.push(product); receipts.set(receiptKey, { intent, id });
  return reply(201, product);
}

// Existing PATCH body.version and DELETE query.version contract, scoped before any mutation.
function managedProduct({ params, headers }) {
  const access = manager(params.id, headers);
  if (access.error) return access;
  const product = C.products.find(p => p.id === Number(params.pid) && p.clubId === Number(params.id) && !p.archivedAt);
  return product ? { product } : { error: problem(404, 'Store product not found.') };
}
const changed = () => problem(409, 'This product changed or its version is missing. Reload products before saving or archiving.');
export function storeUpdate(request) {
  const access = managedProduct(request);
  if (access.error) return access.error;
  const { product } = access, body = request.body;
  if (!Number.isSafeInteger(body?.version) || body.version !== product.version) return changed();
  if (body.sizes != null && body.variants == null) return problem(400, 'Update variant labels and stock together.');
  const fields = ['name', 'description', 'price', 'currency', 'category', 'images', 'active'];
  const updates = Object.fromEntries(fields.filter(key => body[key] != null).map(key => [key, body[key]]));
  let projection;
  try {
    // PATCH validates submitted fields. Existing synthetic fixture photos stand in for prior attachments.
    const images = body.images == null ? [] : body.images.filter(url => !(product.images ?? []).includes(url));
    projection = normalize({ name: 'Existing product', price: 1, ...updates, images,
      variants: body.variants?.map(v => ({ ...v, id: undefined })) });
    if (invalid(projection)) return problem(400, 'Invalid product details.');
    if (body.variants != null) {
      const existing = new Set((product.variants ?? []).map(v => v.id)), kept = new Set();
      for (const variant of body.variants) {
        if (variant.id != null && (!Number.isSafeInteger(variant.id) || !existing.has(variant.id) || kept.has(variant.id))) return problem(400, 'Invalid variant ID.');
        if (variant.id != null) kept.add(variant.id);
      }
    }
  } catch { return problem(400, 'Invalid product details.'); }
  // Complete validation before changing fields, stock, IDs or revision.
  const next = structuredClone(updates);
  if (next.name != null) next.name = projection.name;
  if (body.variants != null) {
    next.variants = body.variants.map(v => ({ id: v.id ?? allocateStoreVariantId(), label: v.label.trim(), stock: v.stock })).sort((a, b) => a.id - b.id);
    next.sizes = body.variants.map(v => v.label);
  }
  Object.assign(product, next, { version: product.version + 1, updatedAt: C.nowIso() });
  return product;
}
export function storeArchive(request) {
  const access = managedProduct(request);
  if (access.error) return access.error;
  const rawVersion = request.query?.get('version'), version = rawVersion == null || !/^[+-]?\d+$/.test(rawVersion) ? NaN : Number(rawVersion);
  if (!Number.isSafeInteger(version) || version !== access.product.version) return changed();
  // Retire from the shared public collection, preserving the prototype's removal behavior.
  // The create receipt remains consumed and can never recreate this ID.
  C.products.splice(C.products.indexOf(access.product), 1);
  return reply(200, { message: 'Store product archived.' });
}
