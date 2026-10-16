// Synthetic API: football domain (map, venues, matches, competitions, schedules, journeys,
// tryouts, admissions discovery, roles, store, campaigns). See sandbox/README.md for conventions.
import * as R from '../router.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as F from '../world-football.mjs';
import * as S from '../world-social.mjs';
import * as C from '../world-club.mjs';
import * as P from '../pages-data.mjs';

// Every football answer is for the person asking: Dinamo's coach (the demo), a page owner's own clubs, or a plain fan
// with none. Set once per request, read by the listing views and the "mine" filters.
const viewerClubs = headers => { const viewer = V.viewerId(headers); return viewer === W.ME_ID ? [DINAMO] : P.ownedPages(viewer).map(page => page.clubId).filter(id => id != null); };
const viewerSquads = headers => { const clubs = viewerClubs(headers); return clubs.includes(DINAMO) ? F.DINAMO_SQUADS : W.squads.filter(s => clubs.includes(s.clubId)); };
const viewed = handler => context => { F.setViewerClubs(viewerClubs(context.headers)); return handler(context); };
const get = (path, handler) => R.get(path, viewed(handler)), post = (path, handler) => R.post(path, viewed(handler)), put = (path, handler) => R.put(path, viewed(handler)), patch = (path, handler) => R.patch(path, viewed(handler)), del = (path, handler) => R.del(path, viewed(handler));
const { reply } = R;

const { iso, local, isoDate, clubs, venues, squads, matches, clubById, venueById, personById } = W;
const squadById = F.sq;
const { DINAMO, TZ, at, plusMin, kmBetween, matchesText, springPage, pageResult, itemPage, slice } = F;
const num = (q, key, fallback) => { const v = q.get(key); return v == null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v); };
const pageOf = q => Math.max(0, num(q, 'page', 0));
const sizeOf = (q, d = 20) => Math.min(200, Math.max(1, num(q, 'size', d)));
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const conflict = message => reply(409, { status: 409, message });
const now = () => Date.now();
const parseWhen = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const inWindow = (start, end, from, to) => (!from || end >= from) && (!to || start <= to);

// ============================================================== map & discovery
const markerBase = { members: 0, followers: 0, verified: false, date: '', fee: '', ageGroup: '', status: '', countryName: 'Georgia', eventSubtype: null, scheduleEventId: null, logoUrl: null, joinPolicy: null, category: null };
function clubMarker(c) {
  const ages = [...new Set(F.squadsOf(c.id).map(s => s.ageGroup))];
  const group = F.admissionGroups.find(g => g.clubId === c.id);
  return { ...markerBase, entityId: c.id, entityType: 'CLUB', title: c.name, subtitle: F.CATEGORY_LABEL[F.clubCategory(c)], clubName: c.name, clubId: c.id, latitude: c.lat, longitude: c.lng,
    members: F.memberCount(c), followers: F.followerCount(c), verified: c.verified, fee: group ? `${group.terms.charges[0].amount} GEL / month` : '', addressText: c.address, ageGroup: ages.join(', '),
    status: c.verified ? 'VERIFIED' : 'ACTIVE', cityName: c.city, eventSubtype: 'CLUB', logoUrl: c.logoUrl, joinPolicy: F.joinPolicy(c), category: F.clubCategory(c) };
}
function stadiumMarker(v) {
  const owner = F.venueOwnerClub(v);
  return { ...markerBase, entityId: v.id, entityType: 'STADIUM', title: v.name, subtitle: `${v.pitches.length} ${v.pitches.length === 1 ? 'pitch' : 'pitches'} · ${v.surface}`, clubName: owner?.name ?? '', clubId: owner?.id ?? null,
    latitude: v.lat, longitude: v.lng, verified: v.kind === 'STADIUM' || Boolean(owner?.verified), fee: `from ${F.fromPrice(v)} GEL / hour`, addressText: `${v.district}, ${v.city}`, status: 'OPEN', cityName: v.city, eventSubtype: v.kind, logoUrl: owner?.logoUrl ?? null };
}
function matchMarkers() {
  const out = [];
  for (const m of matches.filter(m => m.status === 'SCHEDULED')) {
    const v = venueById(m.venueId), sq = squadById(m.squadId), home = m.home ? clubById(DINAMO) : clubById(m.opponentClubId), away = m.home ? clubById(m.opponentClubId) : clubById(DINAMO);
    if (!v) continue;
    out.push({ ...markerBase, entityId: m.id, entityType: 'MATCH', title: `${home.name} vs ${away.name}`, subtitle: `${sq.ageGroup === 'SENIOR' ? 'Senior' : sq.ageGroup} · ${m.kind === 'FRIENDLY' ? 'Friendly' : m.competition}`, clubName: clubById(DINAMO).name, clubId: DINAMO,
      latitude: v.lat, longitude: v.lng, date: local(m.start), fee: 'Free', addressText: `${v.name}, ${v.city}`, ageGroup: sq.ageGroup, status: 'CONFIRMED', cityName: v.city, eventSubtype: m.kind === 'FRIENDLY' ? 'FRIENDLY' : 'MATCH', scheduleEventId: m.id, logoUrl: home.logoUrl });
  }
  // Direct invitations are not public; a listing without a ground of its own has no pin.
  for (const l of F.exchange.filter(l => l.status === 'OPEN' && !l.requestedClubId && l.start.getTime() > now())) {
    const view = F.listingView(l);
    if (view.location_lat == null) continue;
    out.push({ ...markerBase, entityId: l.id, entityType: 'MATCH', title: l.title, subtitle: `${view.age_group} · looking for an opponent`, clubName: view.club_name, clubId: view.club_id, latitude: view.location_lat, longitude: view.location_lng,
      date: local(l.start), fee: 'Free', addressText: view.location_name ? `${view.location_name}, ${view.city}` : view.city, ageGroup: view.age_group, status: 'OPEN', cityName: view.city, eventSubtype: 'FRIENDLY', scheduleEventId: l.id, logoUrl: view.club_logo_url });
  }
  return out;
}
function tournamentMarkers() {
  return F.tournamentList.filter(t => F.tournamentState.get(t.id).status !== 'COMPLETED').map(t => {
    const v = venueById(t.venueId), s = F.tournamentSummary(t), rules = F.competitionRules(t);
    return { ...markerBase, entityId: t.id, entityType: 'TOURNAMENT', title: t.name, subtitle: `${t.ageGroup === 'SENIOR' ? 'Senior' : t.ageGroup} · ${t.teamFormat} · ${rules.family === 'CUP' ? 'Cup' : rules.family[0] + rules.family.slice(1).toLowerCase()}`, clubName: s.hostClubName || s.organizerName, clubId: s.hostClubId,
      latitude: v.lat, longitude: v.lng, verified: true, date: local(t.start), fee: t.fee ? `${t.fee} GEL per team` : 'Free entry', addressText: `${v.name}, ${v.city}`, ageGroup: t.ageGroup, status: s.status === 'ACTIVE' ? 'IN_PROGRESS' : 'REGISTRATION_OPEN', cityName: v.city, eventSubtype: rules.family, logoUrl: s.hostClubId ? clubById(s.hostClubId).logoUrl : null };
  });
}
function tryoutMarkers() {
  return F.trialList.map(F.tryoutView).filter(t => t.status === 'OPEN').map(t => {
    const trial = F.trialList.find(x => x.id === t.id), v = venueById(trial.venueId), c = clubById(t.clubId);
    return { ...markerBase, entityId: t.id, entityType: 'TRYOUT', title: t.title, subtitle: t.position || 'All positions', clubName: c.name, clubId: c.id, latitude: v.lat, longitude: v.lng, date: t.tryoutDate, fee: 'Free', addressText: t.location, ageGroup: t.ageGroup, status: 'OPEN', cityName: v.city, eventSubtype: 'TRYOUT', logoUrl: c.logoUrl, joinPolicy: F.joinPolicy(c) };
  });
}
get('/map/nearby', ({ query: q }) => {
  const types = q.getAll('type').length ? q.getAll('type') : ['CLUB', 'STADIUM', 'MATCH', 'TOURNAMENT'];
  const lat = num(q, 'lat', 41.7151), lng = num(q, 'lng', 44.8271), radius = num(q, 'radius', null);
  const bounds = ['west', 'south', 'east', 'north'].every(k => q.has(k)) ? { west: num(q, 'west'), south: num(q, 'south'), east: num(q, 'east'), north: num(q, 'north') } : null;
  const text = q.get('query'), cities = q.getAll('cities').map(F.lower), categories = q.getAll('category'), ageGroups = q.getAll('ageGroups');
  let list = [];
  if (types.includes('CLUB')) list.push(...clubs.filter(c => !c.draft).map(clubMarker).filter(m => !categories.length || categories.includes(m.category)).filter(m => !ageGroups.length || ageGroups.some(a => m.ageGroup.includes(a))));
  if (types.includes('STADIUM')) list.push(...venues.map(stadiumMarker));
  if (types.includes('MATCH')) list.push(...matchMarkers());
  if (types.includes('TOURNAMENT')) list.push(...tournamentMarkers());
  if (types.includes('TRYOUT')) list.push(...tryoutMarkers());
  list = list.map(m => ({ ...m, distanceKm: kmBetween(lat, lng, m.latitude, m.longitude) }))
    .filter(m => !bounds || (m.latitude >= bounds.south && m.latitude <= bounds.north && m.longitude >= bounds.west && m.longitude <= bounds.east))
    .filter(m => bounds || radius == null || m.distanceKm <= radius)
    .filter(m => !cities.length || cities.includes(F.lower(m.cityName)))
    .filter(m => matchesText(text, m.title, m.subtitle, m.clubName, m.addressText))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const page = pageOf(q), size = sizeOf(q, 100), content = slice(list, page, size);
  return { content, page, size, totalElements: list.length, nextPage: (page + 1) * size < list.length ? page + 1 : undefined, resultsLimited: false, perTypeLimit: 400 };
});
get('/map/geocode', ({ query: q }) => {
  const text = F.lower(q.get('q'));
  const places = Object.entries(W.cities).map(([name, c]) => ({ name: `${name}, Georgia`, cityName: name, countryName: 'Georgia', countryCode: 'GE', latitude: c.lat, longitude: c.lng, type: 'CITY' }));
  places.push({ name: 'Georgia', cityName: null, countryName: 'Georgia', countryCode: 'GE', latitude: 42.3154, longitude: 43.3569, type: 'COUNTRY' });
  return places.filter(p => !text || F.lower(p.name).includes(text)).filter(p => !q.get('type') || p.type === q.get('type'));
});
post('/map/location', () => ({ locationId: W.newId() }));

// ============================================================== venues & bookings
get('/venues/bookings/mine', () => F.bookings.filter(b => b.userId === W.ME_ID && b.end.getTime() > now() - 3600000).sort((a, b) => a.start - b.start).map(F.bookingView));
get('/venues/bookings/mine/history', ({ query: q }) => {
  const status = q.get('status'), from = q.get('fromDate'), to = q.get('toDate'), size = sizeOf(q, 20), offset = Number(q.get('cursor') || 0);
  const list = F.bookings.filter(b => b.userId === W.ME_ID).filter(b => !status || status === 'ALL' || b.status === status)
    .filter(b => (!from || isoDate(b.start) >= from) && (!to || isoDate(b.start) <= to)).sort((a, b) => b.start - a.start).map(F.bookingView);
  return { content: list.slice(offset, offset + size), pageCursor: String(offset), nextCursor: offset + size < list.length ? String(offset + size) : null };
});
get('/venues', ({ query: q }) => {
  const text = q.get('q'), city = q.get('city'), surface = q.get('surface'), format = q.get('format'), covered = q.get('covered') === 'true', min = num(q, 'minPrice', null), max = num(q, 'maxPrice', null);
  const list = venues.filter(v => matchesText(text, v.name, v.city, v.district))
    .filter(v => !city || F.lower(v.city).includes(F.lower(city)))
    .filter(v => v.pitchList.some(p => p.active && (!surface || p.surface === surface) && (!format || p.format === format) && (!covered || p.covered) && (min == null || p.pricePerHour >= min) && (max == null || p.pricePerHour <= max)))
    .sort((a, b) => (a.city === 'Tbilisi' ? 0 : 1) - (b.city === 'Tbilisi' ? 0 : 1) || (a.hourly == null) - (b.hourly == null) || a.id - b.id)
    .map(F.venueView);
  return springPage(list, pageOf(q), sizeOf(q, 12));
});
get('/venues/:id', ({ params }) => { const v = venueById(params.id); return v ? F.venueView(v) : notFound('This stadium is unavailable.'); });
get('/venues/:id/availability', ({ params, query: q }) => {
  const v = venueById(params.id); if (!v) return notFound();
  const view = F.venueView(v), days = Math.min(14, Math.max(1, num(q, 'days', 7))), duration = Math.max(30, num(q, 'durationMinutes', 60)), start = q.get('date') || isoDate(new Date());
  const out = { venueId: v.id, timezone: TZ, fromDate: start, toDate: start, days: [] };
  for (let d = 0; d < days; d++) {
    const date = new Date(`${start}T12:00:00`); date.setDate(date.getDate() + d);
    const ds = isoDate(date), dow = ((date.getDay() + 6) % 7) + 1, hours = view.openingHours.find(h => h.dayOfWeek === dow);
    out.toDate = ds;
    out.days.push({ date: ds, pitches: v.pitchList.filter(p => p.active).map(p => {
      const blocks = F.pitchBlocks(v.id, p.id).filter(b => isoDate(b.start) === ds);
      const slots = [];
      if (hours) {
        const [oh, om] = hours.opensAt.split(':').map(Number), [ch, cm] = hours.closesAt.split(':').map(Number);
        for (let t = oh * 60 + om; t + duration <= ch * 60 + cm; t += view.slotMinutes) {
          const s = new Date(`${ds}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`), e = plusMin(s, duration);
          const free = s.getTime() > now() && !blocks.some(b => b.start < e && b.end > s);
          slots.push({ startsAt: iso(s), endsAt: iso(e), available: free, price: Math.round(p.pricePerHour * duration / 60) });
        }
      }
      return { pitchId: p.id, slots, blocks: blocks.map(b => ({ startsAt: iso(b.start), endsAt: iso(b.end), status: b.status, kind: b.kind })) };
    }) });
  }
  return out;
});
post('/venues/:id/bookings', ({ params, body }) => {
  const v = venueById(params.id), p = F.pitchById(body?.pitchId);
  if (!v || !p || !v.pitchList.includes(p)) return reply(400, { status: 400, message: 'Choose a pitch at this stadium.' });
  const start = parseWhen(body.startsAt), end = parseWhen(body.endsAt);
  if (!start || !end || end <= start) return reply(400, { status: 400, message: 'Choose a start and end time.' });
  const minutes = (end - start) / 60000, weeks = Math.max(1, Math.min(12, Number(body.repeatWeeks) || 1)), seriesId = weeks > 1 ? `series-${W.newId()}` : null, created = [];
  for (let w = 0; w < weeks; w++) {
    const s = plusMin(start, w * 7 * 24 * 60), e = plusMin(s, minutes);
    if (F.pitchBlocks(v.id, p.id).some(b => b.start < e && b.end > s)) { if (w === 0) return conflict('That time is no longer available. Choose another time.'); continue; }
    created.push(F.addBooking({ venueId: v.id, pitchId: p.id, start: s, minutes, status: F.venueView(v).bookingMode === 'INSTANT' ? 'CONFIRMED' : 'PENDING', contactName: body.contactName || W.me.fullName, contactPhone: body.contactPhone || '', note: body.note || '', userId: W.ME_ID, seriesId }));
  }
  return reply(201, created.map(F.bookingView));
});
get('/venues/:id/bookings', ({ params, query: q }) => {
  const from = parseWhen(q.get('from')), to = parseWhen(q.get('to'));
  return F.bookings.filter(b => b.venueId === Number(params.id) && inWindow(b.start, b.end, from, to)).sort((a, b) => a.start - b.start).map(F.bookingView);
});
patch('/venues/:id/bookings/:bookingId', ({ params, body }) => {
  const b = F.bookings.find(x => x.id === Number(params.bookingId) && x.venueId === Number(params.id)); if (!b) return notFound();
  b.status = body?.action === 'ACCEPT' ? 'CONFIRMED' : body?.action === 'DECLINE' ? 'DECLINED' : 'CANCELLED';
  return F.bookingView(b);
});
put('/venues/:id', ({ params, body }) => { const v = venueById(params.id); if (!v) return notFound(); return { ...F.venueView(v), ...(body || {}), id: v.id, pitches: v.pitchList }; });

// ============================================================== referees
// As the backend: q matches name, area and languages; `from`/`to` (both or neither) keep referees free for the whole
// window with no accepted match overlapping it; 24 per page, by name.
get('/referees', ({ query: q }) => {
  const text = q.get('q'), format = q.get('format'), volunteer = q.get('volunteer') === 'true';
  const from = parseWhen(q.get('from')), to = parseWhen(q.get('to'));
  if (Boolean(q.get('from')) !== Boolean(q.get('to')) || (from && to && to <= from) || (q.get('from') && (!from || !to))) return reply(400, { status: 400, message: 'Choose a complete availability window.' });
  const free = r => !from || ((F.refereeAvailability.get(r.user_id) ?? []).some(w => w.starts_at <= from && w.ends_at >= to)
    && !F.exchange.some(l => l.refereeId === r.user_id && F.refereeStatusOf(l) === 'ACCEPTED' && l.status !== 'CANCELLED' && l.start < to && l.end > from));
  const list = F.refereeProfiles.filter(r => matchesText(text, r.full_name, r.service_area, r.languages)).filter(r => !format || r.formats.includes(format)).filter(r => !volunteer || r.accepts_volunteer).filter(free)
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.user_id - b.user_id);
  const page = pageOf(q);
  return { items: slice(list, page, 24), total: list.length, page, pageSize: 24 };
});
get('/referees/me', () => ({ profileAccess: { canManage: false, reason: 'Create a referee profile from Football roles to receive appointments.' }, profile: null, availability: [], appointments: [], appointmentCounts: { current: 0, history: 0, total: 0, returnedHistory: 0 } }));
get('/referees/:id', ({ params }) => {
  const r = F.refereeProfiles.find(x => x.user_id === Number(params.id)); if (!r) return undefined;
  const history = matches.filter(m => m.refereeId === r.user_id && m.status === 'COMPLETED').map(m => ({ id: m.id, title: `${m.home ? 'FC Dinamo Tbilisi Academy' : m.opponentName} v ${m.home ? m.opponentName : 'FC Dinamo Tbilisi Academy'}`, starts_at: local(m.start), timezone: TZ, duty: 'REFEREE', volunteer: !r.accepts_paid, club_name: 'FC Dinamo Tbilisi Academy', opponent_name: m.opponentName }));
  return { ...r, match_history: history };
});

// ============================================================== match exchange
get('/match-exchange/squads', ({ headers }) => viewerSquads(headers).map(s => ({ id: s.id, club_id: s.clubId, name: s.name, category: s.ageGroup, club_name: clubById(s.clubId).name })));
get('/match-exchange', ({ query: q }) => {
  const mine = q.get('mine') === 'true', text = q.get('q'), format = q.get('format'), ageGroup = q.get('ageGroup'), level = q.get('level'), pref = q.get('venuePreference');
  const from = q.get('from') ? new Date(`${q.get('from')}T00:00:00`) : null, to = q.get('to') ? new Date(`${q.get('to')}T23:59:59`) : null;
  const lat = num(q, 'lat', null), lng = num(q, 'lng', null), radius = num(q, 'radiusKm', null);
  let list = F.exchange.filter(l => mine ? F.involvesDinamo(l) : l.status === 'OPEN' && !l.requestedClubId && l.start.getTime() > now())
    .filter(l => !format || l.format === format).filter(l => !ageGroup || l.ageGroup === ageGroup).filter(l => !level || l.level === level).filter(l => !pref || l.venuePreference === pref || l.venuePreference === 'EITHER')
    .filter(l => inWindow(l.start, l.end, from, to)).map(l => F.listingView(l))
    .filter(v => matchesText(text, v.title, v.club_name, v.squad_name, v.location_name, v.city, v.opponent_name))
    .filter(v => lat == null || lng == null || radius == null || kmBetween(lat, lng, v.location_lat, v.location_lng) <= radius);
  list = mine ? list.sort((a, b) => (Date.parse(a.ends_at_iso) < now()) - (Date.parse(b.ends_at_iso) < now()) || Math.abs(Date.parse(a.starts_at_iso) - now()) - Math.abs(Date.parse(b.starts_at_iso) - now())) : list.sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
  const page = pageOf(q);
  return { items: slice(list, page, 24), total: list.length, page, pageSize: 24 };
});
function listingFromBody(body, existing) {
  const squad = squadById(body?.squadId) || squadById(existing?.hostSquadId);
  if (!squad || !F.isMineClub(squad.clubId)) return { error: reply(400, { status: 400, message: 'Choose one of your squads.' }) };
  const start = parseWhen(body.startsAt) || existing?.start, end = parseWhen(body.endsAt) || existing?.end;
  if (!start || !end || end <= start) return { error: reply(400, { status: 400, message: 'Choose a start and end time.' }) };
  return { squad, start, end };
}
post('/match-exchange', ({ body }) => {
  const { squad, start, end, error } = listingFromBody(body); if (error) return error;
  const v = venueById(body.venueId);
  const rec = { id: W.newId(), hostSquadId: squad.id, start, end, venueId: v?.id ?? null, title: body.title || `${squad.name} friendly`, description: body.description || '', level: body.level || 'DEVELOPMENT', venuePreference: body.venuePreference || 'HOME',
    refereeRequired: body.refereeRequired !== false, opponentSquadId: null, status: 'OPEN', score: null, proposals: [], bookingId: null, refereeId: null, requestedClubId: null, kind: 'FRIENDLY', revision: 1, ageGroup: body.ageGroup || squad.ageGroup, format: body.format || '11_A_SIDE',
    created: new Date(), history: [{ id: W.newId(), action: 'PUBLISHED', created_at: iso(new Date()), reason: null }] };
  F.exchange.push(rec);
  return reply(201, F.listingView(rec, { detail: true }));
});
get('/match-exchange/:id', ({ params }) => { const l = F.listingById(params.id); return l ? F.listingView(l, { detail: true }) : notFound('This match is no longer available.'); });
put('/match-exchange/:id', ({ params, body }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  const { squad, start, end, error } = listingFromBody(body, l); if (error) return error;
  Object.assign(l, { hostSquadId: squad.id, start, end, title: body.title ?? l.title, description: body.description ?? l.description, level: body.level ?? l.level, venuePreference: body.venuePreference ?? l.venuePreference, ageGroup: body.ageGroup ?? l.ageGroup, format: body.format ?? l.format, refereeRequired: body.refereeRequired ?? l.refereeRequired, venueId: body.venueId === null ? null : Number(body.venueId) || l.venueId, revision: l.revision + 1 });
  if (!l.venueId) l.place = { name: String(body.locationName ?? l.place?.name ?? '').trim() || 'Ground to be arranged', city: body.city ?? l.place?.city ?? '', lat: body.latitude ?? null, lng: body.longitude ?? null };
  l.history.push({ id: W.newId(), action: 'REVISE', created_at: iso(new Date()), reason: null });
  return F.listingView(l, { detail: true });
});
post('/match-exchange/:id/proposals', ({ params, body }) => {
  const l = F.listingById(params.id), squad = squadById(body?.squadId); if (!l) return notFound();
  if (!squad || !F.isMineClub(squad.clubId)) return reply(400, { status: 400, message: 'Choose one of your squads.' });
  if (l.status !== 'OPEN') return conflict('This listing already has an opponent.');
  l.proposals.push({ id: W.newId(), squad_id: squad.id, squad_name: squad.name, club_name: clubById(squad.clubId).name, club_id: squad.clubId, note: body.note || '', status: 'PENDING' });
  l.revision++; l.history.push({ id: W.newId(), action: 'PROPOSAL', created_at: iso(new Date()), reason: null });
  return F.listingView(l, { detail: true });
});
post('/match-exchange/:id/proposals/:proposalId/decision', ({ params, body }) => {
  const l = F.listingById(params.id), p = l?.proposals.find(x => x.id === Number(params.proposalId)); if (!p) return notFound();
  const action = body?.action;
  if (action === 'ACCEPT') {
    p.status = 'ACCEPTED'; l.opponentSquadId = p.squad_id; l.status = 'ARRANGED';
    l.proposals.filter(x => x !== p && x.status === 'PENDING').forEach(x => { x.status = 'DECLINED'; });
    l.history.push({ id: W.newId(), action: 'OPPONENT_AGREED', created_at: iso(new Date()), reason: null });
  } else p.status = action === 'DECLINE' ? 'DECLINED' : 'WITHDRAWN';
  l.revision++;
  return F.listingView(l, { detail: true });
});
// As the backend: only the club responsible for the referee arranges officials; the listing's revision must match; one
// live invitation per duty and per person; the referee must accept the terms; the invitation waits for their answer
// (INVITED). Inviting the referee duty also marks a referee as required, drops an external referee's name and closes an
// open request for referees to apply (declining its applications). The backend answers with no body.
const DUTIES = ['REFEREE', 'ASSISTANT_1', 'ASSISTANT_2'];
post('/match-exchange/:id/referees', ({ params, body }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  if (!F.listingView(l).can_arrange_official) return reply(403, { status: 403, message: 'Only the club responsible for the referee can arrange officials.' });
  if (body?.revision != null && Number(body.revision) !== l.revision) return conflict('Listing changed. Reload and review its current arrangements.');
  const duty = DUTIES.includes(body?.duty) ? body.duty : 'REFEREE', refereeId = Number(body?.refereeId);
  const live = [...(l.refereeId ? [{ refereeId: l.refereeId, duty: 'REFEREE' }] : []), ...(l.assistants ?? [])];
  if (live.some(o => o.duty === duty || o.refereeId === refereeId)) return conflict('This duty or referee already has a live invitation. Cancel it first.');
  const r = F.refereeProfiles.find(x => x.user_id === refereeId), volunteer = Boolean(body?.volunteer);
  if (!r || !(volunteer ? r.accepts_volunteer : r.accepts_paid)) return reply(400, { status: 400, message: 'This referee is not available for these terms.' });
  // Each official is one appointment with its own id; the fee is what was offered (0 included), else their listed fee.
  const invite = { id: W.newId(), status: 'INVITED', duty, volunteer, fee: volunteer ? null : body?.fee != null && body.fee !== '' ? Number(body.fee) : r.fee, currency: body?.currency ?? r.currency };
  if (duty === 'REFEREE') {
    l.refereeId = r.user_id; l.refereeInvite = invite; l.refereeRequired = true; l.externalRefereeName = null;
    const request = officialRequests.get(l.id);
    if (request?.status === 'OPEN') { request.status = 'CLOSED'; request.applications.forEach(a => { if (a.status === 'APPLIED') a.status = 'DECLINED'; }); }
  } else (l.assistants ??= []).push({ refereeId: r.user_id, ...invite });
  l.revision++;
  l.history.push({ id: W.newId(), action: 'REFEREE_INVITED', created_at: iso(new Date()), reason: null });
  return reply(204);
});
// As the backend: either arranging side links a reservation of theirs at the match's own ground that covers it, unless
// one is already live; without one, the side confirms an unlisted ground with its owner. It answers with no body.
post('/match-exchange/:id/venue', ({ params, body }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  const view = F.listingView(l);
  if (!view.can_arrange) return reply(403, { status: 403, message: 'Only the clubs playing this match arrange its ground.' });
  if (body?.revision != null && Number(body.revision) !== l.revision) return conflict('Listing changed. Reload and review its current arrangements.');
  if (body?.bookingId) {
    const b = F.bookingById(body.bookingId);
    if (!b || !(b.userId === W.ME_ID || F.isMineClub(b.allocatedClubId))) return reply(404, { status: 404, message: 'That reservation is not yours to use.' });
    // As the backend, by the stored status: a request the venue let lapse still holds the ground until it is released.
    if (['PENDING', 'CONFIRMED'].includes(F.bookingById(l.bookingId)?.status)) return conflict('This match already has a live reservation. Resolve it at the stadium first.');
    if (!['CONFIRMED', 'PENDING'].includes(b.status)) return reply(400, { status: 400, message: 'Only a confirmed or pending reservation can be linked.' });
    if (b.venueId !== l.venueId) return reply(400, { status: 400, message: 'The reservation is at a different ground. The host can move the match there.' });
    if (b.start > l.start || b.end < l.end) return reply(400, { status: 400, message: 'The reservation does not cover the whole match.' });
    l.bookingId = b.id;
    l.history.push({ id: W.newId(), action: 'GROUND_RESERVED', created_at: iso(new Date()), reason: null });
  } else l.externalConfirmed = Boolean(body?.externalConfirmed);
  l.revision++;
  return reply(204);
});
post('/match-exchange/:id/close-preview', ({ params }) => { const l = F.listingById(params.id); if (!l) return notFound(); return { action: 'CANCEL', revision: l.revision, material: true, changedFields: ['status'], dependencies: [], needsAttention: [], confirmationRequired: false, confirmationToken: `close-${l.id}` }; });
post('/match-exchange/:id/close', ({ params }) => { const l = F.listingById(params.id); if (!l) return notFound(); l.status = 'CANCELLED'; l.revision++; l.history.push({ id: W.newId(), action: 'CANCEL', created_at: iso(new Date()), reason: 'Closed by the host' }); return F.listingView(l, { detail: true }); });
const resultState = l => {
  const host = squadById(l.hostSquadId), opp = l.opponentSquadId ? squadById(l.opponentSquadId) : null, side = host.clubId === DINAMO ? 'HOME' : opp?.clubId === DINAMO ? 'AWAY' : null;
  const past = l.end.getTime() < now(), recorded = Boolean(l.score);
  // A proposal counts as its side's confirmation: only the other side confirms or disputes it.
  const proposer = l.resultSide ?? 'HOME', proposed = l.resultStatus === 'PROPOSED', mineProposed = proposed && side === proposer;
  return { eventId: l.id, fixtureStatus: l.status === 'CANCELLED' ? 'CANCELLED' : past && opp ? 'COMPLETED' : 'SCHEDULED', status: l.resultStatus || (recorded ? 'CONFIRMED' : 'NONE'), revision: l.resultRevision || 1,
    homeScore: l.score?.[0] ?? null, awayScore: l.score?.[1] ?? null, proposalSide: recorded ? proposer : null, requiredConfirmations: ['HOME', 'AWAY'], confirmations: recorded && !proposed ? ['HOME', 'AWAY'] : recorded ? [proposer] : [], legacy: false,
    authority: { roles: side ? [side] : [], canPropose: Boolean(side && past && !recorded), canCorrect: Boolean(side && recorded), canDispute: Boolean(side && recorded && !mineProposed), confirmableRoles: side && proposed && !mineProposed ? [side] : [], correctableRoles: side && recorded ? [side] : [] },
    history: recorded ? [{ id: l.id * 10, action: 'PROPOSE', actor_id: W.ME_ID, actor_side: proposer, home_score: l.score[0], away_score: l.score[1], previous_home_score: null, previous_away_score: null, previous_status: 'NONE', status: 'CONFIRMED', reason: null, created_at: iso(plusMin(l.end, 30)), revision: 1 }] : [] };
};
get('/match-exchange/:id/result', ({ params }) => { const l = F.listingById(params.id); return l ? resultState(l) : notFound(); });
get('/match-exchange/:id/result/summary', ({ params }) => { const l = F.listingById(params.id); if (!l) return notFound(); const r = resultState(l); return { eventId: l.id, status: r.status, fixtureStatus: r.fixtureStatus, revision: r.revision, homeScore: r.homeScore, awayScore: r.awayScore, official: r.status === 'CONFIRMED', legacy: false, canReadAudit: true }; });
for (const action of ['', '/confirm', '/correct', '/dispute']) post(`/match-exchange/:id/result${action}`, ({ params, body }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  if (body?.homeScore != null) l.score = [Number(body.homeScore), Number(body.awayScore)];
  if (action === '' || action === '/correct') l.resultSide = body?.side ?? 'HOME';
  l.resultStatus = action === '/dispute' ? 'DISPUTED' : action === '' ? 'PROPOSED' : 'CONFIRMED'; l.resultRevision = (l.resultRevision || 1) + 1;
  return resultState(l);
});
get('/match-exchange/:id/result/suggestions', ({ params }) => ({ eventId: Number(params.id), resultRevision: 1, canSuggest: false, canReview: false, reviewableRoles: [], adoptableRoles: [], ownSuggestions: [], suggestions: [], pendingCount: 0, page: 0, hasMore: false, reviewedSuggestions: [], hasMoreReviewed: false }));
get('/match-exchange/:id/coordination', ({ params }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  const ref = l.refereeId && F.refereeStatusOf(l) === 'ACCEPTED' ? personById(l.refereeId) : null;
  const messages = ref ? [{ id: l.id * 3, authorId: W.ME_ID, authorName: W.me.fullName, body: 'Kit colours: we wear blue, opponents in white. Changing room 2 is yours.', createdAt: iso(plusMin(l.start, -2 * 24 * 60)) }, { id: l.id * 3 + 1, authorId: ref.id, authorName: ref.fullName, body: 'Thanks, I will arrive 45 minutes before kick-off.', createdAt: iso(plusMin(l.start, -2 * 24 * 60 + 40)) }] : [];
  return { eventId: l.id, status: 'OPEN', readOnly: false, participants: [{ userId: W.ME_ID, fullName: W.me.fullName, role: 'STAFF', squadId: l.hostSquadId, squadName: squadById(l.hostSquadId).name }, ...(ref ? [{ userId: ref.id, fullName: ref.fullName, role: 'OFFICIAL', duty: 'REFEREE' }] : [])], messages, page: 0, size: 30, totalElements: messages.length, totalPages: 1, hasMore: false };
});
post('/match-exchange/:id/coordination', ({ body }) => ({ id: W.newId(), authorId: W.ME_ID, authorName: W.me.fullName, body: body?.body || '', createdAt: iso(new Date()) }));
// Match players per squad, in the frontend's `Team` shape (MatchParticipants.tsx); only our own squads.
const matchSelections = new Map(); // `${eventId}:${squadId}` -> Set(playerId)
const teamView = (l, s) => {
  const key = `${l.id}:${s.id}`; if (!matchSelections.has(key)) matchSelections.set(key, new Set(s.playerIds.slice(0, 14)));
  const chosen = matchSelections.get(key);
  return { squadId: s.id, squadName: s.name, canManage: true, players: s.playerIds.map((id, i) => ({ id, name: personById(id).fullName, selected: chosen.has(id), response: !chosen.has(id) ? 'NOT_INVITED' : i % 5 === 3 ? 'UNANSWERED' : 'GOING', revision: l.revision, canRespond: false })) };
};
get('/match-arrangements/:id/participants', ({ params }) => {
  const l = F.listingById(params.id); if (!l) return [];
  return [l.hostSquadId, l.opponentSquadId].filter(Boolean).map(id => squadById(id)).filter(s => s && F.isMineClub(s.clubId)).map(s => teamView(l, s));
});
get('/match-arrangements/squads/:id/fixtures', ({ params, query: q }) => {
  const from = parseWhen(q.get('from')), to = parseWhen(q.get('to'));
  return F.exchange.filter(l => (l.hostSquadId === Number(params.id) || l.opponentSquadId === Number(params.id)) && l.opponentSquadId && inWindow(l.start, l.end, from, to) && !matches.some(m => m.id === l.id)).map(exchangeOccurrence);
});

// ============================================================== match history
const SCORE_PENDING = new Set(); // friendlies whose result awaits the second confirmation
for (const m of matches) if (m.status === 'COMPLETED' && m.squadId === 105 && m.start.getTime() > now() - 8 * 86400000) SCORE_PENDING.add(m.id);
// The listing says the same: proposed, so no score anywhere until the other side confirms.
for (const id of SCORE_PENDING) { const l = F.listingById(id); if (l) l.resultStatus = 'PROPOSED'; }
const leagueReplaced = m => m.squadId === 101 && m.competition === 'Tbilisi Community League';
function historyFromMatch(m) {
  const ours = squadById(m.squadId), theirs = F.squadFor(m.opponentClubId, ours.ageGroup, ours.gender), v = venueById(m.venueId);
  const home = m.home ? { club: clubById(DINAMO), squad: ours } : { club: clubById(m.opponentClubId), squad: theirs };
  const away = m.home ? { club: clubById(m.opponentClubId), squad: theirs } : { club: clubById(DINAMO), squad: ours };
  const listing = F.listingById(m.id), played = m.status === 'COMPLETED' || Boolean(listing?.score);
  const score = listing?.score ?? (played ? (m.home ? m.score : [m.score[1], m.score[0]]) : null);
  const source = m.kind === 'FRIENDLY' ? 'MATCH_EXCHANGE' : 'SCHEDULE', club = source === 'SCHEDULE';
  const open = listing ? ['PROPOSED', 'DISPUTED'].includes(listing.resultStatus) && listing.resultStatus : SCORE_PENDING.has(m.id) && 'PROPOSED';
  const status = !played ? 'NONE' : open || (club ? 'RECORDED' : 'CONFIRMED'), counts = status === 'RECORDED' || status === 'CONFIRMED';
  return { id: `${source}:${m.id}`, source, sourceId: m.id, title: `${home.club.name} vs ${away.club.name}`, startsAt: club ? local(m.start) : iso(m.start), endsAt: club ? local(m.end) : iso(m.end), timezone: club ? null : TZ,
    homeClubId: home.club.id, homeClubName: home.club.name, homeSquadId: home.squad?.id ?? null, homeSquadName: home.squad?.name ?? null, awayClubId: away.club.id, awayClubName: away.club.name, awaySquadId: away.squad?.id ?? null, awaySquadName: away.squad?.name ?? null,
    homeScore: counts ? score?.[0] ?? null : null, awayScore: counts ? score?.[1] ?? null : null, resultStatus: status, fixtureStatus: m.status === 'CANCELLED' ? 'CANCELLED' : counts ? 'COMPLETED' : 'SCHEDULED', legacy: false,
    locationName: v ? `${v.name}, ${v.city}` : null, tournamentId: null, tournamentName: null, detailPath: source === 'MATCH_EXCHANGE' ? `/match-exchange/${m.id}` : `/calendar?eventId=${m.id}`, canRecordResult: m.start.getTime() < now(), mine: true };
}
function historyFromFixture(t, f) {
  const st = F.tournamentState.get(t.id), home = st.entries.find(e => e.id === f.homeEntryId), away = st.entries.find(e => e.id === f.awayEntryId), v = venueById(f.locationId);
  const start = f.scheduledAt ? new Date(f.scheduledAt) : null, rules = F.competitionRules(t);
  const squadName = e => e?.squadId ? squadById(e.squadId)?.name ?? null : null;
  void rules;
  return { id: `TOURNAMENT:${f.id}`, source: 'TOURNAMENT', sourceId: f.id, title: t.name, startsAt: start ? local(start) : null, endsAt: null, timezone: null,
    homeClubId: home?.clubId ?? null, homeClubName: home?.clubName ?? null, homeSquadId: home?.squadId ?? null, homeSquadName: squadName(home), awayClubId: away?.clubId ?? null, awayClubName: away?.clubName ?? null, awaySquadId: away?.squadId ?? null, awaySquadName: squadName(away),
    homeScore: f.homeScore, awayScore: f.awayScore, resultStatus: f.status === 'COMPLETED' ? 'RECORDED' : 'NONE', fixtureStatus: f.status, legacy: t.status === 'COMPLETED' && t.id === 305,
    locationName: null, tournamentId: t.id, tournamentName: t.name, detailPath: `/tournaments/${t.id}?fixtureId=${f.id}`, canRecordResult: st.staff.some(a => a.userId === W.ME_ID && a.status === 'ACTIVE' && ['ADMIN', 'STAFF'].includes(a.role)), mine: home?.clubId === DINAMO || away?.clubId === DINAMO };
}
/** A tournament fixture on a calendar: its own kick-off and length, named after its two sides (the history row is thin, as the backend's). */
function fixtureSpan(t, f) {
  const st = F.tournamentState.get(t.id), home = st.entries.find(e => e.id === f.homeEntryId), away = st.entries.find(e => e.id === f.awayEntryId);
  const start = new Date(f.scheduledAt);
  return { start, end: plusMin(start, F.competitionRules(t).matchMinutes + 15), title: `${home?.clubName ?? f.homeLabel ?? 'To be decided'} vs ${away?.clubName ?? f.awayLabel ?? 'To be decided'}` };
}
const allHistory = () => [
  ...matches.filter(m => !leagueReplaced(m)).map(historyFromMatch),
  ...F.exchange.filter(l => l.opponentSquadId && !matches.some(m => m.id === l.id)).map(l => { const v = F.listingView(l); return { id: `MATCH_EXCHANGE:${l.id}`, source: 'MATCH_EXCHANGE', sourceId: l.id, title: `${v.club_name} vs ${v.opponent_name}`, startsAt: v.starts_at_iso, endsAt: v.ends_at_iso, timezone: TZ, homeClubId: v.club_id, homeClubName: v.club_name, homeSquadId: v.squad_id, homeSquadName: v.squad_name, awayClubId: v.opponent_club_id, awayClubName: v.opponent_name, awaySquadId: v.target_squad_id, awaySquadName: v.opponent_squad_name, homeScore: v.home_score, awayScore: v.away_score, resultStatus: v.result_status || 'NONE', fixtureStatus: v.event_status === 'CANCELLED' ? 'CANCELLED' : v.result_status === 'CONFIRMED' ? 'COMPLETED' : 'SCHEDULED', legacy: false, locationName: v.location_name, tournamentId: null, tournamentName: null, detailPath: `/match-exchange/${l.id}`, canRecordResult: v.can_record_result, mine: F.involvesDinamo(l) }; }),
  ...F.tournamentList.flatMap(t => F.tournamentState.get(t.id).fixtures.map(f => historyFromFixture(t, f))),
];
const whenOf = value => value ? Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}+04:00`) : null;
get('/match-history', ({ query: q }) => {
  const period = q.get('period') || 'HISTORY', mine = q.get('mine') === 'true', source = q.get('source'), status = q.get('resultStatus'), text = q.get('q');
  // As the backend: times without a zone are the ground's clock in Georgia; a window compares the local kick-off date.
  const from = q.get('from') ? Date.parse(`${q.get('from')}T00:00:00+04:00`) : null, to = q.get('to') ? Date.parse(`${q.get('to')}T23:59:59+04:00`) : null;
  const clubId = num(q, 'clubId', null), squadId = num(q, 'squadId', null), tournamentId = num(q, 'tournamentId', null);
  let list = allHistory().filter(h => !mine || h.mine).filter(h => !source || h.source === source).filter(h => !status || h.resultStatus === status)
    .filter(h => clubId == null || h.homeClubId === clubId || h.awayClubId === clubId).filter(h => squadId == null || h.homeSquadId === squadId || h.awaySquadId === squadId).filter(h => tournamentId == null || h.tournamentId === tournamentId)
    .filter(h => matchesText(text, h.title, h.homeSquadName, h.awaySquadName, h.tournamentName, h.locationName))
    .filter(h => (from == null && to == null) || (h.startsAt && (from == null || whenOf(h.startsAt) >= from) && (to == null || whenOf(h.startsAt) <= to)));
  const started = h => h.startsAt && whenOf(h.startsAt) <= now();
  // Arranged and club matches stay upcoming until they end; tournament fixtures (no end time) leave at kick-off.
  const over = h => h.endsAt ? whenOf(h.endsAt) <= now() : started(h);
  const sides = h => (h.homeClubId != null || h.homeClubName) && (h.awayClubId != null || h.awayClubName);
  const newestFirst = (a, b) => (whenOf(b.startsAt) ?? -9e15) - (whenOf(a.startsAt) ?? -9e15);
  if (period === 'UPCOMING') list = list.filter(h => h.fixtureStatus === 'SCHEDULED' && !over(h)).sort((a, b) => (whenOf(a.startsAt) ?? 9e15) - (whenOf(b.startsAt) ?? 9e15));
  else if (period === 'NEEDS_RESULT') list = list.filter(h => over(h) && sides(h) && h.fixtureStatus !== 'CANCELLED' && ['NONE', 'PROPOSED', 'DISPUTED'].includes(h.resultStatus)).sort(newestFirst);
  else if (period === 'HISTORY') list = list.filter(h => started(h) || ['COMPLETED', 'CANCELLED'].includes(h.fixtureStatus)).sort(newestFirst);
  else list = list.sort(newestFirst);
  const page = pageOf(q), size = sizeOf(q, 24);
  return { items: slice(list, page, size).map(({ mine: _m, ...h }) => h), total: list.length, page, pageSize: size };
});
get('/match-history/import/options', () => ({ clubs: [{ id: DINAMO, name: clubById(DINAMO).name, squads: F.DINAMO_SQUADS.map(s => ({ id: s.id, name: s.name })) }] }));
post('/match-history/import', ({ body }) => {
  const opp = clubById(body?.opponentClubId), squad = squadById(body?.homeSquadId || body?.awaySquadId) || squadById(101);
  if (!opp) return reply(400, { status: 400, message: 'Choose a registered opponent.' });
  const start = parseWhen(body.startsAt) || at(-30, 11), end = parseWhen(body.endsAt) || plusMin(start, 90), home = Boolean(body.homeSquadId);
  const m = { id: W.newId(), type: 'MATCH', kind: 'HISTORICAL', clubId: DINAMO, squadId: squad.id, opponentClubId: opp.id, opponentName: opp.name, home, start, end, venueId: home ? 202 : opp.venueId ?? 202, status: 'COMPLETED', score: home ? [Number(body.homeScore), Number(body.awayScore)] : [Number(body.awayScore), Number(body.homeScore)], refereeId: null, competition: body.title || 'Historical match record' };
  matches.push(m);
  return reply(201, { eventId: m.id, detailPath: `/calendar?eventId=${m.id}`, resultStatus: 'RECORDED', historicalImport: true, homeScore: Number(body.homeScore), awayScore: Number(body.awayScore) });
});

// ============================================================== tournaments & competitions
const tournamentOr404 = id => { const t = F.tournamentById(id); return t ? t : null; };
const publicTournaments = () => F.tournamentList.filter(t => (t.visibility ?? 'PUBLIC') === 'PUBLIC');
// As discovery lists organisers: a club for what it hosts and what its own organisation runs; an organisation not backed
// by a club for what it runs. Only organisers with a public tournament are listed.
const hostKeys = t => { const org = F.organizerOf(t); return [...new Set([t.organizerClubId ? `CLUB:${t.organizerClubId}` : null, org?.clubId ? `CLUB:${org.clubId}` : org ? `ORGANIZATION:${org.id}` : null].filter(Boolean))]; };
const listedBy = (kind, id) => publicTournaments().filter(t => hostKeys(t).includes(`${kind}:${id}`));
const followedHosts = new Set(['CLUB:3', 'ORGANIZATION:801']);
const hostView = (kind, id) => {
  const count = listedBy(kind, id).length;
  if (!count) return null;
  if (kind === 'CLUB') { const c = clubById(id); return c && { kind, id, name: c.name, logoUrl: c.logoUrl, tournamentCount: count, following: followedHosts.has(`${kind}:${id}`) }; }
  const o = F.organizationById(id); return o && { kind, id, name: o.name, logoUrl: o.logoUrl, tournamentCount: count, following: followedHosts.has(`${kind}:${id}`) };
};
const allHosts = () => [...new Set(publicTournaments().flatMap(hostKeys))].map(key => { const [kind, id] = key.split(':'); return hostView(kind, Number(id)); }).filter(Boolean)
  .sort((a, b) => b.tournamentCount - a.tournamentCount || a.name.localeCompare(b.name));
get('/tournaments/overview', () => {
  const summaries = publicTournaments().map(F.tournamentSummary).filter(s => s.visibility === 'PUBLIC');
  // As the backend computes them: at most three public tournaments, on now or being planned, not yet ended.
  const highlights = [...summaries.filter(s => s.status === 'ACTIVE'), ...summaries.filter(s => s.status === 'PLANNING')].filter(s => Date.parse(`${s.endDate}+04:00`) >= now() - 86400000).sort((a, b) => (a.id === 306 ? -1 : 0) - (b.id === 306 ? -1 : 0)).slice(0, 3);
  const hosts = allHosts();
  return { highlights, followedHosts: hosts.filter(h => h.following), suggestedHosts: hosts.filter(h => !h.following).slice(0, 6), shelves: [{ scope: 'CLUB', tournaments: summaries, total: summaries.length }, { scope: 'SQUAD', tournaments: [], total: 0 }, { scope: 'PLAYER', tournaments: [], total: 0 }] };
});
get('/tournaments/hosts', ({ query: q }) => pageResult(allHosts().filter(h => matchesText(q.get('search'), h.name)).filter(h => q.get('following') !== 'true' || h.following), pageOf(q), sizeOf(q, 24)));
get('/tournaments/host', ({ query: q }) => hostView(q.get('kind'), Number(q.get('id'))) || notFound());
get('/tournaments/host-tournaments', ({ query: q }) => hostView(q.get('kind'), Number(q.get('id'))) ? pageResult(listedBy(q.get('kind'), Number(q.get('id'))).map(F.tournamentSummary), pageOf(q), sizeOf(q, 12)) : notFound());
put('/tournaments/hosts/:kind/:id/follow', ({ params, body }) => { const key = `${params.kind}:${params.id}`; if (body?.following) followedHosts.add(key); else followedHosts.delete(key); return { following: followedHosts.has(key) }; });
const summaryFilter = q => {
  const text = q.get('search') || q.get('q'), status = q.get('status');
  return F.tournamentList.map(F.tournamentSummary).filter(s => matchesText(text, s.name, s.organizerName, s.hostClubName)).filter(s => !status || s.status === status);
};
get('/tournaments', ({ query: q }) => pageResult(summaryFilter(q), pageOf(q), sizeOf(q, 20)));
get('/tournaments/mine', ({ query: q }) => pageResult(summaryFilter(q).filter(s => F.tournamentState.get(s.id).entries.some(e => e.clubId === DINAMO) || F.tournamentState.get(s.id).staff.some(a => a.userId === W.ME_ID)), pageOf(q), sizeOf(q, 20)));
get('/competitions/mine', ({ query: q }) => pageResult(summaryFilter(q).filter(s => F.tournamentState.get(s.id).entries.some(e => e.clubId === DINAMO) || F.tournamentState.get(s.id).staff.some(a => a.userId === W.ME_ID)), pageOf(q), sizeOf(q, 20)));
// As the backend sends them: the invited club and squad by id too, and the tournament's start.
// As the backend sends them, from the one invitation store: the invited club and squad by id too, and the tournament's start.
get('/tournaments/invitations/mine', ({ query: q }) => pageResult(F.tournamentInvitations.filter(inv => inv.clubId === DINAMO && (q.get('status') ?? 'PENDING') === inv.status).map(inv => {
  const v = F.invitationView(inv), summary = F.tournamentSummary(v.tournament);
  return { invitationId: inv.id, tournamentId: inv.tournamentId, tournamentName: summary.name, tournamentStatus: summary.status, visibility: 'PUBLIC', participantScope: summary.participantScope,
    clubId: v.clubId, clubName: v.clubName, squadId: v.squadId, squadName: v.squadName, startDate: summary.startDate, status: inv.status };
}), pageOf(q), sizeOf(q, 10)));

// Events discovery (Find events): tournaments, public fixtures, tryouts.
get('/tournaments/discovery', ({ query: q }) => {
  const text = q.get('q'), where = q.get('location'), activity = q.get('activity') || 'ALL';
  const from = q.get('from') ? new Date(`${q.get('from')}T00:00:00`) : null, to = q.get('to') ? new Date(`${q.get('to')}T23:59:59`) : null;
  const items = [];
  for (const t of F.tournamentList) { const v = venueById(t.venueId), s = F.tournamentSummary(t); items.push({ kind: 'TOURNAMENT', id: t.id, name: t.name, activity: 'TOURNAMENT', status: s.status, startsAt: iso(t.start), endsAt: iso(t.end), location: `${v.name}, ${v.city}`, context: s.hostClubName || s.organizerName, destination: `/tournaments/${t.id}`, recurring: false }); }
  for (const m of matches.filter(m => m.status !== 'CANCELLED')) { const v = venueById(m.venueId), h = historyFromMatch(m); items.push({ kind: 'SCHEDULE', id: m.id, name: h.title, activity: 'MATCH', status: m.status, startsAt: iso(m.start), endsAt: iso(m.end), location: v ? `${v.name}, ${v.city}` : null, context: `${squadById(m.squadId).name} · ${m.kind === 'FRIENDLY' ? 'Friendly' : m.competition}`, destination: m.kind === 'FRIENDLY' ? `/match-exchange/${m.id}` : `/calendar?eventId=${m.id}`, recurring: false }); }
  for (const a of F.clubActivities.filter(a => F.isPublicActivity(a) && a.type !== 'TRYOUT' && a.status !== 'CANCELLED')) { const v = venueById(a.venueId); items.push({ kind: 'SCHEDULE', id: a.id, name: a.title, activity: a.type === 'ACTIVITY' ? 'OTHER' : a.type, status: a.status, startsAt: iso(a.start), endsAt: iso(a.end), location: v ? `${v.name}, ${v.city}` : null, context: clubById(DINAMO).name, destination: `/calendar?eventId=${a.id}`, recurring: /Goalkeeper clinic/i.test(a.title) }); }
  for (const t of F.trialList) { const view = F.tryoutView(t); if (view.status === 'CANCELLED') continue; items.push({ kind: 'TRYOUT', id: t.id, name: `${view.clubName}: ${view.title}`, activity: 'TRYOUT', status: view.status, startsAt: view.tryoutDate, endsAt: iso(plusMin(t.date, 120)), location: view.location, context: view.clubName, destination: `/clubs/${t.clubId}?tab=tryouts`, recurring: false }); }
  for (const s of squads.filter(s => s.clubId !== DINAMO).slice(0, 10)) { const c = clubById(s.clubId), v = venueById(c.venueId); items.push({ kind: 'SESSION', id: 40000 + s.id, name: `${c.name}: ${s.name} training`, activity: 'TRAINING', status: 'SCHEDULED', startsAt: iso(at(((s.trainingDays[0] - W.NOW.getDay()) + 7) % 7 || 7, 17, 30)), endsAt: iso(at(((s.trainingDays[0] - W.NOW.getDay()) + 7) % 7 || 7, 19)), location: v ? `${v.name}, ${v.city}` : c.city, context: 'Weekly public timetable', destination: `/clubs/${c.id}?tab=teams&squad=${s.id}`, recurring: true }); }
  const list = items.filter(i => activity === 'ALL' || i.activity === activity).filter(i => matchesText(text, i.name, i.context)).filter(i => !where || matchesText(where, i.location))
    .filter(i => !i.startsAt || inWindow(new Date(i.startsAt), new Date(i.endsAt || i.startsAt), from, to))
    .sort((a, b) => { const group = i => Date.parse(i.startsAt) >= now() ? 0 : Date.parse(i.endsAt || i.startsAt) >= now() ? 1 : 2, ga = group(a), gb = group(b); return ga !== gb ? ga - gb : ga === 2 ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt); });
  const page = pageOf(q), size = sizeOf(q, 20);
  return { items: slice(list, page, size), total: list.length, hasMore: (page + 1) * size < list.length };
});

const detailOr404 = id => { const t = tournamentOr404(id); return t ? F.tournamentDetail(t) : notFound('This tournament is unavailable.'); };
get('/tournaments/:id', ({ params }) => detailOr404(params.id));
get('/tournaments/:id/tie-state', () => ({ contests: [], blocked: false, staleStageIds: [], blockedStageIds: [] }));
get('/tournaments/:id/tie-resolutions', () => []);
get('/tournaments/:id/draft-teams', () => []);
get('/tournaments/:id/invitations', ({ params }) => {
  const t = F.tournamentById(params.id); if (!t) return notFound();
  return F.tournamentInvitations.filter(inv => inv.tournamentId === t.id && inv.status !== 'CANCELLED').map(inv => { const { tournament, ...view } = F.invitationView(inv); void tournament; return view; });
});
get('/tournaments/:id/player-queue', ({ params }) => detailOr404(params.id));
get('/tournaments/:id/stages/:stageId/standings', ({ params }) => {
  const st = F.tournamentState.get(Number(params.id)); if (!st) return notFound();
  // As TournamentService.getGroupStandings: tables only for group, round-robin and league stages.
  const stage = st.stages.find(s => s.id === Number(params.stageId)); if (!stage) return notFound();
  if (!['GROUP', 'ROUND_ROBIN', 'LEAGUE'].includes(stage.stageType)) return reply(400, { status: 400, message: 'Standings are only available for GROUP, ROUND_ROBIN, and LEAGUE stages.' });
  return F.standingsFor(st, Number(params.stageId)).map(r => ({ entryId: r.entryId, entryName: r.label, entryType: 'CLUB', played: r.played, won: r.wins, drawn: r.draws, lost: r.losses, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, goalDifference: r.goalsFor - r.goalsAgainst, points: r.points }));
});
const mutateTournament = (id, fn) => { const t = F.tournamentById(id), st = t && F.tournamentState.get(t.id); if (!st) return notFound(); const res = fn(st, t); return res && res.__reply ? res : F.tournamentDetail(t); };
const fixtureIn = (st, fid) => st.fixtures.find(f => f.id === Number(fid));
// As TournamentService.requestEntry: planning only, the window open, invitation-only needs an invitation, one live entry per
// club whatever the squad; a full tournament puts the entry on the waiting list, never refuses it.
post('/tournaments/:id/entries', ({ params, body }) => {
  const t = F.tournamentById(params.id); if (!t) return notFound();
  const club = clubById(body?.clubId), squad = body?.squadId ? squadById(body.squadId) : null;
  if (!club || (squad && squad.clubId !== club.id)) return reply(400, { status: 400, message: 'Choose one of your club\u2019s squads.' });
  const invited = F.tournamentInvitations.some(inv => inv.tournamentId === t.id && inv.clubId === club.id && inv.status === 'PENDING');
  const { refusal } = F.enterTournament(t, { clubId: club.id, squadId: squad?.id ?? null, invited });
  return refusal ? reply(refusal.status, refusal) : reply(201, F.tournamentDetail(t));
});
post('/tournaments/:id/register-player', ({ params }) => {
  const t = F.tournamentById(params.id); if (!t) return notFound();
  if (F.scopeOf(t) !== 'PLAYER') return reply(400, { status: 400, message: 'This tournament takes club or squad entries.' });
  const { refusal } = F.enterTournament(t, { userId: W.ME_ID, displayName: W.me.fullName });
  return refusal ? reply(refusal.status, refusal) : reply(201, F.tournamentDetail(t));
});
post('/tournaments/:id/entries/:entryId/withdraw', ({ params }) => { const t = F.tournamentById(params.id); if (!t) return notFound(); return F.withdrawEntry(t, params.entryId) ? F.tournamentDetail(t) : conflict('This entry was already withdrawn.'); });
patch('/tournaments/:id/entries/:entryId/status', ({ params, body }) => mutateTournament(params.id, st => { const e = st.entries.find(x => x.id === Number(params.entryId)); if (e) { e.status = body?.status || e.status; e.decidedBy = W.ME_ID; e.decidedAt = iso(new Date()); if (e.status === 'ACTIVE') e.confirmedAt = iso(new Date()); } }));
patch('/tournaments/:id/entries/:entryId/squad', ({ params, body }) => mutateTournament(params.id, st => { const e = st.entries.find(x => x.id === Number(params.entryId)); if (e) e.squadId = body?.squadId ?? null; }));
del('/tournaments/:id/entries/:entryId', ({ params }) => mutateTournament(params.id, st => { st.entries = st.entries.filter(x => x.id !== Number(params.entryId)); }));
put('/tournaments/:id/entries/seeding', ({ params, body }) => mutateTournament(params.id, st => { for (const s of body?.entries || []) { const e = st.entries.find(x => x.id === s.entryId); if (e) e.seed = s.seed; } }));
post('/tournaments/:id/guest-entries', ({ params, body }) => mutateTournament(params.id, st => { st.entries.push({ id: W.newId(), clubId: null, clubName: null, squadId: null, squadName: null, userId: null, displayName: body?.name || 'Guest team', status: 'ACTIVE', seed: null, requestedBy: W.ME_ID, decidedBy: W.ME_ID, decidedAt: iso(new Date()), confirmedAt: iso(new Date()), withdrawnAt: null, withdrawalReason: null, draftTeamId: null }); }));
patch('/tournaments/:id', ({ params, body }) => mutateTournament(params.id, st => { st.overrides = { ...(st.overrides || {}), ...Object.fromEntries(Object.entries(body || {}).filter(([k, v]) => v != null && !k.startsWith('clear'))) }; }));
post('/tournaments/:id/start', ({ params }) => mutateTournament(params.id, st => { st.status = 'ACTIVE'; st.overrides = { ...(st.overrides || {}), status: 'ACTIVE' }; }));
post('/tournaments/:id/complete', ({ params }) => mutateTournament(params.id, st => { st.status = 'COMPLETED'; const top = F.standingsFor(st)[0]; st.championEntryId = top?.entryId ?? null; st.championName = top?.label ?? null; st.overrides = { ...(st.overrides || {}), status: 'COMPLETED' }; }));
const scoreFixture = (f, home, away) => { f.homeScore = home; f.awayScore = away; f.winnerEntryId = home > away ? f.homeEntryId : away > home ? f.awayEntryId : null; };
post('/tournaments/:id/fixtures/:fid/complete', ({ params, body }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid); if (!f) return; if (body?.homeScore != null) scoreFixture(f, Number(body.homeScore), Number(body.awayScore)); f.status = 'COMPLETED'; if (body?.winnerEntryId) f.winnerEntryId = body.winnerEntryId; }));
patch('/tournaments/:id/fixtures/:fid/scores', ({ params, body }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid); if (f) scoreFixture(f, Number(body?.homeScore ?? 0), Number(body?.awayScore ?? 0)); }));
post('/tournaments/:id/fixtures/:fid/reopen', ({ params }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid); if (f) f.status = 'SCHEDULED'; }));
post('/tournaments/:id/fixtures/:fid/cancel', ({ params }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid); if (f) f.status = 'CANCELLED'; }));
patch('/tournaments/:id/fixtures/:fid/schedule', ({ params, body }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid); if (f) { f.scheduledAt = body?.scheduledAt ? local(new Date(body.scheduledAt)) : null; f.locationId = body?.locationId ?? f.locationId; } }));
patch('/tournaments/:id/fixtures/:fid/participants', ({ params, body }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid); if (!f) return; for (const side of ['home', 'away']) if (body?.[`${side}EntryId`] !== undefined) { const e = st.entries.find(x => x.id === body[`${side}EntryId`]); f[`${side}EntryId`] = e?.id ?? null; f[`${side}Label`] = e ? e.clubName || e.displayName : null; } }));
for (const action of ['place-entry', 'unplace-entry']) post(`/tournaments/:id/fixtures/:fid/${action}`, ({ params, body }) => mutateTournament(params.id, st => { const f = fixtureIn(st, params.fid), e = st.entries.find(x => x.id === body?.entryId), side = body?.slot === 'AWAY' ? 'away' : 'home'; if (!f) return; f[`${side}EntryId`] = action === 'place-entry' ? e?.id ?? null : null; f[`${side}Label`] = action === 'place-entry' ? e?.clubName ?? e?.displayName ?? null : null; }));
post('/tournaments/:id/staff', ({ params, body }) => mutateTournament(params.id, st => { const p = personById(body?.userId); if (p) st.staff.push({ id: W.newId(), userId: p.id, fullName: p.fullName, role: body.role || 'STAFF', status: 'ACTIVE', assignedBy: W.ME_ID, createdAt: iso(new Date()) }); }));
del('/tournaments/:id/staff/:assignmentId', ({ params }) => mutateTournament(params.id, st => { st.staff = st.staff.filter(a => a.id !== Number(params.assignmentId)); }));
post('/tournaments/:id/invitations', ({ params, body }) => { const t = F.tournamentById(params.id); const c = clubById(body?.clubId); if (!t || !c) return notFound(); const inv = { id: W.newId(), tournamentId: t.id, clubId: c.id, squadId: body?.squadId ?? null, status: 'PENDING', createdAt: new Date() }; F.tournamentInvitations.push(inv); const { tournament, ...view } = F.invitationView(inv); void tournament; return view; });
del('/tournaments/:id/invitations/:invitationId', ({ params }) => { const inv = F.tournamentInvitations.find(i => i.id === Number(params.invitationId) && i.tournamentId === Number(params.id)); if (inv) inv.status = 'CANCELLED'; return reply(204); });

// As CompetitionService.browse answers: every filter it takes, its page limit, and its plain orders (no status first).
get('/competitions', ({ query: q }) => {
  const text = q.get('q'), family = q.get('family'), structure = q.get('structure'), scope = q.get('scope'), status = q.get('status'), ageGroup = q.get('ageGroup'), city = q.get('city'), discipline = q.get('discipline'), side = q.get('sideSize'), registration = q.get('registration'), level = q.get('playingLevel');
  const hostKind = q.get('hostKind'), hostId = num(q, 'hostId', null), sort = q.get('sort') || 'date', size = sizeOf(q, 12);
  const country = q.get('country'), eligibility = q.get('eligibilityCategory'), currency = q.get('currency'), feeBasis = q.get('feeBasis'), minFee = num(q, 'minFee', null), maxFee = num(q, 'maxFee', null), openPlaces = q.get('openPlaces') === 'true';
  const from = q.get('from') ? Date.parse(`${q.get('from')}T00:00:00+04:00`) : null, to = q.get('to') ? Date.parse(`${q.get('to')}T00:00:00+04:00`) + 86400000 : null;
  const lat = num(q, 'latitude', null), lng = num(q, 'longitude', null), radius = num(q, 'radiusKm', null);
  if (size < 1 || size > 24) return reply(400, { status: 400, message: 'Use valid search bounds and a page size between 1 and 24.' });
  if ((lat != null || lng != null || radius != null) && (lat == null || lng == null || radius == null || radius <= 0 || radius > 500)) return reply(400, { status: 400, message: 'Supply valid paired coordinates and a radius from 0 to 500 km.' });
  if ((maxFee != null || minFee != null) && !currency) return reply(400, { status: 400, message: 'Fee filtering requires a currency and a fee between 0 and 1000000.' });
  const nowMs = now();
  let list = F.tournamentList.filter(t => (t.visibility ?? 'PUBLIC') === 'PUBLIC').filter(t => {
    const c = F.competitionCard(t), r = c.profile.rules ?? {}, st = F.tournamentState.get(t.id), w = F.registrationWindow(t), v = venueById(t.venueId);
    return matchesText(text, c.name, c.description)
      && (!family || r.family === family) && (!structure || r.structure === structure) && (!scope || c.participantScope === scope) && (!status || c.status === status)
      && (!ageGroup || r.ageGroup === ageGroup) && (!city || r.city === city) && (!discipline || r.discipline === discipline) && (!side || r.sideSize === Number(side)) && (!level || r.playingLevel === level)
      && (!country || r.country === country) && (!eligibility || r.eligibilityCategory === eligibility) && (!currency || r.currency === currency) && (!feeBasis || r.feeBasis === feeBasis)
      && (maxFee == null || r.entryFee <= maxFee) && (minFee == null || r.entryFee >= minFee)
      && (from == null || t.end.getTime() >= from) && (to == null || t.start.getTime() < to)
      && (!openPlaces || (c.status === 'PLANNING' && (c.entryCap == null || F.placesTaken(st) < c.entryCap)))
      && (!registration || (registration === 'OPEN' ? c.status === 'PLANNING' && w.opens.getTime() <= nowMs && w.closes.getTime() > nowMs
        : registration === 'NOT_OPEN' ? c.status === 'PLANNING' && w.opens.getTime() > nowMs : c.status !== 'PLANNING' || w.closes.getTime() <= nowMs))
      // As CompetitionService: a club by the tournaments it hosts, an organisation by those it runs.
      && (!hostKind || (hostKind === 'CLUB' ? t.organizerClubId != null && (hostId == null || t.organizerClubId === hostId) : hostKind === 'ORGANIZATION' && (hostId == null || F.organizerOf(t)?.id === hostId)))
      && (lat == null || (v && kmBetween(lat, lng, v.lat, v.lng) <= radius));
  });
  list = sort === 'name' ? list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id) : sort === 'newest' ? list.sort((a, b) => b.id - a.id) : list.sort((a, b) => a.start - b.start || b.id - a.id);
  return pageResult(list.map(F.competitionCard), pageOf(q), size);
});
// Luka is an adult with a complete profile: he may register for a players' tournament.
// As CompetitionService.create: the organisation's staff only, the backend's checks, and one tournament per request id.
post('/competitions', ({ body }) => {
  const { tournament, replay, refusal } = F.createTournament(body);
  if (refusal) return reply(refusal.status, refusal);
  return replay ? F.tournamentDetail(replay) : reply(201, F.tournamentDetail(tournament));
});
get('/competitions/player-eligibility', () => ({ eligible: true }));
get('/competitions/official-assignments', () => []);
get('/competitions/:id/rules', ({ params }) => { const t = tournamentOr404(params.id); return t ? F.competitionProfile(t) : notFound(); });
put('/competitions/:id/rules', ({ params, body }) => { const t = tournamentOr404(params.id); return t ? { rules: { ...F.competitionRules(t), ...(body?.rules || {}) }, revision: 4, legacy: false } : notFound(); });
const operationsOf = t => {
  const st = F.tournamentState.get(t.id), canOperate = st.staff.some(a => a.userId === W.ME_ID && a.role === 'ADMIN');
  return { profile: F.competitionProfile(t), standings: F.standingsFor(st, st.stages.find(s => s.stageType !== 'KNOCKOUT')?.id), rounds: [], challenges: t.format === 'LADDER' ? [{ id: 7600, challenger_entry_id: st.entries[3]?.id, target_entry_id: st.entries[1]?.id, proposed_at: iso(W.day(-1)), expires_at: iso(W.day(6)), venue: 'Isani Futsal Hall, Court A', status: 'PENDING', fixture_id: null }] : [],
    controllableEntries: st.entries.filter(e => e.clubId === DINAMO).map(e => e.id), canOperate, canComplete: canOperate && st.status === 'ACTIVE', rankingStageId: null, rankContests: [], policy: { minimumRoster: 9, maximumMatchMinutes: 90, inactivityDays: 0, minimumAge: t.ageGroup === 'SENIOR' ? 16 : 0, ruleAuthority: 'Organiser’s published competition rules', sanctioningEvidence: '' }, inactiveEntries: [] };
};
get('/competitions/:id/operations', ({ params }) => { const t = tournamentOr404(params.id); return t ? operationsOf(t) : notFound(); });
post('/competitions/:id/:path', ({ params }) => { const t = tournamentOr404(params.id); return t ? operationsOf(t) : notFound(); });
get('/competitions/:id/draw', ({ params }) => {
  const t = tournamentOr404(params.id); if (!t) return notFound();
  const st = F.tournamentState.get(t.id), rules = F.competitionRules(t);
  // As CompetitionDrawService.state: nothing before a draw, nor for a tournament from before the engine (or a ladder).
  if (!st.plan) return { plan: null, transitioned: false, stages: [], slots: [], routes: [], aggregates: [] };
  const label = e => e?.squadName ?? e?.clubName ?? e?.displayName ?? 'Private participant';
  const wall = value => new Date(`${value}+04:00`);
  return { plan: st.plan, transitioned: false,
    stages: st.stages.filter(s => st.phases.has(s.id)).map(s => ({ id: s.id, name: s.name, stage_type: s.stageType, ...st.phases.get(s.id),
      ...(s.stageType === 'KNOCKOUT' ? {} : { standings: F.standingsFor(st, s.id).map(row => ({ ...row, label: label(st.entries.find(e => e.id === row.entryId)) })), rankContests: [] }) })),
    slots: st.fixtures.filter(f => f.scheduledAt && st.phases.has(f.stageId)).map(f => ({ fixture_id: f.id, pitch_number: 1 + (f.fixtureOrder - 1) % Math.max(1, rules.pitches), starts_at: iso(wall(f.scheduledAt)), ends_at: iso(plusMin(wall(f.scheduledAt), rules.matchMinutes)) })),
    routes: st.routes, aggregates: [] };
});
get('/competitions/:id/resources', ({ params }) => {
  const t = tournamentOr404(params.id); if (!t) return notFound();
  const st = F.tournamentState.get(t.id), v = venueById(t.venueId), rules = F.competitionRules(t);
  return { revision: 2, canOperate: st.staff.some(a => a.userId === W.ME_ID && a.role === 'ADMIN'), fixtures: st.fixtures.filter(f => f.scheduledAt && f.status === 'SCHEDULED').slice(0, 12).map((f, i) => ({ id: f.id, status: f.status, home_label: f.homeLabel ?? 'To be decided', away_label: f.awayLabel ?? 'To be decided', starts_at: iso(new Date(f.scheduledAt)), ends_at: iso(plusMin(new Date(f.scheduledAt), rules.matchMinutes)), venue: venueById(f.locationId)?.name ?? v.name, pitch: venueById(f.locationId)?.pitches[0] ?? v.pitches[0], booking_status: i % 3 ? 'CONFIRMED' : null, appointments: i % 2 ? [] : [{ id: 7900 + f.id % 100, status: 'ACCEPTED', referee_id: W.referees[i % W.referees.length].id }] })) };
});
get('/competitions/:id/divisions', () => []);

// ============================================================== schedules
const occurrence = (e, overrides = {}) => ({
  eventId: e.id, occurrenceId: `${e.id}:${local(e.start)}`, clubId: e.clubId ?? null, clubName: e.clubId ? clubById(e.clubId).name : null, userId: e.userId ?? null, eventType: e.eventType, title: e.title, description: e.description ?? null,
  startsAt: local(e.start), endsAt: local(e.end), locationName: e.locationName ?? null, locationLat: e.lat ?? null, locationLng: e.lng ?? null, visibility: e.visibility ?? 'PRIVATE', publishAt: null, publicNow: e.visibility === 'PUBLIC',
  recurring: Boolean(e.recurring), recurrence: null, opponentClubId: e.opponentClubId ?? null, opponentClubName: e.opponentClubId ? clubById(e.opponentClubId).name : null, challengeStatus: e.opponentClubId ? 'ACCEPTED' : null,
  status: e.status ?? (e.end.getTime() < now() ? 'COMPLETED' : 'SCHEDULED'), conflict: false, conflictingEventIds: [], challengerSquadId: e.squadId ?? null, challengerSquadName: e.squadId ? squadById(e.squadId).name : null,
  targetSquadId: e.targetSquadId ?? null, targetSquadName: e.targetSquadId ? squadById(e.targetSquadId).name : null, origin: e.origin ?? (e.userId ? 'PERSONAL_CALENDAR' : 'CLUB_CALENDAR'), originId: e.originId ?? null,
  homeScore: e.homeScore ?? null, awayScore: e.awayScore ?? null, resultStatus: e.resultStatus, matchExchangeId: e.matchExchangeId ?? null, canRecordResult: Boolean(e.canRecordResult), resultClubId: e.resultClubId ?? null, ...overrides,
});
const venueFields = (venueId, pitch) => { const v = venueById(venueId); return v ? { locationName: pitch ? `${v.name} · ${pitch}` : `${v.name}, ${v.city}`, lat: v.lat, lng: v.lng } : {}; };
function matchOccurrence(m) {
  const h = historyFromMatch(m), theirs = F.squadFor(m.opponentClubId, squadById(m.squadId).ageGroup, squadById(m.squadId).gender), played = m.status === 'COMPLETED', cancelled = m.status === 'CANCELLED';
  return occurrence({ id: m.id, clubId: DINAMO, eventType: m.kind === 'FRIENDLY' ? 'FRIENDLY' : 'MATCH', title: h.title, description: `${m.kind === 'FRIENDLY' ? 'Friendly arranged through the match exchange' : m.competition}. ${m.home ? 'Home fixture' : 'Away fixture'}; meet 75 minutes before kick-off.${m.refereeId ? ` Referee: ${personById(m.refereeId).fullName}.` : ''}`,
    start: m.start, end: m.end, ...venueFields(m.venueId), visibility: 'PUBLIC', opponentClubId: m.opponentClubId, squadId: m.squadId, targetSquadId: theirs?.id ?? null, status: cancelled ? 'CANCELLED' : played ? 'COMPLETED' : 'SCHEDULED',
    origin: m.kind === 'FRIENDLY' ? 'MATCH_EXCHANGE' : 'CLUB_CALENDAR', originId: m.kind === 'FRIENDLY' ? m.id : null, homeScore: h.homeScore, awayScore: h.awayScore, resultStatus: h.resultStatus, matchExchangeId: m.kind === 'FRIENDLY' ? m.id : null, canRecordResult: m.start.getTime() < now() && h.resultStatus !== 'CONFIRMED', resultClubId: DINAMO },
    // Squad timetables may mirror the same fixture; sharing the occurrence key lets the calendar merge them into one card.
    { occurrenceId: `squad:${m.squadId}:${m.id}` });
}
function fixtureOccurrence(t, f) {
  const h = historyFromFixture(t, f), st = F.tournamentState.get(t.id), ours = [st.entries.find(e => e.id === f.homeEntryId), st.entries.find(e => e.id === f.awayEntryId)].find(e => e?.clubId === DINAMO), other = [st.entries.find(e => e.id === f.homeEntryId), st.entries.find(e => e.id === f.awayEntryId)].find(e => e && e !== ours);
  const span = fixtureSpan(t, f);
  return occurrence({ id: f.id, clubId: DINAMO, eventType: 'MATCH', title: span.title, description: `${t.name}${f.stageName ? ` · ${f.stageName}` : ''}, round ${f.roundNumber}.`, start: span.start, end: span.end, ...venueFields(f.locationId), visibility: 'PUBLIC',
    opponentClubId: other?.clubId ?? null, squadId: ours?.squadId ?? null, targetSquadId: other?.squadId ?? null, status: f.status === 'COMPLETED' ? 'COMPLETED' : f.status, homeScore: f.homeScore, awayScore: f.awayScore, resultStatus: h.resultStatus, resultClubId: DINAMO });
}
function exchangeOccurrence(l) {
  const v = F.listingView(l);
  return occurrence({ id: l.id, clubId: v.club_id, eventType: 'FRIENDLY', title: `${v.club_name} vs ${v.opponent_name}`, description: v.description, start: l.start, end: l.end, locationName: v.location_name ? `${v.location_name}, ${v.city}` : v.city, lat: v.location_lat, lng: v.location_lng, visibility: 'PUBLIC',
    opponentClubId: v.opponent_club_id, squadId: v.squad_id, targetSquadId: v.target_squad_id, origin: 'MATCH_EXCHANGE', originId: l.id, matchExchangeId: l.id, homeScore: v.home_score, awayScore: v.away_score, resultStatus: v.result_status || 'NONE' });
}
const clubCalendar = clubId => {
  if (Number(clubId) !== DINAMO) {
    // Other clubs: their public fixtures from competitions and the match exchange.
    const out = [];
    for (const t of F.tournamentList) for (const f of F.tournamentState.get(t.id).fixtures) {
      const st = F.tournamentState.get(t.id), e = [st.entries.find(x => x.id === f.homeEntryId), st.entries.find(x => x.id === f.awayEntryId)];
      if (!f.scheduledAt || !e.some(x => x?.clubId === Number(clubId))) continue;
      const h = historyFromFixture(t, f), other = e.find(x => x && x.clubId !== Number(clubId));
      const span = fixtureSpan(t, f);
      out.push(occurrence({ id: f.id, clubId: Number(clubId), eventType: 'MATCH', title: span.title, description: t.name, start: span.start, end: span.end, ...venueFields(f.locationId), visibility: 'PUBLIC', opponentClubId: other?.clubId ?? null, status: f.status, homeScore: f.homeScore, awayScore: f.awayScore, resultStatus: h.resultStatus }));
    }
    for (const l of F.exchange.filter(l => squadById(l.hostSquadId).clubId === Number(clubId) && l.opponentSquadId && !matches.some(m => m.id === l.id))) out.push(exchangeOccurrence(l));
    // A page club's squads with training days and a time: their sessions for the next four weeks, so the calendar and Coming up show them.
    if (P.isPageClub(clubId)) for (const t of P.trainingOf(P.clubPage(clubId))) {
      out.push(occurrence({ id: t.id, clubId: Number(clubId), eventType: 'TRAINING', title: `${t.squad.name} training`, start: t.start, end: t.end, locationName: t.ground?.name ?? null, lat: t.ground?.latitude ?? null, lng: t.ground?.longitude ?? null, visibility: 'PUBLIC', squadId: t.squad.id, recurring: true }));
    }
    for (const m of matches.filter(m => m.opponentClubId === Number(clubId))) {
      const theirs = F.squadFor(clubId, squadById(m.squadId).ageGroup, squadById(m.squadId).gender);
      out.push({ ...matchOccurrence(m), clubId: Number(clubId), clubName: clubById(clubId).name, opponentClubId: DINAMO, opponentClubName: clubById(DINAMO).name, challengerSquadId: theirs?.id ?? null, challengerSquadName: theirs?.name ?? null, targetSquadId: m.squadId, targetSquadName: squadById(m.squadId).name, canRecordResult: false });
    }
    return out;
  }
  return [
    ...matches.filter(m => !leagueReplaced(m)).map(matchOccurrence),
    ...[301, 306].flatMap(id => { const t = F.tournamentById(id); return F.tournamentState.get(id).fixtures.filter(f => f.scheduledAt && [f.homeEntryId, f.awayEntryId].some(eid => F.tournamentState.get(id).entries.find(e => e.id === eid)?.clubId === DINAMO)).map(f => fixtureOccurrence(t, f)); }),
    ...F.exchange.filter(l => l.opponentSquadId && !matches.some(m => m.id === l.id) && F.involvesDinamo(l)).map(exchangeOccurrence),
    ...F.clubActivities.map(a => occurrence({ ...a, eventType: a.type, ...venueFields(a.venueId, a.pitch), visibility: F.isPublicActivity(a) ? 'PUBLIC' : 'PRIVATE', recurring: /Goalkeeper clinic|staff meeting/i.test(a.title), status: a.status === 'CANCELLED' ? 'CANCELLED' : undefined })),
  ];
};
const windowFilter = (list, q) => {
  const from = parseWhen(q.get('from')), to = parseWhen(q.get('to'));
  return list.filter(o => inWindow(new Date(o.startsAt), new Date(o.endsAt), from, to)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
};
get('/schedule/clubs/:id/events', ({ params, query: q }) => clubById(params.id) ? { events: windowFilter(clubCalendar(params.id), q) } : notFound());
get('/schedule/me/events', ({ query: q }) => ({ events: windowFilter(F.personalEvents.map(e => occurrence({ ...e, eventType: e.type, visibility: 'PRIVATE', status: e.status === 'CANCELLED' ? 'CANCELLED' : undefined })), q) }));
get('/schedule/public-events', ({ query: q }) => ({ events: windowFilter(clubCalendar(DINAMO).filter(e => e.publicNow), q) }));
get('/schedule/events/:id', ({ params }) => clubCalendar(DINAMO).find(e => e.eventId === Number(params.id)) || notFound());
function createEvent(body, clubId) {
  const start = parseWhen(body?.startsAt), end = parseWhen(body?.endsAt);
  if (!body?.title || !start || !end || end <= start) return reply(400, { status: 400, message: 'Add a title, start and end time.' });
  const rec = { id: W.newId(), type: body.eventType || 'ACTIVITY', title: body.title, description: body.description || '', start, end, venueId: null, pitch: null, locationName: body.locationName || null, lat: body.locationLat ?? null, lng: body.locationLng ?? null, status: 'SCHEDULED' };
  if (clubId) { Object.assign(rec, { clubId, squadId: body.hostSquadId ?? null, opponentClubId: body.opponentClubId ?? null }); F.clubActivities.push(rec); }
  else { Object.assign(rec, { userId: W.ME_ID }); F.personalEvents.push(rec); }
  return reply(201, { eventId: rec.id, conflict: false, conflictingEventIds: [] });
}
const findOwnEvent = id => F.clubActivities.find(e => e.id === Number(id)) || F.personalEvents.find(e => e.id === Number(id));
post('/schedule/clubs/:id/events', ({ params, body }) => createEvent(body, Number(params.id)));
post('/schedule/me/events', ({ body }) => createEvent(body, null));
put('/schedule/events/:id', ({ params, body }) => {
  const e = findOwnEvent(params.id); if (!e) return notFound('This event can’t be edited here.');
  Object.assign(e, { title: body?.title ?? e.title, description: body?.description ?? e.description, type: body?.eventType ?? e.type, start: parseWhen(body?.startsAt) || e.start, end: parseWhen(body?.endsAt) || e.end, locationName: body?.locationName ?? e.locationName });
  if (body?.locationName) e.venueId = null;
  return { eventId: e.id, conflict: false, conflictingEventIds: [] };
});
del('/schedule/events/:id', ({ params }) => { const e = findOwnEvent(params.id); if (e) e.status = 'CANCELLED'; return reply(204); });
post('/schedule/clubs/:clubId/events/:id/cancel', ({ params }) => { const e = findOwnEvent(params.id), m = matches.find(x => x.id === Number(params.id)); if (e) e.status = 'CANCELLED'; if (m) m.status = 'CANCELLED'; return reply(204); });
post('/schedule/clubs/:clubId/events/:id/complete', ({ params }) => { const e = findOwnEvent(params.id); if (e) e.status = 'COMPLETED'; return reply(204); });
for (const path of ['/schedule/clubs/:clubId/events/:id/result', '/schedule/clubs/:clubId/events/:id/result/correction']) post(path, ({ params, body }) => {
  const m = matches.find(x => x.id === Number(params.id)); if (!m) return notFound();
  m.status = 'COMPLETED'; m.score = m.home ? [Number(body?.homeScore), Number(body?.awayScore)] : [Number(body?.awayScore), Number(body?.homeScore)]; SCORE_PENDING.delete(m.id);
  return reply(204);
});
post('/schedule/events/:id/challenge', ({ params, body }) => { const e = clubCalendar(DINAMO).find(x => x.eventId === Number(params.id)); return e ? { ...e, challengeStatus: 'PENDING', opponentClubId: body?.targetClubId ?? null } : notFound(); });
post('/schedule/challenges/:id/response', ({ params, body }) => { const e = clubCalendar(DINAMO).find(x => x.eventId === Number(params.id)); return e ? { ...e, challengeStatus: body?.decision || 'ACCEPTED' } : notFound(); });

// ============================================================== journeys & travel plans
const planItinerary = p => {
  const d = p.draft, place = key => d.places.find(x => x.key === key), pub = x => x && { name: x.name, address: x.address, latitude: x.latitude, longitude: x.longitude, photoUrl: x.photoUrl };
  return { title: d.title, timezone: d.timezone, startsAt: d.startsAt, endsAt: d.endsAt, destination: d.destination, meetingPoint: d.meetingPoint, collectionPoint: d.collectionPoint, supervisionContact: d.supervisionContact, message: d.familyMessage, bring: d.bring || [],
    locations: Object.fromEntries(['meeting', 'destination', 'collection'].map(r => [r, pub(place(`plan:${r}`))])),
    activities: d.activities.map(a => ({ title: a.title, kind: a.kind, startsAt: a.startsAt, endsAt: a.endsAt, place: pub(place(a.placeKey)) })), arrangements: d.arrangements.map(a => ({ title: a.title, kind: a.kind, place: '' })) };
};
const journeyEntries = (from, to, squadId) => F.plans.filter(p => p.published_version > 0 && (!squadId || p.squad_id === squadId)).flatMap(p => p.draft.activities.map((a, i) => {
  const squad = squadById(p.squad_id), subjects = squad.playerIds.slice(0, 16).map(id => personById(id)).map(s => ({ id: s.id, name: s.fullName, guardian: false, canRespond: true, response: F.planReplies.get(`${p.id}:${s.id}`) || (hashResp(p.id, s.id)) }));
  const going = subjects.filter(s => s.response === 'GOING').length, pending = subjects.filter(s => s.response === 'PENDING').length;
  return { id: `journey:${p.id}:${i}`, planId: p.id, activityKey: a.key, version: p.published_version, clubId: p.club_id, squadId: p.squad_id, squadName: squad.name, clubName: clubById(p.club_id).name, journeyTitle: p.title, timezone: TZ, title: a.title, kind: a.kind,
    startsAt: a.startsAt, endsAt: a.endsAt, status: Date.parse(a.endsAt) < now() ? 'COMPLETED' : 'SCHEDULED', sourceChanged: false, place: (() => { const pl = p.draft.places.find(x => x.key === a.placeKey); return pl ? { name: pl.name, address: pl.address, latitude: pl.latitude, longitude: pl.longitude, photoUrl: pl.photoUrl } : null; })(),
    eventId: a.eventId ?? null, sessionId: null, staff: true, itinerary: planItinerary(p), subjects, attendance: { total: subjects.length, going, pending }, replyScope: 'STAFF' };
})).filter(e => (!from || Date.parse(e.endsAt) >= from.getTime()) && (!to || Date.parse(e.startsAt) <= to.getTime()));
function hashResp(planId, subjectId) { const h = F.hash(`${planId}:${subjectId}`) % 10; return h < 6 ? 'GOING' : h < 8 ? 'PENDING' : 'NOT_GOING'; }
get('/journeys/schedule', ({ query: q }) => journeyEntries(parseWhen(q.get('from')), parseWhen(q.get('to')), num(q, 'squadId', null)));
post('/journeys/:id/reply', ({ params, body }) => { const p = F.planById(params.id); if (!p) return notFound(); F.planReplies.set(`${p.id}:${body?.subjectId}`, body?.response === 'NOT_GOING' ? 'NOT_GOING' : 'GOING'); return { recorded: true }; });
const preferences = new Map();
get('/journeys/squads/:id/preferences', ({ params }) => ({ revision: 1, preferences: preferences.get(Number(params.id)) || { meetingPoint: 'Dinamo Academy Training Centre, Gate 2', meetMinutesBefore: 75, transport: 'MINIBUS', notifyFamilies: true } }));
put('/journeys/squads/:id/preferences', ({ params, body }) => { preferences.set(Number(params.id), body?.preferences || body); return { revision: 2, preferences: preferences.get(Number(params.id)) }; });
// POST /journeys/from-fixture lives in map-extra.mjs.
const planContext = () => [{ id: DINAMO, name: clubById(DINAMO).name, settings: { currency: 'GEL', timezone: TZ }, squads: F.DINAMO_SQUADS.map(s => ({ id: s.id, name: s.name, canEdit: true })),
  participants: F.DINAMO_SQUADS.flatMap(s => s.playerIds.map(id => ({ id, name: personById(id).fullName, squad_id: s.id }))),
  events: matches.filter(m => m.status === 'SCHEDULED').map(m => { const v = venueById(m.venueId); return { id: m.id, title: historyFromMatch(m).title, starts_at: iso(m.start), ends_at: iso(m.end), challenger_squad_id: m.squadId, target_squad_id: F.squadFor(m.opponentClubId, squadById(m.squadId).ageGroup, squadById(m.squadId).gender)?.id ?? 0, location_name: v?.name, location_lat: v?.lat ?? null, location_lng: v?.lng ?? null }; }),
  sessions: W.events.filter(e => e.type === 'TRAINING' && e.start.getTime() > now()).slice(0, 40).map(e => ({ id: e.id, title: e.title, starts_at: iso(e.start), ends_at: iso(e.end), squad_id: e.squadId })),
  financeRecords: [{ id: 7501, title: 'Away travel budget, autumn', squad_id: 105, kind: 'BUDGET', status: 'APPROVED' }] }];
const planSummary = p => ({ id: p.id, club_id: p.club_id, squad_id: p.squad_id, title: p.title, revision: p.revision, published_version: p.published_version, published_revision: p.published_revision, updated_at: p.updated_at, starts_at: p.starts_at });
get('/map/plans/context', planContext);
get('/map/plans/family', () => []);
get('/map/plans', ({ query: q }) => F.plans.filter(p => !q.get('clubId') || p.club_id === Number(q.get('clubId'))).map(planSummary));
get('/map/plans/:id', ({ params }) => F.planById(params.id) || notFound('This journey is unavailable.'));
get('/map/plans/:id/changes', () => ({ changes: [], revision: 1 }));
put('/map/plans/:id', ({ params, body }) => { const p = F.planById(params.id); if (!p) return notFound(); if (body?.revision != null && body.revision !== p.revision) return conflict('Someone else saved this journey. Reload to see their changes.'); p.draft = body?.draft || p.draft; p.title = p.draft.title || p.title; p.revision++; p.updated_at = iso(new Date()); p.starts_at = p.draft.startsAt; return p; });
post('/map/plans', ({ body }) => {
  const squad = squadById(body?.squadId) || squadById(105);
  const p = { ...JSON.parse(JSON.stringify(F.plans[0])), id: W.newId(), squad_id: squad.id, title: body?.draft?.title || body?.title || `${squad.name} journey`, revision: 1, published_version: 0, published_revision: null, published: undefined, history: [], journeyResponses: [], familyResponses: [] };
  if (body?.draft) p.draft = body.draft; else p.draft.title = p.title;
  F.plans.push(p); return reply(201, p);
});
post('/map/plans/:id/:action', ({ params }) => {
  const p = F.planById(params.id); if (!p) return notFound();
  if (params.action === 'publish') { p.published_version++; p.published_revision = p.revision; p.published = planItinerary(p); p.history.unshift({ id: W.newId(), revision: p.revision, action: 'PUBLISHED', note: 'Shared with families', created_at: iso(new Date()), actor: W.me.fullName }); }
  if (params.action === 'approve-budget') { p.budgetApproved = true; p.approvedBy = W.ME_ID; }
  return p;
});

// ============================================================== tryouts
get('/tryouts/discovery', ({ query: q }) => {
  const status = q.get('status') || 'OPEN', text = q.get('q'), where = q.get('location'), clubId = num(q, 'clubId', null);
  const from = q.get('from') ? new Date(`${q.get('from')}T00:00:00`) : null, to = q.get('to') ? new Date(`${q.get('to')}T23:59:59`) : null;
  const list = F.trialList.map(F.tryoutView).filter(t => status === 'ALL' || t.status === status).filter(t => clubId == null || t.clubId === clubId)
    .filter(t => matchesText(text, t.title, t.clubName, t.position, t.ageGroup)).filter(t => !where || matchesText(where, t.location))
    .filter(t => inWindow(new Date(t.tryoutDate), new Date(t.tryoutDate), from, to)).sort((a, b) => Date.parse(a.tryoutDate) - Date.parse(b.tryoutDate));
  return itemPage(list, pageOf(q), sizeOf(q, 20));
});
get('/tryouts/my-applications', () => [...F.tryoutApplications.values()]);
get('/tryouts/:id', ({ params }) => { const t = F.trialList.find(x => x.id === Number(params.id)); return t ? F.tryoutView(t) : notFound('This tryout is not available.'); });
get('/tryouts/:id/application', ({ params }) => {
  const t = F.trialList.find(x => x.id === Number(params.id)); if (!t) return notFound();
  const view = F.tryoutView(t), application = F.tryoutApplications.get(t.id) || null;
  return { canApply: view.status === 'OPEN' && !application && t.clubId !== DINAMO, reason: application ? 'ALREADY_APPLIED' : view.status !== 'OPEN' ? 'NOT_OPEN' : t.clubId === DINAMO ? 'ALREADY_AFFILIATED' : null, postingStatus: view.status, application, minorConsentRequired: false, canManage: t.clubId === DINAMO };
});
post('/tryouts/:id/apply', ({ params, body }) => {
  const t = F.trialList.find(x => x.id === Number(params.id)); if (!t) return notFound();
  const receipt = { id: W.newId(), tryoutId: t.id, tryoutTitle: F.tryoutView(t).title, status: 'PENDING', appliedAt: iso(new Date()), reviewedAt: null, message: body?.message ?? null, decisionMessage: null, tryoutLifecycleStatus: 'OPEN' };
  F.tryoutApplications.set(t.id, receipt); return reply(201, receipt);
});
post('/tryouts/applications/:id/withdraw', ({ params }) => { for (const [k, r] of F.tryoutApplications) if (r.id === Number(params.id)) { r.status = 'WITHDRAWN'; F.tryoutApplications.delete(k); } return reply(204); });
post('/tryouts/:id/close', ({ params, body }) => { const t = F.trialList.find(x => x.id === Number(params.id)); if (t) t.status = body?.reason === 'FILLED' ? 'FILLED' : 'CLOSED'; return reply(204); });

// ============================================================== admissions discovery
get('/admissions/opportunities', ({ query: q }) => {
  const accepting = q.get('acceptingOnly') === 'true', waitlist = q.get('includeWaitlist') === 'true', birthYear = num(q, 'birthYear', null), gender = q.get('gender'), beginner = q.get('beginner') === 'true';
  const text = q.get('q'), orgId = num(q, 'organizationId', null), clubId = num(q, 'clubId', null), method = q.get('method'), verified = q.get('verifiedOnly') === 'true', level = q.get('level');
  const bounds = ['minLat', 'maxLat', 'minLng', 'maxLng'].every(k => q.has(k)) ? ['minLat', 'maxLat', 'minLng', 'maxLng'].map(k => num(q, k)) : null;
  const citiesQ = q.getAll('city').map(F.lower), lat = num(q, 'latitude', null), lng = num(q, 'longitude', null), radius = num(q, 'radiusKm', null);
  const list = F.admissionGroups.filter(g => !accepting || g.availability !== 'CLOSED' && (waitlist || g.availability !== 'WAITLIST'))
    .filter(g => birthYear == null || (birthYear >= g.birthYearFrom && birthYear <= g.birthYearTo)).filter(g => !gender || g.gender === 'ANY' || g.gender === gender).filter(g => !beginner || g.beginnerWelcome)
    .filter(g => orgId == null || g.organizationId === orgId).filter(g => clubId == null || g.clubId === clubId).filter(g => !method || g.method === method).filter(g => !verified || g.verified).filter(g => !level || g.level === level)
    .filter(g => !bounds || (g.location.latitude >= bounds[0] && g.location.latitude <= bounds[1] && g.location.longitude >= bounds[2] && g.location.longitude <= bounds[3]))
    .filter(g => !citiesQ.length || citiesQ.includes(F.lower(g.city))).filter(g => lat == null || lng == null || radius == null || kmBetween(lat, lng, g.location.latitude, g.location.longitude) <= radius)
    .filter(g => matchesText(text, g.name, g.organizationName, g.location.name, g.city)).map(({ verified: _v, ...g }) => g);
  return itemPage(list, pageOf(q), sizeOf(q, 20));
});
get('/admissions/opportunities/:id', ({ params }) => { const g = F.groupById(params.id); if (!g) return notFound('This group is unavailable.'); const { verified: _v, ...rest } = g; return rest; });
get('/admissions/home', () => ({ participants: [{ id: W.ME_ID, name: W.me.fullName, dateOfBirth: '1988-04-12', minor: false, guardian: false, provenance: 'SELF', gender: 'MALE', restriction: null }], cases: [], invitations: [], selfCardNeedsDetails: false, inquiries: [] }));

// Jobs & volunteering live in jobs.mjs.
// Fundraising (campaigns) lives in campaigns.mjs.

// ============================================================== supporting lookups
// As the backend: referees with a current club appointment holding the REFEREE specialisation that covers the squad.
get('/referees/club-squad/:squadId', ({ params }) => {
  const s = squadById(params.squadId); if (!s) return notFound();
  if (s.clubId !== DINAMO) return reply(403, { status: 403, message: 'Only staff of this squad can see its club referees.' });
  const ids = C.appointments.filter(a => a.status === 'ACTIVE' && a.specialisations.includes('REFEREE') && (a.club_wide || a.squad_ids.includes(s.id))).map(a => a.user_id);
  return F.refereeProfiles.filter(r => ids.includes(r.user_id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
});
get('/match-exchange/:id/broadcasts', ({ params }) => { const l = F.listingById(params.id); if (!l) return notFound(); return { broadcasts: [], manageableSquads: [l.hostSquadId, l.opponentSquadId].map(id => squadById(id)).filter(s => s && F.isMineClub(s.clubId)).map(s => ({ id: s.id, name: s.name })) }; });
get('/organizations/mine', () => [{ id: 901, slug: 'fc-dinamo-tbilisi-academy', displayName: clubById(DINAMO).name, description: clubById(DINAMO).description, membershipRole: 'CLUB_ADMIN', kinds: ['CLUB', 'TOURNAMENT_ORGANIZER'], primaryKind: 'CLUB', clubBacked: true, canCreateTournament: true }]);
get('/organizations/:id/tournament-host-clubs', ({ params }) => Number(params.id) === 901 ? [{ clubId: DINAMO, clubName: clubById(DINAMO).name, organizationId: 901, organizationName: clubById(DINAMO).name, accessType: 'OWN_ORGANIZATION' }] : []);

// ============================================================== match arrangements (officials, ground, squads)
const officialRequests = F.officialRequests; // listing id -> request
const requestView = l => { const v = F.listingView(l), r = officialRequests.get(l.id); return r && { event_id: l.id, title: l.title, location_name: v.location_name, city: v.city, starts_at_iso: v.starts_at_iso, ends_at_iso: v.ends_at_iso, timezone: TZ, volunteer: r.volunteer, fee: r.fee, currency: r.currency, revision: r.revision, status: r.status, applications: r.applications }; };
for (const l of F.exchange.filter(l => l.refereeRequired && !l.refereeId && l.start.getTime() > now()).slice(0, 6)) {
  const i = l.id % 4;
  officialRequests.set(l.id, { volunteer: i === 0, fee: i === 0 ? 0 : [60, 80, 100][i - 1], currency: 'GEL', revision: 1, status: 'OPEN', applications: F.refereeProfiles.slice(i, i + 2).map(r => ({ referee_id: r.user_id, full_name: r.full_name, status: 'APPLIED' })) });
}
get('/match-arrangements/official-requests', () => F.exchange.filter(l => officialRequests.get(l.id)?.status === 'OPEN').map(requestView));
get('/match-arrangements/:id/official-request', ({ params }) => { const l = F.listingById(params.id); return (l && requestView(l)) || null; });
post('/match-arrangements/:id/official-request', ({ params, body }) => { const l = F.listingById(params.id); if (!l) return notFound(); officialRequests.set(l.id, { volunteer: body?.volunteer !== false, fee: Number(body?.fee) || 0, currency: body?.currency || 'GEL', revision: 1, status: 'OPEN', applications: [] }); return requestView(l); });
for (const action of ['apply', 'select', 'close']) post(`/match-arrangements/:id/official-request/${action}`, ({ params, body }) => {
  const l = F.listingById(params.id), r = officialRequests.get(Number(params.id)); if (!l || !r) return notFound();
  r.revision++;
  if (action === 'close') r.status = 'CLOSED';
  if (action === 'select' && l.refereeId && ['INVITED', 'ACCEPTED'].includes(F.refereeStatusOf(l))) return conflict('Cancel the current official invitation before recruiting a replacement.');
  if (action === 'select') { const id = Number(body?.refereeId) || r.applications[0]?.referee_id; r.status = 'FILLED'; r.applications.forEach(a => { a.status = a.referee_id === id ? 'SELECTED' : 'NOT_SELECTED'; }); l.refereeId = id; l.refereeInvite = null; }
  if (action === 'apply') r.applications.push({ referee_id: W.ME_ID, full_name: W.me.fullName, status: 'APPLIED' });
  return requestView(l);
});
const listingAction = fn => ({ params, body }) => { const l = F.listingById(params.id); if (!l) return notFound(); fn(l, body || {}); l.revision++; return F.listingView(l, { detail: true }); };
// The invited club answers (ACCEPT with its squad, or DECLINE); an agreed guest squad can WITHDRAW.
post('/match-arrangements/:id/response', listingAction((l, body) => {
  const action = body.action ?? body.decision ?? (body.accept === true ? 'ACCEPT' : body.withdraw ? 'WITHDRAW' : null);
  const entry = (name, reason = null) => l.history.push({ id: W.newId(), action: name, created_at: iso(new Date()), reason });
  const request = S.requestItems.find(i => i.key === `MATCH_INVITATION:${l.id}`);
  if (request && ['ACCEPT', 'DECLINE'].includes(action)) Object.assign(request, { status: action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED', actionable: false, updatedAt: iso(new Date()) });
  if (action === 'ACCEPT') { const s = squadById(body.squadId) ?? squadById(l.requestedSquadId); if (s && F.isMineClub(s.clubId)) l.opponentSquadId = s.id; l.status = 'ARRANGED'; entry('OPPONENT_AGREED'); }
  else if (action === 'DECLINE') { l.status = 'CLOSED'; entry('CHALLENGE_DECLINED'); }
  else if (action === 'WITHDRAW') { l.opponentSquadId = null; l.status = 'OPEN'; entry('OPPONENT_WITHDRAWN', body.reason || null); }
}));
post('/match-arrangements/:id/open-opponent-search', listingAction(l => { l.requestedClubId = null; l.status = 'OPEN'; }));
for (const kind of ['attendance', 'participants']) post(`/match-arrangements/:id/squads/:squadId/${kind}`, ({ params, body }) => {
  const l = F.listingById(params.id), s = squadById(params.squadId); if (!l || !s || !F.isMineClub(s.clubId)) return notFound();
  if (kind === 'participants' && Array.isArray(body?.playerIds)) matchSelections.set(`${l.id}:${s.id}`, new Set(body.playerIds.map(Number)));
  l.revision++; return teamView(l, s);
});
// As the backend: the path names the appointment; one no longer live is a conflict.
post('/match-exchange/:id/referees/:appointment/cancel', ({ params }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  const id = Number(params.appointment), assistant = (l.assistants ?? []).find(o => o.id === id);
  if (assistant) l.assistants = l.assistants.filter(o => o !== assistant);
  else if (l.refereeId && id === F.refereeAppointmentId(l)) { l.refereeId = null; l.refereeInvite = null; }
  else return conflict('This appointment is no longer active.');
  l.revision++;
  return F.listingView(l, { detail: true });
});
post('/match-exchange/:id/external-venue-resolution', listingAction(l => { l.history.push({ id: W.newId(), action: 'EXTERNAL_VENUE', created_at: iso(new Date()), reason: 'Resolved with the ground owner' }); }));
