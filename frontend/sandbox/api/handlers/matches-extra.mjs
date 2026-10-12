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
import * as S from '../world-social.mjs';

const { iso } = W;
const when = value => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const bad = message => reply(400, { status: 400, message });
const seen = new Map(); // requestId -> { listing id, the body it created }
const TWELVE_HOURS = 12 * 3_600_000;

post('/match-arrangements', ({ body }) => {
  const m = body?.match ?? {};
  // As the backend: the same request again returns the match it created; the same request id with other terms is refused.
  const fingerprint = JSON.stringify({ ...body, match: { ...m, requestId: undefined } });
  if (m.requestId && seen.has(m.requestId)) {
    const first = seen.get(m.requestId);
    if (first.fingerprint !== fingerprint) return reply(409, { status: 409, message: 'This request already created a different arrangement. Open the original match before making changes.' });
    return F.listingView(F.listingById(first.id), { detail: true });
  }
  const squad = F.sq(m.squadId);
  if (!squad || squad.clubId !== F.DINAMO) return bad('Choose one of your squads.');
  const start = when(m.startsAt), end = when(m.endsAt);
  if (!start || !end || end <= start) return bad('Choose kick-off and a match length.');
  if (end - start > TWELVE_HOURS) return bad('A match lasts at most 12 hours.');
  if (start.getTime() < Date.now()) return bad('Kick-off must be in the future.');
  if (!String(m.city ?? '').trim()) return bad('Add the city where you plan to play.');
  const target = body.targetClubId ? W.clubById(Number(body.targetClubId)) : null;
  if (body.targetClubId && !target) return reply(404, { status: 404, message: 'That club is no longer on GrassKickZ.' });
  if (target?.id === F.DINAMO) return bad('Choose another club to play.');
  const targetSquad = body.targetSquadId ? F.sq(body.targetSquadId) : null;
  if (body.targetSquadId && targetSquad?.clubId !== target?.id) return bad('That squad does not belong to the club you invited.');
  if (body.bookingId) return bad('Match arrangements no longer take a pitch reservation.');
  if (!['INVITE', 'OPEN', 'EXTERNAL', 'LATER', 'NONE'].includes(body.officialMode) || !['HOST', 'OPPONENT'].includes(body.officialResponsibility)) return bad('Choose how the official will be arranged.');
  if (body.officialResponsibility === 'OPPONENT' && !['LATER', 'NONE'].includes(body.officialMode)) return bad('The opponent can arrange the official after accepting the match.');
  if ((body.officialMode !== 'NONE') !== Boolean(m.refereeRequired)) return bad('Check the referee requirement.');
  if (body.officialMode === 'EXTERNAL' && !String(body.externalRefereeName ?? '').trim()) return bad('Name the referee you have arranged.');
  const invited = body.officialMode === 'INVITE' ? F.refereeProfiles.find(r => r.user_id === Number(body.refereeId)) : null;
  if (body.officialMode === 'INVITE' && !invited) return bad('Choose the referee to invite.');
  if (invited && !(body.volunteer ? invited.accepts_volunteer : invited.accepts_paid)) return bad('This referee is not available for these terms.');
  const fee = body.volunteer ? 0 : Number(body.fee);
  if ((invited || body.officialMode === 'OPEN') && !body.volunteer && !(Number.isFinite(fee) && fee >= 0 && fee <= 1_000_000)) return bad('Offer a fee from 0 to 1,000,000.');
  const venue = W.venueById(Number(m.venueId));
  const rec = {
    id: W.newId(), hostSquadId: squad.id, start, end, venueId: venue?.id ?? null,
    place: venue ? null : { name: String(m.locationName ?? '').trim() || 'Ground to be arranged', city: m.city, lat: m.latitude ?? null, lng: m.longitude ?? null },
    title: String(m.title ?? '').trim() || `${squad.name} friendly`, description: m.description ?? '', level: m.level || 'DEVELOPMENT',
    venuePreference: m.venuePreference || 'EITHER', hostingChoice: body.hostingChoice ?? null, refereeRequired: body.officialMode !== 'NONE',
    refereeResponsibility: body.officialResponsibility === 'OPPONENT' ? 'OPPONENT' : 'HOST', externalRefereeName: body.officialMode === 'EXTERNAL' ? body.externalRefereeName : null,
    opponentSquadId: null, status: 'OPEN', score: null, proposals: [], bookingId: null, refereeId: null,
    requestedClubId: target?.id ?? null, requestedSquadId: targetSquad?.id ?? null, kind: body.matchType === 'COMPETITIVE' ? 'COMPETITIVE' : 'FRIENDLY',
    revision: 1, ageGroup: m.ageGroup || squad.ageGroup, format: m.format || '11_A_SIDE', created: new Date(),
    history: [{ id: W.newId(), action: target ? 'CHALLENGE_SENT' : 'PUBLISHED', created_at: iso(new Date()), reason: null }],
  };
  // A referee invited now waits for their answer; asking referees nearby opens a request they apply to.
  if (invited) {
    rec.refereeId = invited.user_id; rec.refereeInvite = { id: W.newId(), status: 'INVITED', duty: 'REFEREE', volunteer: Boolean(body.volunteer), fee: body.volunteer ? null : fee, currency: body.currency || invited.currency };
    rec.history.push({ id: W.newId(), action: 'REFEREE_INVITED', created_at: iso(new Date()), reason: null });
  }
  F.exchange.push(rec);
  if (body.officialMode === 'OPEN') F.officialRequests.set(rec.id, { volunteer: Boolean(body.volunteer), fee, currency: body.currency || 'GEL', revision: 1, status: 'OPEN', applications: [] });
  if (m.requestId) seen.set(m.requestId, { id: rec.id, fingerprint });
  if (target) requestFor(rec, 'OUTGOING');
  return reply(201, F.listingView(rec, { detail: true }));
});

const seed = rec => { rec.end = F.plusMin(rec.start, rec.minutes); delete rec.minutes; rec.history.push({ id: W.newId(), action: 'CHALLENGE_SENT', created_at: iso(rec.created), reason: null }); F.exchange.push(rec); return rec; };
const base = { proposals: [], bookingId: null, refereeId: null, opponentSquadId: null, status: 'OPEN', score: null, kind: 'FRIENDLY', revision: 1, externalRefereeName: null, history: [] };

// Match invitations travel through Requests like other decisions: incoming ones need an answer.
const fmt = d => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: F.TZ }).format(d);
const requestFor = (rec, direction) => {
  const host = W.clubById(F.sq(rec.hostSquadId).clubId), invited = W.clubById(rec.requestedClubId);
  S.requestItems.push({ key: `MATCH_INVITATION:${rec.id}`, family: 'MATCH_INVITATION', id: rec.id, title: `Match invitation · ${rec.title}`,
    context: direction === 'INCOMING' ? `${host.name} · ${fmt(rec.start)}` : `Sent to ${invited.name} · ${fmt(rec.start)}`, status: 'PENDING', direction,
    actionable: direction === 'INCOMING', updatedAt: iso(rec.created), destination: `/match-exchange/${rec.id}`, actionLabel: direction === 'INCOMING' ? 'Answer invitation' : 'Open request' });
};

// An invitation waiting for Luka: Locomotive's U14 coach would like to play Dinamo U14 Boys.
const locoU14 = F.squadFor(5, 'U14', 'MALE');
const incoming = seed({
  ...base, id: W.newId(), hostSquadId: locoU14.id, start: F.at(F.nextDow(0, 8), 11), minutes: 80, venueId: 203, place: null,
  title: 'U14 friendly: Locomotive v Dinamo', description: 'Two halves of 35 minutes on the main pitch. We provide the referee and match balls. Changing rooms open from 10:00.',
  level: 'COMPETITIVE', venuePreference: 'HOME', hostingChoice: 'HOME', refereeRequired: true, refereeResponsibility: 'HOST',
  requestedClubId: F.DINAMO, requestedSquadId: 103, ageGroup: 'U14', format: '9_A_SIDE', created: W.day(-1, 18, 40),
});

requestFor(incoming, 'INCOMING');

// One Luka sent: Dinamo U16 Boys invited Batumi Seaside to Digomi; Batumi has not answered yet.
const sent = seed({
  ...base, id: W.newId(), hostSquadId: 105, start: F.at(F.nextDow(6, 9), 15), minutes: 95, venueId: 202, place: null,
  title: 'U16 Boys v Batumi Seaside', description: 'Happy to play 3 × 30 minutes if you bring a big squad. Kit: we wear white.',
  level: 'COMPETITIVE', venuePreference: 'HOME', hostingChoice: 'HOME', refereeRequired: true, refereeResponsibility: 'HOST',
  requestedClubId: 12, requestedSquadId: F.squadFor(12, 'U16', 'MALE').id, ageGroup: 'U16', format: '11_A_SIDE', created: W.day(-2, 20, 5),
});
requestFor(sent, 'OUTGOING');
