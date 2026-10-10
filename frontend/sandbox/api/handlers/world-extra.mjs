// Synthetic API: GrassKickZ World. Only the endpoint World needs that the real API lacks.
//
// BACKEND NEEDED — GET /people
//   Public-profile directory of football people, searchable by role and place.
//   Query: q (name, headline, profession or club), role (COACH | PLAYER | REFEREE | AGENT |
//   SPECIALIST | CLUB_STAFF), profession (free text, matched against the person's own
//   description and its mapped labels), city, verified=true (club- or document-confirmed only),
//   sort (RELEVANCE | NAME), page, size (max 50).
//   Response: { items: PersonSummary[], total, page, size, hasMore }
//   PersonSummary: { id, fullName, username, avatarUrl, role, headline, profession,
//     clubId, clubName, city, verified }
//   Rules: never lists minors, parents or private profiles; signed-in members only.
import { get, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as S from '../world-social.mjs';

const ROLE_OF = { COACH: 'COACH', PLAYER: 'PLAYER', REFEREE: 'REFEREE', AGENT: 'AGENT', SPECIALIST: 'SPECIALIST', STAFF: 'CLUB_STAFF' };
const lower = value => String(value ?? '').toLowerCase();
const num = (query, key, fallback) => { const v = Number(query.get(key)); return query.has(key) && Number.isFinite(v) ? v : fallback; };

const summary = p => {
  const club = p.clubId ? W.clubById(p.clubId) : null;
  return {
    id: p.id, fullName: p.fullName, username: p.username, avatarUrl: p.avatarUrl, role: ROLE_OF[p.role],
    headline: p.headline ?? null, profession: p.profession ?? null, clubId: club?.id ?? null, clubName: club?.name ?? null,
    city: club?.city ?? p.city ?? null,
    // Club staff and players are confirmed by their club; referees and agents by their licence.
    verified: Boolean(club) || p.role === 'REFEREE' || p.role === 'AGENT',
  };
};

get('/people', ({ query: q, headers }) => {
  if (!String(headers?.authorization ?? '').startsWith('Bearer ')) return reply(401, { status: 401, message: 'Sign in to search people.' });
  const text = lower(q.get('q')).trim(), role = q.get('role'), city = lower(q.get('city')).trim(), verified = q.get('verified') === 'true';
  const profession = lower(q.get('profession')).trim().replace(/(ist|ists|y)$/, '');
  const page = Math.max(0, num(q, 'page', 0)), size = Math.max(1, Math.min(50, num(q, 'size', 24)));
  const list = W.people
    .filter(p => ROLE_OF[p.role] && !S.isMinor(p))
    .map(summary)
    .filter(p => !role || p.role === role)
    .filter(p => !city || lower(p.city).includes(city))
    .filter(p => !verified || p.verified)
    .filter(p => !profession || [p.profession, p.headline].some(v => lower(v).includes(profession)))
    .filter(p => !text || [p.fullName, p.headline, p.profession, p.clubName].some(v => lower(v).includes(text)));
  // Relevance: people with a public headline and staff roles first, then by name.
  const weight = p => (p.role === 'PLAYER' ? 2 : 0) + (p.headline ? 0 : 1);
  list.sort(q.get('sort') === 'NAME' ? (a, b) => a.fullName.localeCompare(b.fullName) : (a, b) => weight(a) - weight(b) || a.fullName.localeCompare(b.fullName));
  const items = list.slice(page * size, page * size + size);
  return { items, total: list.length, page, size, hasMore: (page + 1) * size < list.length };
});
