// Synthetic API: profiles, professions and opt-out attendance. Imported last, so it only adds
// routes nobody else registers. Shared state lives in ../world-profile.mjs.
//
// BACKEND NEEDED — professions, the second layer of a person's profile (separate from football
// roles and from club permissions):
//   GET  /users/{id}/professions → Profession[]  (published entries only, unless it is your own profile)
//   PUT  /users/me/professions   { professions: ProfessionInput[] } → Profession[]  (replaces the list; ≤ 10)
//   Profession = { id, title (free text ≤ 80), label (searchable label set by admins or Dola, null until mapped),
//                  detail (≤ 600) | null, since ('YYYY') | null, published, verification: 'SELF_REPORTED' |
//                  'CLUB_CONFIRMED' | 'DOCUMENT_CHECKED', verifiedBy (organization name) | null }
//   ProfessionInput = { id?, title, detail, since, published }. Verification and label are never accepted from the
//   client; editing a confirmed entry's title returns it to SELF_REPORTED. Feeds the People directory and opportunity matching.
// BACKEND NEEDED — opt-out attendance on squad sessions:
//   * Training does not ask for replies by default (response_requested=false); matches and trips do. A coach turns
//     confirmation on or off per event with PUT /squad-communication/{squad}/sessions/{id} { requestResponses } after
//     the usual preview (POST …/preview), which notifies families only when confirmation is turned on.
//   * PUT …/sessions/{id}/attendance accepts NOT_GOING (and GOING to undo) even when no reply was requested, plus an
//     optional `reason` (≤ 140 characters) stored with NOT_GOING and shown only to the squad's coaches as attendance[].reason.
//   * GET /squad-communication/{squad} attention.replies_needed counts only unanswered players on events that ask for
//     confirmation (and reconfirmations), so a coach is never chased for training nobody was asked to confirm.
import { get, post, put, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as S from '../world-social.mjs';
import * as P from '../world-profile.mjs';

const ME = W.ME_ID;
const notFound = (message = 'Not found.') => reply(404, { status: 404, message });
const badRequest = message => reply(400, { status: 400, message });

// ---------------------------------------------------------------- professions
const visible = (userId, viewer) => (P.professions.get(userId) ?? []).filter(item => userId === viewer || item.published);
get('/users/:id/professions', ({ params }) => {
  const id = params.id === 'me' ? ME : Number(params.id);
  if (!Number.isSafeInteger(id) || !W.people.some(p => p.id === id)) return notFound('Profile not found.');
  return visible(id, ME);
});
put('/users/me/professions', ({ body }) => {
  const input = Array.isArray(body?.professions) ? body.professions : null;
  if (!input) return badRequest('Send the list of professions.');
  if (input.length > 10) return badRequest('Add up to 10 professions.');
  const current = P.professions.get(ME) ?? [];
  const next = [];
  for (const raw of input) {
    const title = String(raw?.title ?? '').trim().slice(0, 80);
    if (!title) return badRequest('Each profession needs a name.');
    const previous = current.find(item => item.id === raw?.id);
    const sameTitle = previous && previous.title === title;
    next.push({
      id: previous?.id ?? P.newProfessionId(), title, label: sameTitle ? previous.label : P.labelFor(title),
      detail: String(raw?.detail ?? '').trim().slice(0, 600) || null,
      since: /^\d{4}$/.test(String(raw?.since ?? '')) ? String(raw.since) : null,
      published: raw?.published !== false,
      verification: sameTitle ? previous.verification : 'SELF_REPORTED', verifiedBy: sameTitle ? previous.verifiedBy : null,
    });
  }
  P.professions.set(ME, next);
  return next;
});

// ---------------------------------------------------------------- squad sessions: ask for confirmation
const squadFor = id => { const s = W.squadById(Number(id)); return s && s.clubId === 1 ? s : null; };
const sessionFor = (s, sid) => W.events.find(e => e.squadId === s.id && e.id === Number(sid) && (e.type === 'TRAINING' || e.type === 'MATCH'));
const moved = (e, body) => {
  const start = body?.startsAt ? new Date(body.startsAt) : null, end = body?.endsAt ? new Date(body.endsAt) : null;
  return start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && (start.getTime() !== e.start.getTime() || end.getTime() !== e.end.getTime()) ? { start, end } : null;
};
const consequence = (s, e, body) => {
  const asking = body?.requestResponses === true && !P.confirmationRequested(e), move = moved(e, body);
  const otherDay = move && move.start.toDateString() !== e.start.toDateString();
  return { revision: e.revision ?? 1, material: asking || Boolean(move), responsePolicy: otherDay ? 'RECONFIRM' : 'PRESERVE', affectedParticipants: s.playerIds.length, affectedResponses: otherDay ? s.playerIds.length : 0,
    addedParticipants: 0, removedParticipants: 0, notificationRecipients: asking || move ? S.familiesOf(s.id).length : 0 };
};
post('/squad-communication/:id/sessions/:sid/preview', ({ params, body }) => {
  const s = squadFor(params.id); if (!s) return reply(403, { status: 403, message: 'This squad space is not available to you.' });
  const e = sessionFor(s, params.sid); if (!e) return notFound('Session not found.');
  if (body?.revision != null && body.revision !== (e.revision ?? 1)) return reply(409, { status: 409, message: 'This session changed. Reload it and try again.' });
  return consequence(s, e, body);
});
put('/squad-communication/:id/sessions/:sid', ({ params, body }) => {
  const s = squadFor(params.id); if (!s) return reply(403, { status: 403, message: 'This squad space is not available to you.' });
  const e = sessionFor(s, params.sid); if (!e) return notFound('Session not found.');
  if (body?.revision != null && body.revision !== (e.revision ?? 1)) return reply(409, { status: 409, message: 'This session changed. Reload it and try again.' });
  if (typeof body?.requestResponses === 'boolean') P.confirmation.set(e.id, body.requestResponses);
  if (body?.title) e.title = String(body.title).slice(0, 140);
  const move = moved(e, body);
  if (move) { e.start = move.start; e.end = move.end; }
  e.revision = (e.revision ?? 1) + 1;
  return { id: e.id, revision: e.revision };
});
// A weekly series moved from one session: the same shift applies to that session and the later ones (or all future ones).
const seriesTargets = (s, e, scope) => W.events.filter(x => x.squadId === s.id && x.type === e.type && x.type === 'TRAINING' && x.start >= (scope === 'ALL_FUTURE' ? W.NOW : e.start)).sort((a, b) => a.start - b.start);
const seriesPreview = (s, e, body) => {
  const targets = body?.scope === 'THIS' ? [e] : seriesTargets(s, e, body?.scope);
  return { expected: targets.map(x => ({ id: x.id, revision: x.revision ?? 1 })), eventCount: targets.length, notificationDeliveries: targets.length * S.familiesOf(s.id).length, affectedResponses: 0, dates: targets.map(x => W.local(x.start)) };
};
post('/squad-communication/:id/events/:sid/changes/preview', ({ params, body }) => {
  const s = squadFor(params.id); if (!s) return reply(403, { status: 403, message: 'This squad space is not available to you.' });
  const e = sessionFor(s, params.sid); if (!e) return notFound('Session not found.');
  return seriesPreview(s, e, body);
});
post('/squad-communication/:id/events/:sid/changes', ({ params, body }) => {
  const s = squadFor(params.id); if (!s) return reply(403, { status: 403, message: 'This squad space is not available to you.' });
  const e = sessionFor(s, params.sid); if (!e) return notFound('Session not found.');
  const move = moved(e, body?.change);
  if (move) {
    const shift = move.start.getTime() - e.start.getTime(), length = move.end.getTime() - move.start.getTime();
    for (const x of body?.scope === 'THIS' ? [e] : seriesTargets(s, e, body?.scope)) { x.start = new Date(x.start.getTime() + shift); x.end = new Date(x.start.getTime() + length); x.revision = (x.revision ?? 1) + 1; }
  }
  return seriesPreview(s, e, body);
});

// ---------------------------------------------------------------- organization profiles (public view)
// Two independent organizations so the shared profile layout can be checked: a league organizer and a sports clinic.
const capabilitiesFor = activities => ({ enabledActivities: ['PROFILE', ...activities], revision: 1, venueAvailable: false, canConfigureActivities: false, canEditProfile: false,
  canConfigureVenue: false, canManageVenueBookings: false, canCreateTournament: false, canInviteVenueOperator: false });
const ORGS = {
  41: { id: 41, displayName: 'Tbilisi Youth League', description: 'Weekend leagues for U10 to U16 squads across Tbilisi, run by volunteers since 2011.', kinds: ['TOURNAMENT_ORGANIZER'], profileKind: 'TOURNAMENT_ORGANIZER',
    clubId: null, verificationStatus: 'VERIFIED', published: true, website: 'https://example.org/league', publicEmail: 'league@example.org', publicPhone: '+995 32 200 11 22', addressText: 'Saburtalo, Tbilisi',
    focus: 'Autumn and spring league seasons, a summer festival and a referee mentoring programme.', canEdit: false, canCreateTournament: false, capabilities: capabilitiesFor(['TOURNAMENT']) },
  42: { id: 42, displayName: 'Vake Sports Clinic', description: 'Physiotherapy, sports medicine and return-to-play plans for young players.', kinds: ['HEALTHCARE'], profileKind: 'HEALTHCARE',
    clubId: null, verificationStatus: 'UNVERIFIED', published: true, website: null, publicEmail: 'clinic@example.org', publicPhone: null, addressText: 'Vake, Tbilisi',
    focus: 'Injury assessment within 48 hours, physiotherapy blocks and a sports psychologist on Thursdays.', canEdit: false, canCreateTournament: false, capabilities: capabilitiesFor([]) },
};
get('/organizations/:id/presentation', ({ params }) => {
  const org = ORGS[Number(params.id)];
  if (!org) return undefined;
  return { profile: org, branding: { revision: 1 }, portfolio: { venues: [] }, canOpenWorkspace: false, membershipRole: '',
    competitions: org.profileKind === 'TOURNAMENT_ORGANIZER' ? [{ id: 801, name: 'Tbilisi Youth League · Autumn 2026', status: 'IN_PROGRESS' }, { id: 802, name: 'Summer Festival 2026', status: 'COMPLETED' }] : [] };
});
