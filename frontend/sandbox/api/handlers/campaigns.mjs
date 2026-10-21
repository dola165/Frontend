// Synthetic API: fundraising (campaigns). Clubs raise money for a project; donations are taken on GoFundMe, which the
// club links from its fundraiser. A club's own management of its fundraisers stays in club.mjs.
//
// BACKEND NEEDED (docs/claude-sandbox/BACKEND_NEEDS.md, "Fundraising"): `donateUrl` and `donations` on campaigns,
// `near` and the sorts RELEVANCE / RAISED / CLOSEST on /campaigns, and GET /campaigns/front.
import { get, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';

const num = (q, key, fallback) => { const v = q.get(key); return v == null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v); };
const pageOf = q => Math.max(0, num(q, 'page', 0));
const sizeOf = (q, d = 24) => Math.min(200, Math.max(1, num(q, 'size', d)));
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const lower = F.lower;
const cityOf = name => { const key = Object.keys(W.cities).find(c => lower(c) === lower(name).trim()); return key ? { name: key, ...W.cities[key] } : null; };
const areaOf = (q, headers) => cityOf(q.get('near')) ?? cityOf(V.preferencesOf(V.viewerId(headers))?.town?.name) ?? cityOf('Tbilisi');

const percent = c => c.goalAmount ? Math.min(100, (c.reportedAmount ?? 0) / c.goalAmount * 100) : 0;
const distanceFrom = (area, c) => { const club = W.clubById(c.clubId); return area && club?.lat != null ? F.kmBetween(area.lat, area.lng, club.lat, club.lng) : null; };
/** How well a fundraiser fits the person: their followed clubs first, then nearby, then the ones nearly there. */
const relevance = (c, { follows, area }) => (follows.has(c.clubId) ? 40 : 0) + (area && lower(W.clubById(c.clubId)?.city) === lower(area.name) ? 20 : 0) + percent(c) / 5;
const sorter = (sort, context) => (a, b) =>
  sort === 'ENDING' ? (a.endsOn ?? '').localeCompare(b.endsOn ?? '')
  : sort === 'RAISED' ? (b.reportedAmount ?? 0) - (a.reportedAmount ?? 0)
  : sort === 'CLOSEST' ? percent(b) - percent(a)
  : sort === 'RELEVANCE' ? relevance(b, context) - relevance(a, context) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  : Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
const published = () => F.campaigns.filter(c => c.status !== 'DRAFT' && c.status !== 'ARCHIVED');
/** A fundraiser as the lists show it, with how far its club is from the area. */
const view = (c, area) => ({ ...c, distanceKm: distanceFrom(area, c) });

// ============================================================== front
get('/campaigns/front', ({ query: q, headers }) => {
  const follows = V.clubFollowsOf(V.viewerId(headers)), area = areaOf(q, headers);
  const active = published().filter(c => c.phase === 'ACTIVE').map(c => view(c, area));
  const near = active.filter(c => c.distanceKm != null).sort((a, b) => a.distanceKm - b.distanceKm);
  const closest = active.filter(c => percent(c) < 100).sort((a, b) => percent(b) - percent(a));
  return { city: area?.name ?? null, near: near.slice(0, 10), closest: closest.slice(0, 10), followed: active.filter(c => follows.has(c.clubId)), fresh: [...active].sort(sorter('NEWEST')).slice(0, 10),
    active: active.length, raised: active.reduce((n, c) => n + (c.reportedAmount ?? 0), 0) };
});

// ============================================================== catalogue
get('/campaigns/locations', ({ query: q }) => [...new Map(published().filter(c => !q.get('clubId') || c.clubId === Number(q.get('clubId'))).map(c => [c.city, { country: c.country ?? 'Georgia', city: c.city }])).values()]);
get('/campaigns', ({ query: q, headers }) => {
  const clubId = num(q, 'clubId', null), text = q.get('query') || q.get('q'), category = q.get('category'), country = q.get('country'), city = q.get('city'), state = q.get('state') || 'ACTIVE', sort = q.get('sort') || 'NEWEST';
  const area = cityOf(q.get('near')), context = { follows: V.clubFollowsOf(V.viewerId(headers)), area };
  const list = published().filter(c => clubId == null || c.clubId === clubId)
    .filter(c => state === 'ALL' || (state === 'ENDED' ? c.phase === 'ENDED' : c.phase === 'ACTIVE'))
    .filter(c => F.matchesText(text, c.title, c.summary, c.clubName)).filter(c => !category || c.category === category)
    .filter(c => !country || lower(c.country) === lower(country)).filter(c => !city || lower(c.city) === lower(city))
    .sort(sorter(sort, context)).map(c => view(c, area));
  return F.springPage(list, pageOf(q), sizeOf(q));
});
get('/campaigns/:id', ({ params }) => published().find(campaign => campaign.id === Number(params.id)) || notFound('This fundraiser is unavailable.'));
