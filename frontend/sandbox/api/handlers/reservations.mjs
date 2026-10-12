// Synthetic API: using a pitch reservation for a match, as the backend's MatchArrangementController does.
//
// GET  /match-arrangements/bookings?squadId     the viewer's coming reservations and those shared with the squad's club
// POST /match-arrangements/bookings/:id/allocate { clubId }   the booker shares one with a club where they are staff
// POST /match-arrangements/:id/ground-preview   { bookingId, revision, requestId }   the host previews moving the match
// POST /match-arrangements/:id/ground           same body, with X-Match-Impact-Token  and moves it there
//
// Linking a reservation at the match's own ground is POST /match-exchange/:id/venue (football.mjs).
import { get, post, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';

const { iso, venueById } = W;
const { DINAMO, TZ } = F;
const notFound = () => reply(404, { status: 404, message: 'Not found' });
const conflict = message => reply(409, { status: 409, message });
const bad = message => reply(400, { status: 400, message });

/** One reservation as the arranging screens read it, with the matches already using it. */
const reservationView = b => {
  const v = venueById(b.venueId), p = F.pitchById(b.pitchId);
  return {
    id: b.id, venueId: v.id, venueName: v.name, pitchId: p.id, pitchName: p.name, format: p.format, startsAt: iso(b.start), endsAt: iso(b.end), timezone: TZ,
    totalPrice: b.totalPrice, currency: 'GEL', status: b.status, allocatedClubId: b.allocatedClubId ?? null, canAllocate: b.userId === W.ME_ID,
    city: v.city, addressText: `${v.district}, ${v.city}`, latitude: v.lat, longitude: v.lng,
    allocations: F.exchange.filter(l => l.bookingId === b.id).map(l => ({ eventId: l.id, startsAt: iso(l.start), endsAt: iso(l.end) })),
  };
};
const usable = b => (b.userId === W.ME_ID || b.allocatedClubId === DINAMO) && b.status !== 'CANCELLED' && b.end.getTime() > Date.now();

get('/match-arrangements/bookings', ({ query }) => {
  const squad = F.sq(Number(query.get('squadId')));
  if (!squad) return notFound();
  if (squad.clubId !== DINAMO) return reply(403, { status: 403, message: 'Only staff of this squad can see its reservations.' });
  return F.bookings.filter(usable).sort((a, b) => a.start - b.start).map(reservationView);
});

post('/match-arrangements/bookings/:id/allocate', ({ params, body }) => {
  const b = F.bookingById(params.id);
  if (!b || b.userId !== W.ME_ID) return reply(403, { status: 403, message: 'Only the person who booked it can share a reservation.' });
  if (b.status !== 'CONFIRMED' || b.start.getTime() <= Date.now()) return bad('Only a confirmed reservation still to come can be shared.');
  if (Number(body?.clubId) !== DINAMO) return reply(403, { status: 403, message: 'You can share a reservation only with a club where you are match staff.' });
  if (b.allocatedClubId && b.allocatedClubId !== DINAMO) return conflict('This reservation is already shared with another club.');
  b.allocatedClubId = DINAMO;
  return reply(204);
});

/** Whether the host may move this match to the reservation's ground, and why not. */
const moveIssue = (l, b) => {
  if (!F.listingView(l).can_manage) return reply(403, { status: 403, message: 'Only the host can change the ground.' });
  if (!b || !usable(b)) return reply(404, { status: 404, message: 'That reservation is not yours to use.' });
  if (b.status !== 'CONFIRMED') return bad('Only a confirmed reservation can move the match.');
  if (b.start > l.start || b.end < l.end) return bad('The reservation does not cover the whole match.');
  if (F.exchange.some(other => other !== l && other.bookingId === b.id && other.start < l.end && other.end > l.start)) return conflict('The reservation is already used by an overlapping match.');
  return null;
};
const impactOf = (l, b) => ({
  action: 'REVISE', revision: l.revision, material: true, changedFields: ['venueId', 'locationName', 'city'], dependencies: [], needsAttention: [],
  confirmationRequired: Boolean(l.opponentSquadId), confirmationToken: `ground-${l.id}-${b.id}-${l.revision}`,
});

post('/match-arrangements/:id/ground-preview', ({ params, body }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  if (Number(body?.revision) !== l.revision) return conflict('Listing changed. Reload and review its current arrangements.');
  const b = F.bookingById(body?.bookingId);
  return moveIssue(l, b) ?? impactOf(l, b);
});

post('/match-arrangements/:id/ground', ({ params, body, headers }) => {
  const l = F.listingById(params.id); if (!l) return notFound();
  if (Number(body?.revision) !== l.revision) return conflict('Listing changed. Reload and review its current arrangements.');
  const b = F.bookingById(body?.bookingId);
  const issue = moveIssue(l, b); if (issue) return issue;
  const impact = impactOf(l, b);
  if (impact.confirmationRequired && headers?.['x-match-impact-token'] !== impact.confirmationToken)
    return reply(409, { status: 409, code: 'MATCH_CHANGE_NEEDS_ATTENTION', message: 'The other club is told about the new ground. Review the change first.', impact });
  l.venueId = b.venueId; l.place = null; l.bookingId = b.id; l.externalConfirmed = false; l.revision++;
  l.history.push({ id: W.newId(), action: 'GROUND_CHANGED', created_at: iso(new Date()), reason: 'Moved to a reserved ground' });
  return reply(204);
});

// Reservations of Luka's to judge every case against Dinamo's coming matches: one at the ground of the U16 Boys' away
// match covering it (link), a full pitch at Gldani covering the U16 Girls' open match (move it there, and shareable),
// one the venue has not confirmed, one of the wrong format, and one too short.
const byTitle = title => F.exchange.find(l => l.title === title);
const awayU16 = byTitle('U16 Boys away friendly at Saburtalo'), girls = byTitle('U16 Girls looking for a friendly before the Black Sea Cup');
const pitchAt = (venueId, format) => venueById(venueId).pitchList.find(p => p.active && (!format || p.format === format));
const luka = (venueId, pitch, start, minutes, status = 'CONFIRMED', note = '') => F.addBooking({ venueId, pitchId: pitch.id, start, minutes, status, contactName: W.me.fullName, note, userId: W.ME_ID });
if (awayU16) luka(awayU16.venueId, pitchAt(awayU16.venueId, '11_A_SIDE') ?? pitchAt(awayU16.venueId), F.plusMin(awayU16.start, -30), 150, 'CONFIRMED', 'U16 Boys at Saburtalo');
if (girls) {
  luka(206, pitchAt(206, '11_A_SIDE'), F.plusMin(girls.start, -30), 150, 'CONFIRMED', 'U16 Girls friendly, full pitch');
  luka(206, pitchAt(206, '11_A_SIDE'), F.plusMin(girls.start, -60), 180, 'PENDING', 'Back-up hold for the U16 Girls');
  luka(205, pitchAt(205, '7_A_SIDE'), girls.start, 90, 'CONFIRMED', 'Small-sided session');
  luka(211, pitchAt(211), F.plusMin(girls.start, 30), 30, 'CONFIRMED', 'Warm-up slot');
}

