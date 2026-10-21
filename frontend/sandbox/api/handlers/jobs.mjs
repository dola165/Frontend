// Synthetic API: jobs & volunteering, for everyone. Clubs post roles; people post too (a parent hiring a coach for
// a child, a coach or referee saying they are available). One list, two directions: HIRING (someone is wanted) and
// OFFERING (someone is available). A club's own management of its roles stays in club.mjs.
//
// BACKEND NEEDED (docs/claude-sandbox/BACKEND_NEEDS.md, "Jobs"): `direction`, `poster`, `pay`, `hours`, `licence`,
// `applyMethod`/`applyTarget` on jobs; a paged, filtered /jobs; GET /jobs/front; POST /jobs for people.
import { get, post, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';

const num = (q, key, fallback) => { const v = q.get(key); return v == null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v); };
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const bad = message => reply(400, { status: 400, message });
const lower = F.lower;
const cityOf = name => { const key = Object.keys(W.cities).find(c => lower(c) === lower(name).trim()); return key ? { name: key, ...W.cities[key] } : null; };
const areaOf = (q, headers) => cityOf(q.get('near')) ?? cityOf(V.preferencesOf(V.viewerId(headers))?.town?.name) ?? cityOf('Tbilisi');

/** Every open listing in the job shape: the clubs' roles, people's listings, and what was posted in this run. */
const all = () => [...F.roleList.map(F.jobView), ...F.jobListings.map(F.jobListingView), ...F.postedListings].filter(j => j.status === 'OPEN');
const placeOf = j => { if (j.clubId) { const c = W.clubById(j.clubId); return c?.lat != null ? { lat: c.lat, lng: c.lng } : null; } const city = cityOf(j.clubCityName); return city ? { lat: city.lat, lng: city.lng } : null; };
/** A listing with its place (a club's ground, or the person's town centre, said so) and how far that is from the area. */
const view = (j, area) => { const place = placeOf(j); return { ...j, place: place ? { ...place, approximate: j.clubId ? null : 'area' } : null, distanceKm: area && place ? F.kmBetween(area.lat, area.lng, place.lat, place.lng) : null }; };
const viewerRole = headers => { const id = V.viewerId(headers); return id === W.ME_ID ? W.me.role : V.account(id)?.role ?? null; };
/** How well a listing fits the person: their own line of work first, then clubs they follow, then nearby, newest last. */
const relevance = (j, { role, follows, area }) => (role === 'COACH' && j.category === 'COACHING' ? 20 : role === 'REFEREE' && j.category === 'MATCHDAY' ? 20 : 0) + (j.clubId && follows.has(j.clubId) ? 10 : 0) + (area && lower(j.clubCityName) === lower(area.name) ? 5 : 0);
const sorter = (sort, context) => (a, b) => sort === 'NEAREST' ? (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
  : sort === 'RELEVANCE' ? relevance(b, context) - relevance(a, context) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
  : Date.parse(b.createdAt) - Date.parse(a.createdAt);
const since = posted => posted === '7D' ? Date.now() - 7 * 86_400_000 : posted === '30D' ? Date.now() - 30 * 86_400_000 : 0;

// ============================================================== front
get('/jobs/front', ({ query: q, headers }) => {
  const viewer = V.viewerId(headers), follows = V.clubFollowsOf(viewer), area = areaOf(q, headers), context = { role: viewerRole(headers), follows, area };
  const open = all().map(j => view(j, area));
  const hiring = open.filter(j => j.direction !== 'OFFERING'), offering = open.filter(j => j.direction === 'OFFERING');
  const applied = [...F.jobApplications.keys()];
  const pins = [];
  for (const j of open) {
    if (j.clubId) { const c = W.clubById(j.clubId); if (c?.lat == null) continue; const pin = pins.find(p => p.kind === 'club' && p.clubId === j.clubId) ?? pins[pins.push({ kind: 'club', clubId: j.clubId, label: c.name, crest: c.logoUrl, lat: c.lat, lng: c.lng, count: 0 }) - 1]; pin.count++; }
    else { const city = cityOf(j.clubCityName); if (!city) continue; const pin = pins.find(p => p.kind === 'area' && p.label === city.name) ?? pins[pins.push({ kind: 'area', clubId: null, label: city.name, crest: null, lat: city.lat, lng: city.lng, count: 0 }) - 1]; pin.count++; }
  }
  return { city: area?.name ?? null, role: context.role, pins,
    forYou: [...hiring].sort(sorter('RELEVANCE', context)).slice(0, 10), near: hiring.filter(j => j.distanceKm != null).sort(sorter('NEAREST', context)).slice(0, 10),
    offering: [...offering].sort(sorter('NEAREST', context)).slice(0, 10), followed: hiring.filter(j => j.clubId && follows.has(j.clubId)), fresh: [...hiring].sort(sorter('NEWEST')).slice(0, 10),
    applications: open.filter(j => applied.includes(j.id)).map(j => ({ ...j, application: F.jobApplications.get(j.id) })), postings: open.filter(j => j.createdBy === viewer || (j.poster?.kind === 'CLUB' && j.clubId === W.me.clubId && viewer === W.ME_ID)).slice(0, 6),
    open: hiring.length, available: offering.length };
});

// ============================================================== the list
// Without `page` it answers as the backend does today: an array of the clubs' open roles (World's Jobs tab reads it).
get('/jobs', ({ query: q, headers }) => {
  const paged = q.has('page');
  const direction = (q.get('direction') || (paged ? 'ALL' : 'HIRING')).toUpperCase();
  const text = q.get('query') || q.get('q'), category = q.get('category'), terms = q.get('engagement') || q.get('terms'), hours = q.get('hours'), country = q.get('country'), city = q.get('city'), posted = q.get('posted'), clubId = num(q, 'clubId', null), poster = q.get('poster');
  const area = cityOf(q.get('near')), context = { role: viewerRole(headers), follows: V.clubFollowsOf(V.viewerId(headers)), area };
  const list = all().filter(j => direction === 'ALL' || (direction === 'OFFERING' ? j.direction === 'OFFERING' : j.direction !== 'OFFERING'))
    .filter(j => clubId == null || j.clubId === clubId).filter(j => !poster || (poster === 'clubs' ? j.poster?.kind === 'CLUB' : j.poster?.kind === 'PERSON'))
    .filter(j => F.matchesText(text, j.title, j.description, j.clubName, j.poster?.name)).filter(j => !category || j.category === category)
    .filter(j => !terms || terms === 'ALL' || j.engagementType === terms).filter(j => !hours || j.hours === hours)
    .filter(j => !country || lower(j.clubCountryName) === lower(country)).filter(j => !city || lower(j.clubCityName) === lower(city))
    .filter(j => !since(posted) || Date.parse(j.createdAt) >= since(posted))
    .map(j => view(j, area)).sort(sorter(q.get('sort') || (paged ? 'RELEVANCE' : 'NEWEST'), context));
  return paged ? F.springPage(list, Math.max(0, num(q, 'page', 0)), Math.min(200, Math.max(1, num(q, 'size', 24)))) : list;
});
get('/jobs/:id', ({ params, query: q }) => { const j = all().find(x => x.id === Number(params.id)); return j ? view(j, cityOf(q.get('near'))) : notFound('This listing is no longer open.'); });
get('/jobs/:id/application', ({ params }) => F.jobApplications.get(Number(params.id)) || null);
const apply = ({ params }) => { const j = all().find(x => x.id === Number(params.id)); if (!j) return notFound(); const a = { id: W.newId(), clubId: j.clubId ?? 0, status: 'PENDING' }; F.jobApplications.set(j.id, a); return reply(201, a); };
post('/jobs/:id/apply', apply);
post('/jobs/:id/applications', apply);

// ============================================================== posting (people and clubs alike)
post('/jobs', ({ body, headers }) => {
  if (!body?.title?.trim()) return bad('Give the listing a title.');
  if (!['CLUB', 'PERSON'].includes(body.posterKind)) return bad('Choose who is publishing this listing.');
  const viewer = V.viewerId(headers), person = V.account(viewer) ?? W.personById(viewer);
  if (!person) return reply(401, { status: 401, message: 'Sign in to publish.' });
  const asClub = body.posterKind === 'CLUB', club = asClub ? W.clubById(Number(body.clubId)) : null;
  if (asClub && !club) return notFound('This club is unavailable. Your listing was not published.');
  const memberPersona = viewer === W.ME_ID && /gk-sandbox-persona=member(?:;|$)/.test(headers?.cookie ?? '');
  if (asClub && (memberPersona || !['OWNER', 'ADMIN', 'COACH'].includes(P.roleOf(P.clubPage(club.id), viewer)))) return reply(403, { status: 403, message: 'Confirmed staff permission is required to publish for this club.' });
  if (asClub && body.direction === 'OFFERING') return bad('List yourself as available using your personal identity.');
  if (body.applyMethod === 'IN_APP' && (!club || body.category !== 'COACHING')) return bad('In-app applications are available for a club coaching job only.');
  const id = W.newId(), city = cityOf(body.city)?.name ?? club?.city ?? V.preferencesOf(viewer)?.town?.name ?? person.city ?? 'Tbilisi';
  const listing = { version: 1, id, clubId: club?.id ?? null, title: body.title.trim(), description: body.description ?? '', ageGroup: body.ageGroup ?? null, level: null, requiredRole: club && body.category === 'COACHING' && body.applyMethod === 'IN_APP' ? 'COACH' : null, status: 'OPEN', createdAt: W.iso(new Date()), createdBy: viewer,
    applicationCount: 0, category: body.category ?? 'OTHER', engagementType: body.engagementType ?? 'PAID', clubName: club?.name ?? null, clubLogoUrl: club?.logoUrl ?? null, clubCityName: city, clubCountryName: 'Georgia',
    direction: body.direction === 'OFFERING' ? 'OFFERING' : 'HIRING', poster: club ? { kind: 'CLUB', id: club.id, name: club.name, avatarUrl: club.logoUrl, city: club.city } : { kind: 'PERSON', id: viewer, name: person.fullName, avatarUrl: person.avatarUrl ?? null, city },
    pay: body.pay || null, hours: body.hours ?? null, licence: body.licence || null, applyMethod: body.applyMethod ?? (club ? 'IN_APP' : 'MESSAGE'), applyTarget: body.applyTarget || null };
  F.postedListings.unshift(listing);
  return reply(201, listing);
});
