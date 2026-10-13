// Synthetic API: the store. Products come from two kinds of seller (world-football.mjs): GrassKickZ's own
// equipment and the clubs' stores. A club's management of its own products stays in club.mjs.
//
// BACKEND NEEDED (docs/claude-sandbox/BACKEND_NEEDS.md, "Store"): `sellerKind` and `collection` on products,
// `seller`, `collection`, `country`, `near` and `sort=RELEVANCE` on /store/products, and GET /store/front.
import { get, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';

const num = (q, key, fallback) => { const v = q.get(key); return v == null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v); };
const pageOf = q => Math.max(0, num(q, 'page', 0));
const sizeOf = (q, d = 24) => Math.min(200, Math.max(1, num(q, 'size', d)));
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const lower = F.lower;

const sellerKind = p => p.sellerKind ?? (p.clubId ? 'CLUB' : 'GRASSKICKZ');
const active = () => F.products.filter(p => p.active);
const inStock = p => p.variants.some(v => v.stock > 0);
/** A known city with its centre, found case-insensitively; null for an unknown name. */
const cityOf = name => { const key = Object.keys(W.cities).find(c => lower(c) === lower(name).trim()); return key ? { name: key, ...W.cities[key] } : null; };
/** The area the storefront speaks of: `near` in the request, else the person's town, else Tbilisi. */
const areaOf = (q, headers) => cityOf(q.get('near')) ?? cityOf(V.preferencesOf(V.viewerId(headers))?.town?.name) ?? cityOf('Tbilisi');

/** Clubs with something on sale, as the storefront's tiles: where they are and how far from the area. */
function sellers(area, follows) {
  const counts = new Map();
  for (const p of active()) if (p.clubId) counts.set(p.clubId, (counts.get(p.clubId) ?? 0) + 1);
  return [...counts].map(([clubId, products]) => {
    const c = W.clubById(clubId);
    return { clubId, name: c.name, logoUrl: c.logoUrl, city: c.city, products, distanceKm: area && c.lat != null ? F.kmBetween(area.lat, area.lng, c.lat, c.lng) : null, followed: follows.has(clubId) };
  });
}

/** How well a product fits the person: in stock first, then clubs they follow, then clubs in their area, then GrassKickZ's own. */
const relevance = (p, { follows, area }) => (inStock(p) ? 8 : 0) + (p.clubId && follows.has(p.clubId) ? 4 : 0) + (area && p.clubCityName && lower(p.clubCityName) === lower(area.name) ? 2 : 0) + (sellerKind(p) === 'GRASSKICKZ' ? 1 : 0);

// ============================================================== storefront
get('/store/front', ({ query: q, headers }) => {
  const viewer = V.viewerId(headers), follows = V.clubFollowsOf(viewer), area = areaOf(q, headers);
  const all = sellers(area, follows);
  const near = all.filter(s => s.distanceKm != null).sort((a, b) => a.distanceKm - b.distanceKm || b.products - a.products);
  const own = active().filter(p => sellerKind(p) === 'GRASSKICKZ');
  const collections = [...new Set(own.map(p => p.collection).filter(Boolean))].map(id => ({ id, products: own.filter(p => p.collection === id).length, image: own.find(p => p.collection === id)?.images[0] ?? null }));
  return { city: area?.name ?? null, collections, near: near.slice(0, 12), followed: all.filter(s => s.followed).sort((a, b) => b.products - a.products), sellers: all.length, own: own.length };
});

// ============================================================== catalogue
get('/store/locations', ({ query: q }) => [...new Map(active().filter(p => p.clubCityName).filter(p => !q.get('clubId') || p.clubId === Number(q.get('clubId'))).map(p => [p.clubCityName, { country: p.clubCountryName ?? 'Georgia', city: p.clubCityName }])).values()]);
get('/store/products', ({ query: q, headers }) => {
  const clubId = num(q, 'clubId', null), text = q.get('query') || q.get('q'), category = q.get('category'), collection = q.get('collection'), seller = lower(q.get('seller'));
  const country = q.get('country'), city = q.get('city'), variant = q.get('variant'), min = num(q, 'minPrice', null), max = num(q, 'maxPrice', null), sort = q.get('sort') || 'NEWEST';
  const context = { follows: V.clubFollowsOf(V.viewerId(headers)), area: cityOf(q.get('near')) };
  const list = active()
    .filter(p => clubId == null || p.clubId === clubId)
    .filter(p => !seller || (seller === 'grasskickz' ? sellerKind(p) === 'GRASSKICKZ' : seller === 'clubs' ? sellerKind(p) === 'CLUB' : true))
    .filter(p => !collection || lower(p.collection) === lower(collection))
    .filter(p => F.matchesText(text, p.name, p.clubName, p.description)).filter(p => !category || p.category === category)
    .filter(p => !country || lower(p.clubCountryName) === lower(country)).filter(p => !city || lower(p.clubCityName) === lower(city))
    .filter(p => !variant || p.variants.some(v => lower(v.label) === lower(variant))).filter(p => (min == null || p.price >= min) && (max == null || p.price <= max))
    .sort((a, b) => sort === 'PRICE_LOW' ? a.price - b.price : sort === 'PRICE_HIGH' ? b.price - a.price
      : sort === 'RELEVANCE' ? relevance(b, context) - relevance(a, context) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
      : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return F.springPage(list, pageOf(q), sizeOf(q));
});
get('/store/products/:id', ({ params }) => F.productById(params.id) || notFound('This product is unavailable.'));

// ============================================================== cart
get('/store/cart/quote', ({ query: q }) => {
  const lines = q.getAll('item').map(s => s.split(':').map(Number)).map(([variantId, quantity]) => ({ v: F.variantById(variantId), quantity })).filter(l => l.v);
  const first = lines[0]?.v.product;
  return { clubId: first?.clubId ?? 0, clubName: first?.clubName ?? '', sellerKind: first ? sellerKind(first) : null, currency: first?.currency ?? 'GEL',
    lines: lines.map(({ v, quantity }) => ({ variantId: v.id, quantity, productId: v.product.id, name: v.product.name, variant: v.label, unitAmount: v.product.price * 100, lineAmount: v.product.price * quantity * 100 })),
    subtotal: lines.reduce((n, { v, quantity }) => n + v.product.price * quantity * 100, 0), checkoutEnabled: false, message: 'Online payment is not available yet. Contact the seller to complete your order.' };
});
