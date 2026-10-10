// Synthetic API: arranging matches. The real API already has POST /match-arrangements (the
// frontend contract is `src/features/matchExchange/arrange/api.ts`); only the sandbox lacked it.
//
// POST /match-arrangements
//   Body: { match: { squadId, title, description, startsAt, endsAt, timezone, city, locationName,
//     latitude, longitude, ageGroup, level, format, venuePreference, refereeRequired, venueId,
//     requestId, revision }, targetClubId, targetSquadId, bookingId, matchType, hostingChoice,
//     officialMode, officialResponsibility, refereeId, externalRefereeName, volunteer, fee, currency }
//   With targetClubId it is a direct invitation to that club (requested_club_id on the listing);
//   without it, an open listing other squads can propose to. A repeated requestId returns the
//   first match instead of creating a second one.
import { post, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';

const { iso } = W;
const when = value => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const bad = message => reply(400, { status: 400, message });
const seen = new Map(); // requestId -> listing id

post('/match-arrangements', ({ body }) => {
  const m = body?.match ?? {};
  if (m.requestId && seen.has(m.requestId)) return F.listingView(F.listingById(seen.get(m.requestId)), { detail: true });
  const squad = F.sq(m.squadId);
  if (!squad || squad.clubId !== F.DINAMO) return bad('Choose one of your squads.');
  const start = when(m.startsAt), end = when(m.endsAt);
  if (!start || !end || end <= start) return bad('Choose kick-off and a match length.');
  if (start.getTime() < Date.now()) return bad('Kick-off must be in the future.');
  if (!String(m.city ?? '').trim()) return bad('Add the city where you plan to play.');
  const target = body.targetClubId ? W.clubById(Number(body.targetClubId)) : null;
  if (body.targetClubId && !target) return reply(404, { status: 404, message: 'That club is no longer on GrassKickZ.' });
  if (target?.id === F.DINAMO) return bad('Choose another club to play.');
  const targetSquad = body.targetSquadId ? F.sq(body.targetSquadId) : null;
  if (body.targetSquadId && targetSquad?.clubId !== target?.id) return bad('That squad does not belong to the club you invited.');
  if (body.bookingId) return bad('Match arrangements no longer take a pitch reservation.');
  if (body.officialMode === 'EXTERNAL' && !String(body.externalRefereeName ?? '').trim()) return bad('Name the referee you have arranged.');
  const venue = W.venueById(Number(m.venueId));
  const rec = {
    id: W.newId(), hostSquadId: squad.id, start, end, venueId: venue?.id ?? null,
    place: venue ? null : { name: String(m.locationName ?? '').trim() || 'Ground to be arranged', city: m.city, lat: m.latitude ?? null, lng: m.longitude ?? null },
    title: String(m.title ?? '').trim() || `${squad.name} friendly`, description: m.description ?? '', level: m.level || 'DEVELOPMENT',
    venuePreference: m.venuePreference || 'EITHER', hostingChoice: body.hostingChoice ?? null, refereeRequired: body.officialMode !== 'NONE',
    refereeResponsibility: body.officialResponsibility === 'OPPONENT' ? 'OPPONENT' : 'HOST', externalRefereeName: body.officialMode === 'EXTERNAL' ? body.externalRefereeName : null,
    opponentSquadId: null, status: 'OPEN', score: null, proposals: [], booked: false, refereeId: null,
    requestedClubId: target?.id ?? null, requestedSquadId: targetSquad?.id ?? null, kind: body.matchType === 'COMPETITIVE' ? 'COMPETITIVE' : 'FRIENDLY',
    revision: 1, ageGroup: m.ageGroup || squad.ageGroup, format: m.format || '11_A_SIDE', created: new Date(),
    history: [{ id: W.newId(), action: target ? 'CHALLENGE_SENT' : 'PUBLISHED', created_at: iso(new Date()), reason: null }],
  };
  F.exchange.push(rec);
  if (m.requestId) seen.set(m.requestId, rec.id);
  return reply(201, F.listingView(rec, { detail: true }));
});

const seed = rec => { rec.end = F.plusMin(rec.start, rec.minutes); delete rec.minutes; rec.history.push({ id: W.newId(), action: 'CHALLENGE_SENT', created_at: iso(rec.created), reason: null }); F.exchange.push(rec); return rec; };
const base = { proposals: [], booked: false, refereeId: null, opponentSquadId: null, status: 'OPEN', score: null, kind: 'FRIENDLY', revision: 1, externalRefereeName: null, history: [] };

// An invitation waiting for Luka: Locomotive's U14 coach would like to play Dinamo U14 Boys.
const locoU14 = F.squadFor(5, 'U14', 'MALE');
seed({
  ...base, id: W.newId(), hostSquadId: locoU14.id, start: F.at(F.nextDow(0, 8), 11), minutes: 80, venueId: 203, place: null,
  title: 'U14 friendly: Locomotive v Dinamo', description: 'Two halves of 35 minutes on the main pitch. We provide the referee and match balls. Changing rooms open from 10:00.',
  level: 'COMPETITIVE', venuePreference: 'HOME', hostingChoice: 'HOME', refereeRequired: true, refereeResponsibility: 'HOST',
  requestedClubId: F.DINAMO, requestedSquadId: 103, ageGroup: 'U14', format: '9_A_SIDE', created: W.day(-1, 18, 40),
});

// One Luka sent: Dinamo U16 Boys invited Batumi Seaside to Digomi; Batumi has not answered yet.
seed({
  ...base, id: W.newId(), hostSquadId: 105, start: F.at(F.nextDow(6, 9), 15), minutes: 95, venueId: 202, place: null,
  title: 'U16 Boys v Batumi Seaside', description: 'Happy to play 3 × 30 minutes if you bring a big squad. Kit: we wear white.',
  level: 'COMPETITIVE', venuePreference: 'HOME', hostingChoice: 'HOME', refereeRequired: true, refereeResponsibility: 'HOST',
  requestedClubId: 12, requestedSquadId: F.squadFor(12, 'U16', 'MALE').id, ageGroup: 'U16', format: '11_A_SIDE', created: W.day(-2, 20, 5),
});
