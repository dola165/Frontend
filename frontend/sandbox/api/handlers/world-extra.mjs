// Synthetic API: GrassKickZ World. Only the endpoint World needs that the real API lacks.
//
// BACKEND NEEDED — GET /people (BACKEND_NEEDS.md §3.3)
//   The public directory of football people World › People shows in four views.
//   Query: q (name, headline, profession or club); role (repeatable: COACH | CLUB_STAFF | SPECIALIST | PLAYER |
//   REFEREE), the view a person is in, worked out from their job (a club physio is a specialist, an academy director
//   is club staff); city; club (none | any); profession (repeatable, matched against the person's job and
//   profession); licence (PRO | A | B | C: that level or higher, GK: a goalkeeper licence; as people state it);
//   position (repeatable: GK | DEF | MID | FWD); openTo (repeatable: WORK, a job at a club | SERVICES, paid sessions
//   such as private training or physio | VOLUNTEER | CLUB, a player looking for a club | COACHING, a player looking for
//   a coach); age (repeatable: 18-21 | 22-29 | 30+); lat & lng (the place distances are measured from); sort
//   (NEAREST, needs lat & lng | RELEVANCE | NAME); page; size (max 50). The list is never narrowed to a place.
//   Response: { items: PersonSummary[], total, page, size, hasMore }
//   PersonSummary: { id, fullName, username, avatarUrl, role, headline, profession, clubId, clubName, clubLogoUrl,
//     city, distanceKm (with lat & lng), position (enum), age (players), foot, licence (PRO | A | B | C | GK, as
//     stated), openTo[], rate ({ amount, currency, per: SESSION } for SERVICES) }
//   Rules: never lists minors, parents, agents or private profiles; signed-in members only; club staff are listed with
//   their club only while the club publishes them.
import { get, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as S from '../world-social.mjs';
import * as C from '../world-club.mjs';
import * as F from '../world-football.mjs';

const lower = value => String(value ?? '').toLowerCase();
const num = (query, key, fallback) => { const v = Number(query.get(key)); return query.has(key) && Number.isFinite(v) ? v : fallback; };

/** The job a person does, as their club or they themselves describe it. */
const jobOf = p => W.staff.find(s => s.personId === p.id)?.title ?? p.staffTitle ?? p.profession ?? null;
const JOB_VIEW = [[/nutrition|physio|psycholog|doctor|medical/i, 'SPECIALIST'], [/director|manager|kit|welfare|secretary/i, 'CLUB_STAFF']];
/** Which People view a person is in, from their job rather than how their account was created. */
const viewOf = p => {
  if (p.role === 'PLAYER' || p.role === 'REFEREE' || p.role === 'SPECIALIST') return p.role;
  if (p.role !== 'COACH' && p.role !== 'STAFF') return null;
  const job = jobOf(p) ?? p.headline ?? '';
  return JOB_VIEW.find(([pattern]) => pattern.test(job))?.[1] ?? 'COACH';
};
/** Club staff are listed with their club only while the club publishes them (a public member or a published appointment). */
const published = p => p.clubId !== C.CLUB_ID || p.role === 'PLAYER'
  || C.members.some(m => m.userId === p.id && m.isPublic) || C.appointments.some(a => a.user_id === p.id && a.status === 'ACTIVE' && a.published);

const LICENCE = [[/uefa pro/i, 'PRO'], [/goalkeeper/i, 'GK'], [/uefa a\b/i, 'A'], [/uefa b\b/i, 'B'], [/uefa c\b/i, 'C']];
const RANK = { PRO: 4, A: 3, B: 2, C: 1 };
/** The licence a person states (never one still "in progress"). */
const licenceOf = p => {
  const text = C.members.find(m => m.userId === p.id)?.qualifications ?? p.licences?.join(' · ') ?? (/uefa/i.test(p.headline ?? '') ? p.headline : null);
  return !text || /in progress/i.test(text) ? null : LICENCE.find(([pattern]) => pattern.test(text))?.[1] ?? null;
};
const BAND = { GK: 'GK', RB: 'DEF', CB: 'DEF', LB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', RW: 'FWD', LW: 'FWD', ST: 'FWD' };
const AGES = { '18-21': [18, 21], '22-29': [22, 29], '30+': [30, 200] };
/** What a person is open to, as they would set it on their profile (synthetic, by id, so it stays put). */
const openToOf = p => {
  const view = viewOf(p), out = [];
  if (view === 'PLAYER') { if (p.freeAgent) out.push('CLUB'); if (p.id % 6 === 0) out.push('COACHING'); }
  else if (view === 'SPECIALIST') { if (!p.clubId) out.push('SERVICES'); if (p.id % 3 === 0) out.push('WORK'); }
  else if (view === 'COACH' || view === 'CLUB_STAFF') { if (!p.clubId) out.push('WORK', 'SERVICES'); else { if (p.id % 4 === 0) out.push('SERVICES'); if (p.id % 5 === 0) out.push('WORK'); } if (p.id % 7 === 0) out.push('VOLUNTEER'); }
  return [...new Set(out)];
};
const rateOf = p => openToOf(p).includes('SERVICES') ? { amount: [40, 50, 60, 70, 80][p.id % 5], currency: 'GEL', per: 'SESSION' } : null;
/** Where a person is counted: their club's ground, else their city's centre. */
const pointOf = p => { const club = p.clubId ? W.clubById(p.clubId) : null; return club ?? W.cities[p.city] ?? null; };

const summary = (p, from) => {
  const club = p.clubId ? W.clubById(p.clubId) : null, player = p.role === 'PLAYER', at = pointOf(p);
  return {
    id: p.id, fullName: p.fullName, username: p.username, avatarUrl: p.avatarUrl, role: viewOf(p),
    headline: p.headline ?? null, profession: p.profession ?? jobOf(p), clubId: club?.id ?? null, clubName: club?.name ?? null, clubLogoUrl: club?.logoUrl ?? null,
    city: club?.city ?? p.city ?? null, distanceKm: from && at ? Math.round(F.kmBetween(from.lat, from.lng, at.lat, at.lng) * 10) / 10 : null,
    position: player ? C.POSITION_CODE[p.position] ?? null : null, age: player ? S.ageOf(p) : null,
    foot: player ? p.preferredFoot ?? null : null, licence: player ? null : licenceOf(p), openTo: openToOf(p), rate: rateOf(p),
  };
};

get('/people', ({ query: q, headers }) => {
  if (!String(headers?.authorization ?? '').startsWith('Bearer ')) return reply(401, { status: 401, message: 'Sign in to search people.' });
  const text = lower(q.get('q')).trim(), roles = q.getAll('role'), city = lower(q.get('city')).trim(), club = q.get('club');
  const professions = q.getAll('profession').map(value => lower(value).trim().replace(/(ist|ists|y)$/, '')).filter(Boolean);
  const licence = q.get('licence'), positions = q.getAll('position'), openTo = q.getAll('openTo'), ages = q.getAll('age').map(band => AGES[band]).filter(Boolean);
  const from = Number.isFinite(Number(q.get('lat'))) && Number.isFinite(Number(q.get('lng'))) && q.get('lat') && q.get('lng') ? { lat: Number(q.get('lat')), lng: Number(q.get('lng')) } : null;
  const page = Math.max(0, num(q, 'page', 0)), size = Math.max(1, Math.min(50, num(q, 'size', 24)));
  const people = W.people.filter(p => viewOf(p) && !S.isMinor(p) && published(p));
  const list = people.map(p => [p, summary(p, from)])
    .filter(([, s]) => !roles.length || roles.includes(s.role))
    .filter(([, s]) => !city || lower(s.city).includes(city))
    .filter(([, s]) => club !== 'none' || s.clubId == null).filter(([, s]) => club !== 'any' || s.clubId != null)
    .filter(([, s]) => !professions.length || professions.some(value => [s.profession, s.headline].some(v => lower(v).includes(value))))
    .filter(([, s]) => !licence || (licence === 'GK' ? s.licence === 'GK' : (RANK[s.licence] ?? 0) >= (RANK[licence] ?? 9)))
    .filter(([p]) => !positions.length || positions.includes(BAND[p.position]))
    .filter(([, s]) => !openTo.length || openTo.some(value => s.openTo.includes(value)))
    .filter(([, s]) => !ages.length || ages.some(([from, to]) => s.age != null && s.age >= from && s.age <= to))
    .filter(([, s]) => !text || [s.fullName, s.headline, s.profession, s.clubName].some(v => lower(v).includes(text)))
    .map(([, s]) => s);
  // Relevance: people who describe what they do first, then by name.
  const weight = s => s.headline ? 0 : 1;
  const sort = q.get('sort');
  list.sort(sort === 'NAME' ? (a, b) => a.fullName.localeCompare(b.fullName)
    : sort === 'NEAREST' && from ? (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.fullName.localeCompare(b.fullName)
      : (a, b) => weight(a) - weight(b) || a.fullName.localeCompare(b.fullName));
  const items = list.slice(page * size, page * size + size);
  return { items, total: list.length, page, size, hasMore: (page + 1) * size < list.length };
});
