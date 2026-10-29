// Synthetic API for My squads, step 3 (owner, 29 October 2026): one page for everyone on a squad. Shapes from the
// backend (SquadMatchCardService, RecruitmentService.waiting, SquadHelperService, SquadStaffRoomService) and the web's
// features/clubWorkspace/coachHub/squadApi.ts and features/helpers/api.ts:
//   GET  /squad-communication/:id/next-match                 the next match card, its buttons by the persona's tools
//   POST /match-arrangements/:id/squads/:sid/remind            remind unanswered call-ups (409 REMINDED_RECENTLY)
//   POST /squad-communication/:id/staff-room                  the squad's staff room in the chats
//   GET  /recruitment/applications/waiting?clubId&squadId      Want to join, the applications this person decides
//   POST /recruitment/applications/:id/decline | /offer         Not now | Invite to a trial (409 ALREADY_ANSWERED)
//   GET|POST /squad-communication/:sid/sessions/:eid/helpers  DELETE /squad-communication/:sid/helpers/:hid
//   GET  /me/helping   GET|PUT /me/helping/sessions/:eid/register (409 REGISTER_CHANGED)   DELETE /me/helping/:hid
//   GET  /clubs/:id/helpers   DELETE /clubs/:id/helpers/:hid    (admins, in Staff)
// Personas narrow the squad space (team managers read without coaching; kit and helpers see no squad). See
// ../world-my-squads.mjs.
import { get, post, put, del, reply, handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as F from '../world-football.mjs';
import * as S from '../world-social.mjs';
import * as V from '../viewer.mjs';
import * as M from '../world-my-squads.mjs';

const missing = () => reply(404, { status: 404, message: 'Squad space is unavailable or your membership has changed.' });
const denied = message => reply(403, { status: 403, message });
const persona = headers => V.isNewcomer(headers) ? 'newcomer' : V.personaOf(headers);
const roleIn = (headers, squad) => { const roles = M.squadRoles(persona(headers)); return roles === undefined ? undefined : roles.get(Number(squad)) ?? null; };
const dinamoSquad = id => { const s = W.squadById(Number(id)); return s && s.clubId === C.CLUB_ID ? s : null; };
const PASS = 'x-sandbox-my-squads-pass';
const passOn = async req => (await handleApi({ ...req, headers: { ...req.headers, [PASS]: '1' } }))?.body;

// ---------------------------------------------------------------- the squad space, as the persona's job reads it
get('/squad-communication', async req => {
  if (req.headers[PASS] || !M.STEP3_PERSONAS.includes(persona(req.headers))) return undefined;
  const on = M.squadRoles(persona(req.headers));
  return ((await passOn(req)) ?? []).filter(space => on.has(space.id)).map(space => ({ ...space, can_manage: on.get(space.id) === 'COACH' }));
});
get('/squad-communication/:id', async req => {
  if (req.headers[PASS]) return undefined;
  const role = roleIn(req.headers, req.params.id);
  if (role === undefined || role === 'COACH') return undefined;
  if (role === null) return missing();
  // Staff on the squad who don't coach: the whole roster, no families' private messages, no coaching controls.
  const space = await passOn(req);
  return space && { ...space, can_manage: false, can_assign_coach: false, available_coaches: [], threads: [], attention: undefined };
});
for (const path of ['/squad-communication/:id/sessions', '/squad-communication/:id/messages'])
  get(path, req => roleIn(req.headers, req.params.id) === null ? missing() : undefined);
post('/squad-communication/:id/sessions', req => {
  const role = roleIn(req.headers, req.params.id);
  return role === null ? missing() : role === 'STAFF' ? denied('Only this squad’s coach or academy leadership can do that.') : undefined;
});
post('/squad-communication/:id/messages', req => {
  const role = roleIn(req.headers, req.params.id);
  if (role === null) return missing();
  return role === 'STAFF' && (req.body?.kind === 'ANNOUNCEMENT' || req.body?.threadUserId != null) ? denied('Only this squad’s coach or academy leadership can do that.') : undefined;
});
// The club's joining workspace is for those who decide joining somewhere, as on the server.
get('/clubs/:id/admissions', req => {
  const p = persona(req.headers);
  return M.STEP3_PERSONAS.includes(p) && !M.decidesJoining(p, null) ? denied('Only the squad’s head coach or assistant coach answers join requests.') : undefined;
});
get('/squad-communication/:id/join-requests', req => {
  const p = persona(req.headers);
  return M.STEP3_PERSONAS.includes(p) && !M.decidesJoining(p, Number(req.params.id)) ? denied('Only the squad’s head coach or assistant coach answers join requests.') : undefined;
});

// ---------------------------------------------------------------- the next match card
const preparationSeed = new Map([
  [5719, { referees: 'Confirmed: Giorgi Kapanadze', pitch: 'Saburtalo Training Ground, pitch 3', medical: '', bring: 'Away kit, white\nBibs\n6 balls\nFirst-aid bag\nPlayer cards' }],
  [5730, { referees: 'Confirmed: Levan Abashidze', pitch: 'Ramaz Shengelia Stadium, main pitch', medical: 'Nana Beridze (physio)', bring: 'Away kit, white\nBibs\nPlayer cards' }],
]);
for (const [event, data] of preparationSeed)
  if (!C.records.some(r => r.kind === 'MATCH_PREPARATION' && r.event_id === event)) {
    const squad = event === 5719 ? 103 : 105;
    C.records.push({ id: C.nextId(), club_id: C.CLUB_ID, module: 'READINESS', kind: 'MATCH_PREPARATION', title: `Match preparation · ${C.squadName(squad)}`, status: 'READY', squad_id: squad, subject_user_id: null, assigned_user_id: C.STAFF.teamManager, event_id: event, related_record_id: null, due_on: null,
      data: { ...data, checkedOn: C.date(0) }, created_by: C.STAFF.teamManager, updated_by: C.STAFF.teamManager, revision: 1, created_at: C.at(-2), updated_at: C.at(-1), session_id: null });
  }
const trips = new Map([[5719, { startsAt: C.at(2, 9, 30), meetingPoint: 'Academy gate', destination: 'Saburtalo Training Ground' }]]);
for (const [event, data] of trips)
  if (!C.records.some(r => r.kind === 'TRIP' && r.event_id === event))
    C.records.push({ id: C.nextId(), club_id: C.CLUB_ID, module: 'TRAVEL', kind: 'TRIP', title: 'Bus to Saburtalo', status: 'READY', squad_id: 103, subject_user_id: null, assigned_user_id: C.STAFF.teamManager, event_id: event, related_record_id: null, due_on: null,
      data: { ...data, endsAt: C.at(2, 15, 0), transport: 'Club minibus', responsibilities: 'Team manager', accommodation: '' }, created_by: C.STAFF.teamManager, updated_by: C.STAFF.teamManager, revision: 1, created_at: C.at(-3), updated_at: C.at(-3), session_id: null });

const reminders = new Map(); // `${event}:${squad}` -> Date
const upcomingFor = squad => F.exchange.filter(l => l.status === 'ARRANGED' && l.opponentSquadId && (l.hostSquadId === squad || l.opponentSquadId === squad) && new Date(l.end ?? l.start).getTime() > Date.now())
  .sort((a, b) => new Date(a.start) - new Date(b.start))[0] ?? null;
const lines = text => String(text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const fitnessOf = ids => {
  const states = new Map(ids.map(id => [id, 'FIT']));
  for (const r of C.records.filter(r => r.kind === 'RESTRICTION' && states.has(r.subject_user_id) && ['RESTRICTED', 'REVIEW_REQUIRED'].includes(r.status)))
    states.set(r.subject_user_id, r.status === 'RESTRICTED' || states.get(r.subject_user_id) === 'OUT' ? 'OUT' : 'DOUBTFUL');
  const count = state => [...states.values()].filter(value => value === state).length;
  return { fit: count('FIT'), doubtful: count('DOUBTFUL'), out: count('OUT'), players: [...states].map(([id, state]) => ({ id, state })) };
};
get('/squad-communication/:id/next-match', async ({ params, headers }) => {
  const squad = dinamoSquad(params.id), p = persona(headers);
  if (!squad || p === 'newcomer' || M.squadRoles(p) && !M.squadRoles(p).has(squad.id)) return missing();
  const l = upcomingFor(squad.id);
  if (!l) return { squadId: squad.id, squadName: squad.name, match: null };
  const teams = await handleApi({ method: 'GET', path: `/match-arrangements/${l.id}/participants`, query: new URLSearchParams(), body: null, headers });
  const players = teams?.body?.find(team => team.squadId === squad.id)?.players ?? [];
  const called = players.filter(player => player.selected);
  const prep = C.records.find(r => r.kind === 'MATCH_PREPARATION' && r.event_id === l.id && r.status !== 'CANCELLED');
  const trip = C.records.find(r => r.kind === 'TRIP' && r.event_id === l.id && r.status !== 'CANCELLED');
  return {
    squadId: squad.id, squadName: squad.name, match: F.listingView(l, { detail: true }),
    callUps: called, fitness: fitnessOf((called.length ? called : players).map(player => player.id)),
    preparation: prep ? { recordId: prep.id, status: prep.status, revision: prep.revision ?? 1, referees: prep.data.referees ?? null, pitch: prep.data.pitch ?? null, medical: prep.data.medical ?? null, bring: lines(prep.data.bring) } : null,
    trip: trip ? { recordId: trip.id, status: trip.status, departsAt: trip.data.startsAt ?? null, meetingPoint: trip.data.meetingPoint ?? null, destination: trip.data.destination ?? null } : null,
    lastReminder: reminders.get(`${l.id}:${squad.id}`)?.toISOString() ?? null,
    can: { callUps: M.can(p, squad.id, 'MATCHES'), remind: M.can(p, squad.id, 'MATCHES'), checklist: M.can(p, squad.id, 'READINESS'), bus: M.can(p, squad.id, 'TRAVEL') },
  };
});
post('/match-arrangements/:id/squads/:sid/remind', async ({ params, headers }) => {
  const squad = dinamoSquad(params.sid), l = F.listingById(params.id);
  if (!squad || !l) return missing();
  if (!M.can(persona(headers), squad.id, 'MATCHES')) return denied('You need match-management access for this squad.');
  const key = `${l.id}:${squad.id}`, last = reminders.get(key);
  if (last && Date.now() - last.getTime() < 2 * 3600e3) return reply(409, { status: 409, code: 'REMINDED_RECENTLY', message: 'Families were reminded less than two hours ago.' });
  const teams = await handleApi({ method: 'GET', path: `/match-arrangements/${l.id}/participants`, query: new URLSearchParams(), body: null, headers });
  const waiting = (teams?.body?.find(team => team.squadId === squad.id)?.players ?? []).filter(player => player.selected && player.response === 'UNANSWERED');
  reminders.set(key, new Date());
  return { reminded: waiting.length };
});

// ---------------------------------------------------------------- the staff room
const staffOf = squad => [...new Set([W.ME_ID, squad.headCoachId, C.STAFF.assistant, ...(squad.id === 105 ? [C.STAFF.teamManager] : []), ...(M.COACHED.includes(squad.id) ? [C.STAFF.goalkeeper] : [])].filter(Boolean))];
post('/squad-communication/:id/staff-room', ({ params, headers }) => {
  const squad = dinamoSquad(params.id), p = persona(headers);
  if (!squad || p === 'newcomer' || ['physio', 'attendance', 'member', 'analyst'].includes(p) || M.squadRoles(p) && !M.squadRoles(p).has(squad.id)) return reply(404, { status: 404, message: 'This staff room is for the squad’s staff.' });
  let room = S.conversations.find(c => c.contextType === 'SQUAD_STAFF' && c.contextId === squad.id);
  if (!room) {
    room = { id: Math.max(...S.conversations.map(c => c.id)) + 1, contextType: 'SQUAD_STAFF', name: squad.name, contextId: squad.id, members: staffOf(squad), creatorId: W.ME_ID, unread: new Map() };
    S.conversations.push(room);
    if (squad.id === 105) {
      const keeper = W.personById(squad.playerIds[0])?.firstName ?? 'Tornike', doubt = W.personById(squad.playerIds[4])?.firstName ?? 'Saba';
      for (const [sender, content, ago] of [[C.STAFF.teamManager, 'Bus confirmed for Saturday: 10:30 from the academy.', 190], [C.STAFF.goalkeeper, `${keeper} trained well today. He’s ready for Saturday.`, 75], [W.ME_ID, `Good. ${doubt} is doubtful, I’ll decide on Friday.`, 40]])
        S.chatMessages.push({ id: S.newMessageId(), conversationId: room.id, senderId: sender, content, createdAt: new Date(Date.now() - ago * 60e3) });
    }
  }
  return { conversationId: room.id, name: room.name };
});

// ---------------------------------------------------------------- Want to join: applications
const answered = new Map([[8103, { by: C.STAFF.assistant, at: C.at(-1, 11, 5) }]]);
if (C.applications.find(a => a.id === 8103)?.status === 'PENDING') C.applications.find(a => a.id === 8103).status = 'DECLINED';
const waitingView = a => ({ id: a.id, clubId: C.CLUB_ID, squadId: M.APPLICATION_SQUADS.get(a.id) ?? null, squadName: C.squadName(M.APPLICATION_SQUADS.get(a.id)) ?? null,
  status: a.status, createdAt: a.createdAt, position: a.position ?? null, ageGroup: a.ageGroup ?? null, applicantName: a.fullName ?? C.name(a.userId), age: a.age ?? null,
  answeredBy: answered.has(a.id) ? C.name(answered.get(a.id).by) : null, answeredAt: answered.get(a.id)?.at ?? null });
get('/recruitment/applications/waiting', ({ query, headers }) => {
  const p = persona(headers), squad = Number(query.get('squadId')) || null;
  if (Number(query.get('clubId')) !== C.CLUB_ID || p === 'newcomer') return [];
  const recent = a => a.status === 'PENDING' || answered.has(a.id) && Date.now() - new Date(answered.get(a.id).at).getTime() < 14 * 864e5;
  return C.applications.filter(a => a.role === 'PLAYER' && recent(a) && M.decidesJoining(p, M.APPLICATION_SQUADS.get(a.id) ?? null) && (!squad || M.APPLICATION_SQUADS.get(a.id) === squad))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(waitingView);
});
const answer = status => ({ params, headers }) => {
  const a = C.applications.find(item => item.id === Number(params.id) && item.role === 'PLAYER');
  if (!a) return reply(404, { status: 404, message: 'Application not found.' });
  if (!M.decidesJoining(persona(headers), M.APPLICATION_SQUADS.get(a.id) ?? null)) return denied('Player recruitment requires current authorized staff.');
  if (a.status !== 'PENDING') return reply(409, { status: 409, code: 'ALREADY_ANSWERED', message: `${answered.has(a.id) ? C.name(answered.get(a.id).by) : 'Someone'} already answered this application.` });
  a.status = status; answered.set(a.id, { by: W.ME_ID, at: new Date().toISOString() });
  return { id: a.id, status };
};
post('/recruitment/applications/:id/decline', answer('DECLINED'));
post('/recruitment/applications/:id/offer', answer('OFFERED'));

// ---------------------------------------------------------------- helpers
const U12 = 102;
const helpers = [{ id: 9701, clubId: C.CLUB_ID, squadId: U12, sessionKey: 'u12-wednesdays', repeating: true, userId: 9705, name: 'Dato Meladze', addedBy: W.squadById(U12).headCoachId, since: C.at(-12), active: true },
  // A parent who helps at U14 Boys' training every week: the squad's staff all see her there.
  { id: 9702, clubId: C.CLUB_ID, squadId: 103, repeating: true, userId: 9706, name: 'Nino Abashidze', addedBy: W.squadById(103).headCoachId, since: C.at(-5), active: true }];
// session id -> { revision, rows: Map(player id -> { status, by }) }: the attendance records of the session, the
// coaches' and the helper's alike, and a revision that changes with every saved change.
const registers = new Map();
const saves = new Map(); // `${helper}:${requestId}` -> session id, so a retried save saves nothing again
const registerOf = id => { if (!registers.has(id)) registers.set(id, { revision: 0, rows: new Map() }); return registers.get(id); };
/** Today's U12 Mixed session at 18:00, the one the helper persona helps at. */
const helperSession = () => {
  const start = new Date(); start.setHours(18, 0, 0, 0);
  return { id: 77002, squadId: U12, title: 'Training', start, end: new Date(start.getTime() + 90 * 60e3), location: 'Pitch 2' };
};
const sessionPlayers = session => {
  const squad = W.squadById(session.squadId), rows = registerOf(session.id).rows;
  return squad.playerIds.map((id, i) => ({ id, firstName: W.personById(id)?.firstName ?? 'Player', lastInitial: W.personById(id)?.lastName?.[0]?.toUpperCase() ?? null,
    response: i === 3 ? 'NOT_GOING' : i === 7 ? 'UNANSWERED' : 'GOING', register: rows.get(id)?.status ?? null }));
};
const registerView = session => ({ revision: registerOf(session.id).revision, players: sessionPlayers(session) });
// The head coach ticked the squad's first player in the coaches' register before the helper arrived.
{ const s = helperSession(); registerOf(s.id).rows.set(W.squadById(U12).playerIds[0], { status: 'ARRIVED', by: W.squadById(U12).headCoachId }); registerOf(s.id).revision = 1; }
// Everyone on the squad sees who helps; adding and removing follow the job.
get('/squad-communication/:sid/sessions/:eid/helpers', ({ params, headers }) => {
  if (roleIn(headers, params.sid) === null || persona(headers) === 'newcomer') return missing();
  // A repeating helper is on every session of the squad (the sandbox has no series); one date on that session only.
  return helpers.filter(h => h.active && h.squadId === Number(params.sid) && (h.repeating || h.sessionId === Number(params.eid)))
    .map(h => ({ id: h.id, name: h.name, repeating: h.repeating, since: h.since, waiting: Boolean(h.waiting) }));
});
post('/squad-communication/:sid/sessions/:eid/helpers', ({ params, headers, body }) => {
  if (!M.addsHelpers(persona(headers), Number(params.sid))) return denied('Only this squad’s head coach can add a helper.');
  const name = String(body?.name ?? '').trim(), email = String(body?.email ?? '').trim().toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(400, { status: 400, message: 'Enter their name and email.' });
  // A retry shows the same helper and the same link.
  const earlier = helpers.find(h => h.requestId && h.requestId === body?.requestId);
  if (earlier) return earlier.answer;
  // Synthetic: an address at invited.example already has an invitation waiting from a club, which stays as it is.
  const known = [...W.people].find(person => person.email === email), pending = !known && email.endsWith('@invited.example');
  const helper = { id: W.newId(), clubId: C.CLUB_ID, squadId: Number(params.sid), sessionId: body?.repeating ? null : Number(params.eid), repeating: Boolean(body?.repeating), userId: known?.id ?? W.newId(), name, addedBy: W.ME_ID, since: new Date().toISOString(), active: true, waiting: !known, requestId: body?.requestId ?? null };
  const fresh = !known && !pending;
  helper.answer = { id: helper.id, name, link: fresh ? `sandbox-helper-${helper.id}` : null, linkExpiresAt: fresh ? new Date(Date.now() + 7 * 864e5).toISOString() : null, invitationPending: pending };
  helpers.push(helper);
  return helper.answer;
});
del('/squad-communication/:sid/helpers/:hid', ({ params, headers }) => {
  if (!M.addsHelpers(persona(headers), Number(params.sid))) return denied('Only this squad’s head coach can add a helper.');
  const helper = helpers.find(h => h.id === Number(params.hid) && h.active && h.squadId === Number(params.sid));
  if (!helper) return reply(404, { status: 404, message: 'That helper was not found.' });
  helper.active = false; return reply(204);
});
get('/me/helping', ({ headers }) => {
  if (persona(headers) !== 'helper' || !helpers.some(h => h.id === 9701 && h.active)) return [];
  const s = helperSession(), squad = W.squadById(s.squadId);
  return [{ helperId: 9701, sessionId: s.id, squadId: s.squadId, squadName: squad.name, clubId: C.CLUB_ID, clubName: C.club.name, title: s.title, kind: 'TRAINING',
    startsAt: s.start.toISOString(), endsAt: s.end.toISOString(), location: s.location, coach: C.name(squad.headCoachId), registerOpen: true, registerRevision: registerOf(s.id).revision, players: sessionPlayers(s) }];
});
const helping = (params, headers) => { const s = helperSession(); return persona(headers) === 'helper' && Number(params.eid) === s.id ? s : null; };
get('/me/helping/sessions/:eid/register', ({ params, headers }) => {
  const s = helping(params, headers);
  return s ? registerView(s) : reply(404, { status: 404, message: 'The register opens on the day of the session you help at.' });
});
// As SquadHelperService.saveRegister: only what changed is written, a coach's Arrived is never taken back, a save made
// on an older register is refused, and a retry of a save that went through saves nothing again.
put('/me/helping/sessions/:eid/register', ({ params, headers, body }) => {
  const s = helping(params, headers);
  if (!s) return reply(404, { status: 404, message: 'The register opens on the day of the session you help at.' });
  const key = `${V.viewerId(headers)}:${body?.requestId}`, register = registerOf(s.id);
  if (saves.has(key)) return registerView(s);
  if (Number(body?.revision) !== register.revision) return reply(409, { status: 409, code: 'REGISTER_CHANGED', message: 'The register changed since you opened it. Check it and save again.' });
  const ids = new Set(sessionPlayers(s).map(player => player.id)), came = new Set((body?.came ?? []).map(Number));
  if ([...came].some(id => !ids.has(id))) return reply(400, { status: 400, message: 'Choose players of this session.' });
  saves.set(key, s.id);
  const me = V.viewerId(headers);
  for (const id of ids) {
    const next = came.has(id) ? 'ARRIVED' : 'ABSENT', now = register.rows.get(id);
    if (now?.status === next || now?.status === 'ARRIVED' && now.by !== me) continue;
    register.rows.set(id, { status: next, by: me }); register.revision += 1;
  }
  return registerView(s);
});
del('/me/helping/:hid', ({ params }) => { const helper = helpers.find(h => h.id === Number(params.hid) && h.active); if (!helper) return reply(404, { status: 404, message: 'That helper was not found.' }); helper.active = false; return reply(204); });
get('/clubs/:id/helpers', ({ params, headers }) => {
  if (Number(params.id) !== C.CLUB_ID || V.restrictedPersona(headers)) return denied('Only the club’s admins can do this.');
  return helpers.filter(h => h.active).map(h => ({ id: h.id, name: h.name, squadId: h.squadId, squadName: C.squadName(h.squadId), session: 'Training', startsAt: helperSession().start.toISOString(), repeating: h.repeating, addedBy: C.name(h.addedBy), since: h.since }));
});
del('/clubs/:id/helpers/:hid', ({ params, headers }) => {
  if (Number(params.id) !== C.CLUB_ID || V.restrictedPersona(headers)) return denied('Only the club’s admins can do this.');
  const helper = helpers.find(h => h.id === Number(params.hid) && h.active);
  if (!helper) return reply(404, { status: 404, message: 'That helper was not found.' });
  helper.active = false; return reply(204);
});
