// Synthetic API: World map and journeys. Journey data and behaviour the planner needs that
// the shared fixtures lack. Imported last, so it only adds routes nobody else registers.
//
// BACKEND NEEDED — journey draft fields (PUT /map/plans/:id, POST /map/plans)
//   draft.staff: number[]      club staff user ids travelling with the squad
//   draft.vehicles: { key, label (≤ 80), driver (≤ 80), seats (1–80) }[]
//   draft.bring: string[]      what to bring, ≤ 30 items of ≤ 120 characters each
//   Stored and versioned with the rest of the draft. `bring` is copied into the published
//   family itinerary (itinerary.bring); staff and vehicles stay with staff.
// BACKEND NEEDED — GET /map/plans/:id → `published`: the family itinerary as last published
//   (the shape families get from GET /map/plans/family `itinerary`), so the editor can show
//   what changed since families last saw it. Absent before the first publish.
// BACKEND NEEDED — POST /journeys/from-fixture { eventId, clubId, squadId, preferences }
//   drafts the stops from the fixture and the squad's travel preferences: meet (kickoff −
//   arrival − travel − loading), travel, arrive and warm up, the match at the fixture venue,
//   and the return (end + recovery, then travel). Reopening for the same fixture and squad
//   returns its existing draft instead of creating another.
import { post, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import { planningScope, viewPlan, rememberPublication } from './map-planning-access.mjs';
import { planningFixture } from './map-planning-context.mjs';

const { DINAMO, TZ, plusMin, hash } = F;
const ACADEMY = { name: 'Dinamo Academy Training Centre', address: 'Digomi, Tbilisi', latitude: 41.7631, longitude: 44.7712 };
const replyFor = (planId, subjectId) => F.planReplies.get(`${planId}:${subjectId}`) || (() => { const h = hash(`${planId}:${subjectId}`) % 10; return h < 6 ? 'GOING' : h < 8 ? 'PENDING' : 'NOT_GOING'; })();

// ---------------------------------------------------------------- U16 Boys away at Telavi on Saturday
{
  const offset = ((6 - W.NOW.getDay() + 7) % 7) || 7;
  const start = W.day(offset, 13), venue = W.venueById(212), opponent = W.clubById(13);
  const m = { id: W.newId(), type: 'MATCH', kind: 'LEAGUE', clubId: DINAMO, squadId: 105, opponentClubId: opponent.id, opponentName: opponent.name, home: false, start, end: plusMin(start, 105), venueId: venue.id, status: 'SCHEDULED', score: null, refereeId: W.referees[0]?.id ?? null, competition: 'GFF U16 Youth League' };
  W.matches.push(m);
  W.events.push({ ...m, title: `${opponent.name} vs FC Dinamo Tbilisi Academy`, eventType: 'MATCH' });
}

// ---------------------------------------------------------------- what families saw, and their replies
const itinerary = p => {
  const d = p.draft, place = key => d.places.find(x => x.key === key), shown = x => x && { name: x.name, address: x.address, latitude: x.latitude, longitude: x.longitude, photoUrl: x.photoUrl };
  return { title: d.title, timezone: d.timezone, startsAt: d.startsAt, endsAt: d.endsAt, destination: d.destination, meetingPoint: d.meetingPoint, collectionPoint: d.collectionPoint, supervisionContact: d.supervisionContact, message: d.familyMessage, bring: d.bring || [],
    locations: Object.fromEntries(['meeting', 'destination', 'collection'].map(r => [r, shown(place(`plan:${r}`))]).filter(([, v]) => v)),
    activities: d.activities.map(a => ({ title: a.title, kind: a.kind, startsAt: a.startsAt, endsAt: a.endsAt, place: shown(place(a.placeKey)) || null })), arrangements: d.arrangements.map(a => ({ title: a.title, kind: a.kind, place: '' })) };
};
export const snapshot = itinerary;
// Seeded plans show replies families gave already; a plan drafted here only shows replies made in the sandbox.
const withReplies = (p, seeded = true) => {
  const answer = id => seeded ? replyFor(p.id, id) : F.planReplies.get(`${p.id}:${id}`) || 'PENDING';
  Object.defineProperty(p, 'journeyResponses', { enumerable: true, configurable: true, get: () => !p.published_version ? [] : p.draft.participants
    .map(id => ({ id, response: answer(id) })).filter(r => r.response !== 'PENDING')
    .map(r => ({ subject_id: r.id, name: W.personById(r.id)?.fullName ?? 'Player', response: r.response, actor_id: W.parents.find(l => l.childId === r.id)?.parentId ?? r.id, updated_at: W.iso(W.day(-1, 19)) })) });
  Object.defineProperty(p, 'familyResponses', { enumerable: true, configurable: true, get: () => !p.published_version || !seeded ? [] : p.draft.participants
    .filter(id => W.parents.some(l => l.childId === id))
    .map(id => { const h = hash(`ack:${p.id}:${id}`) % 10; return { child_id: id, child_name: W.personById(id)?.fullName ?? 'Player', version: p.published_version, acknowledged_at: h < 7 ? W.iso(W.day(-1, 20)) : null, permission_status: h < 6 ? 'GRANTED' : 'PENDING' }; }) });
  return p;
};

{
  const [u16, u12, u14] = F.plans;
  u16.draft.staff = [W.ME_ID, 5010, 5007];
  u16.draft.vehicles = [{ key: 'vehicle:1', label: 'Hired minibus, 20 seats', driver: 'Tbilisi Coaches', seats: 20 }];
  u16.draft.bring = ['Match-day kit and both pairs of boots', 'Shin pads', 'Water bottle', 'A packed snack', 'ID card or passport'];
  u16.published = itinerary(u16);
  // One change since families last saw it: the pre-match meal moved 15 minutes later.
  const meal = u16.draft.activities.find(a => a.kind === 'MEAL');
  if (meal) { meal.startsAt = W.iso(plusMin(new Date(meal.startsAt), 15)); meal.endsAt = W.iso(plusMin(new Date(meal.endsAt), 15)); u16.revision = 6; }
  u12.draft.staff = [W.ME_ID, 5011];
  u12.draft.bring = ['Sun cream', 'Water bottle', 'Two shirts', 'Packed lunch'];
  u12.published = itinerary(u12);
  u14.draft.staff = [W.ME_ID, 5002, 5007, 5011];
  u14.draft.vehicles = [{ key: 'vehicle:1', label: 'Coach, 49 seats', driver: 'Kutaisi Tours', seats: 49 }];
  F.plans.forEach(plan => { withReplies(plan); rememberPublication(plan); });
}

// ---------------------------------------------------------------- drafting a journey from a fixture
post('/journeys/from-fixture', ({ body, headers }) => {
  const squad = W.squadById(body?.squadId), scope = planningScope(body?.clubId, headers);
  if (!squad || squad.clubId !== Number(body?.clubId) || !scope.write(squad.id)) return reply(403, { status: 403, message: 'This fixture is outside your current planning responsibilities.' });
  const m = planningFixture(scope, body?.eventId, squad.id);
  if (!m) return reply(404, { status: 404, message: 'This fixture is not assigned to your squad.' });
  if (m.status !== 'SCHEDULED') return reply(409, { status: 409, message: 'Only coming fixtures can be planned.' });
  const existing = F.plans.find(p => p.club_id === scope.clubId && p.squad_id === squad.id && p.draft.activities.some(a => a.eventId === m.id));
  if (existing) return viewPlan(existing, headers);
  const kickoff = new Date(m.start).getTime();
  if (!Number.isFinite(kickoff) || kickoff <= Date.now()) return reply(409, { status: 409, message: 'This fixture has already started.' });
  const ours = W.clubById(scope.clubId), homeVenue = W.venueById(ours.venueId);
  const base = scope.clubId === DINAMO ? ACADEMY : homeVenue ? { name: homeVenue.name, address: `${homeVenue.district}, ${homeVenue.city}`, latitude: homeVenue.lat, longitude: homeVenue.lng } : null;
  const prefs = { mode: 'TRAVEL_TOGETHER', meetingPoint: base?.name ?? '', latitude: null, longitude: null, travelMinutes: null, arrivalMinutes: 45, loadingMinutes: 10, recoveryMinutes: 20, transportMinor: 0, mealPerPlayerMinor: 0, budgetMinor: 0, supervisionContact: '', ...(body?.preferences || {}) };
  const together = prefs.mode !== 'MEET_AT_VENUE';
  const venue = W.venueById(m.venueId), opponent = W.clubById(m.opponentClubId);
  if (!venue) return reply(400, { status: 400, message: 'Agree the match ground before drafting this journey.' });
  const meetAt = { name: prefs.meetingPoint || base?.name || '', address: base?.address ?? '', latitude: prefs.latitude ?? base?.latitude, longitude: prefs.longitude ?? base?.longitude };
  if (together && (!meetAt.name || (!Number.isFinite(meetAt.latitude) || !Number.isFinite(meetAt.longitude)) && !Number(prefs.travelMinutes))) return reply(400, { status: 400, message: 'Add a meeting point and travel-time estimate first.' });
  const travel = Math.max(5, Number(prefs.travelMinutes) || Math.round(F.kmBetween(meetAt.latitude, meetAt.longitude, venue.lat, venue.lng) * 1.3 + 15));
  const arrive = plusMin(m.start, -Number(prefs.arrivalMinutes || 0)), depart = plusMin(arrive, -travel), meet = plusMin(depart, -Number(prefs.loadingMinutes || 0));
  const leave = plusMin(m.end, Number(prefs.recoveryMinutes || 0)), home = plusMin(leave, travel);
  const ground = { key: 'plan:destination', name: venue.name, address: `${venue.district}, ${venue.city}`, latitude: venue.lat, longitude: venue.lng, type: 'STADIUM', entityId: venue.id, notes: '', photoUrl: null };
  const meeting = { key: 'plan:meeting', ...meetAt, type: 'MANUAL', entityId: null, notes: '', photoUrl: null };
  const title = m.title ?? (m.home ? `${ours.name} v ${opponent?.name ?? 'Opponent to agree'}` : `${opponent?.name ?? 'Opponent to agree'} v ${ours.name}`);
  const activities = [
    ...(together ? [{ key: 'activity:travel-out', title: `Travel to ${venue.city}`, kind: 'TRAVEL', startsAt: W.iso(depart), endsAt: W.iso(arrive), placeKey: null, eventId: null, sessionId: null, notes: '' }] : []),
    { key: 'activity:warm-up', title: 'Arrive and warm up', kind: 'ACTIVITY', startsAt: W.iso(arrive), endsAt: W.iso(m.start), placeKey: 'plan:destination', eventId: null, sessionId: null, notes: '' },
    { key: 'activity:match', title, kind: 'MATCH', startsAt: W.iso(m.start), endsAt: W.iso(m.end), placeKey: 'plan:destination', eventId: m.id, sessionId: null, notes: '' },
    ...(together ? [{ key: 'activity:travel-home', title: 'Travel home', kind: 'TRAVEL', startsAt: W.iso(leave), endsAt: W.iso(home), placeKey: null, eventId: null, sessionId: null, notes: '' }] : []),
  ];
  const draft = { title: `${squad.name} away at ${venue.city}`, timezone: TZ, currency: 'GEL', budgetMinor: Number(prefs.budgetMinor) || 0,
    startsAt: W.iso(together ? meet : arrive), endsAt: W.iso(together ? home : m.end), destination: venue.name, meetingPoint: together ? meetAt.name : venue.name, collectionPoint: together ? meetAt.name : venue.name,
    supervisionContact: prefs.supervisionContact || '', familyMessage: '', privateNotes: '', participants: squad.playerIds.slice(0, 18), staff: [scope.actor], vehicles: [], bring: [],
    places: together ? [meeting, ground, { ...meeting, key: 'plan:collection' }] : [ground],
    activities,
    arrangements: Number(prefs.transportMinor) ? [{ key: 'arr:transport', kind: 'TRANSPORT', title: 'Transport', placeKey: null, amountMinor: Number(prefs.transportMinor), notes: '', financeRecordId: null }] : [] };
  const p = withReplies({ id: W.newId(), club_id: scope.clubId, squad_id: squad.id, title: draft.title, revision: 1, published_version: 0, published_revision: null, updated_at: W.iso(new Date()), starts_at: draft.startsAt, created_by: scope.actor, last_editor: scope.actor, draft,
    suppliers: {}, totalMinor: draft.arrangements.reduce((n, a) => n + a.amountMinor, 0), budgetApproved: false, approvedBy: null, rights: { edit: true, travel: true, finance: true, publish: true, leadership: true }, issues: [], history: [],
    playerResponses: [], trip_id: null, trip: null, passengers: [], linkedSchedule: [] }, false);
  F.plans.push(p);
  return reply(201, viewPlan(p, headers));
});
