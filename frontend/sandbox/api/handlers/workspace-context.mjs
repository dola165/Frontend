// Private club state and permissions. New clubs start with their own empty registers.
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';
import { reply } from '../router.mjs';

export const denied = () => reply(403, { status: 403, message: 'This work is not in your club responsibilities.' });
export const missing = () => reply(404, { status: 404, message: 'This record is unavailable or you no longer have access.' });
export const bad = message => reply(400, { status: 400, message });
export const conflict = (message = 'This record changed since you opened it. Reload and try again.') => reply(409, { status: 409, code: 'VERSION_CONFLICT', message });
export const created = body => reply(201, body);
export const season = '2026/27';
export const sectionOf = squad => /first team/i.test(squad.name) ? 'First team' : /girls|women/i.test(squad.name) ? 'Girls' : 'Academy';
export const appointmentView = a => ({ ...a, effective_status: a.status === 'ACTIVE' ? (a.ends_on && a.ends_on < C.date(0) ? 'EXPIRED' : a.starts_on > C.date(0) ? 'UPCOMING' : 'ACTIVE') : a.status });
const stores = new Map();
const seeded = { records: C.records, settings: C.settings, appointments: C.appointments, requests: C.roleRequests, history: C.history, documents: C.documents };
export function stateFor(clubId) {
  if (clubId === C.CLUB_ID) return seeded;
  if (!stores.has(clubId)) stores.set(clubId, {
    records: [], appointments: [], requests: [], history: new Map(), documents: new Map(),
    settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', currency: null, country_code: 'GE', timezone: C.TIMEZONE, legal_name: null, registration_reference: null, enabled_modules: [...C.MODULES], revision: 0 },
  });
  return stores.get(clubId);
}
export const appointmentsFor = actor => [...seeded.appointments, ...[...stores.values()].flatMap(s => s.appointments)].filter(a => a.user_id === actor);
const choice = id => ({ id, name: P.viewerName(id) === `Member #${id}` ? C.name(id) : P.viewerName(id) });
const coachingModules = ['ATTENDANCE', 'DEVELOPMENT', 'READINESS', 'AVAILABILITY', 'GUARDIANS', 'EDUCATION', 'EQUIPMENT', 'TRAVEL'];
export function workspaceContext(params, headers) {
  const clubId = Number(params.id), actorId = V.viewerId(headers), club = W.clubById(clubId);
  if (!club) return null;
  const demo = clubId === C.CLUB_ID;
  const persona = demo ? V.personaOf(headers) : null;
  const page = P.pages.get(`club:${clubId}`);
  // A physio's job comes without a club membership (JOB here, never a club role).
  const role = demo && actorId === W.ME_ID ? { member: 'PLAYER', analyst: 'COACH', headcoach: 'COACH', physio: 'JOB' }[persona] ?? 'OWNER' : P.roleOf(page, actorId);
  if (!role) return null;
  const leadership = ['OWNER', 'ADMIN', 'CLUB_ADMIN'].includes(role), state = stateFor(clubId);
  const squads = W.squads.filter(s => s.clubId === clubId), allIds = squads.map(s => s.id);
  // At Dinamo Luka coaches U14 and U16 as himself and as the head coach persona; the other personas coach no squad.
  const coaching = !demo ? squads.filter(s => s.headCoachId === actorId).map(s => s.id) : !persona || persona === 'headcoach' ? [...C.myCoaching.squad_ids] : [];
  const active = state.appointments.filter(a => a.user_id === actorId && appointmentView(a).effective_status === 'ACTIVE');
  let modules;
  if (leadership) modules = C.MODULES.map(id => ({ id, writable: true, globalWrite: true, writeSquads: allIds, globalRead: true, readSquads: allIds }));
  else if (persona === 'analyst') modules = Object.entries({ DEVELOPMENT: true, AVAILABILITY: false, READINESS: false }).map(([id, writable]) => ({
    id, writable, globalWrite: false, writeSquads: writable ? [...C.myCoaching.squad_ids] : [], globalRead: false, readSquads: [...C.myCoaching.squad_ids],
  }));
  else if (persona === 'member') modules = [];
  // The physio's job: the medical record and participation restrictions, for the whole club, and nothing else.
  else if (persona === 'physio') modules = ['MEDICAL', 'AVAILABILITY'].map(id => ({ id, writable: true, globalWrite: true, writeSquads: allIds, globalRead: true, readSquads: allIds }));
  else {
    modules = C.MODULES.flatMap(id => {
      const readable = active.filter(a => a.permissions.some(p => p === `${id}:READ` || p === `${id}:WRITE`));
      const writable = readable.filter(a => a.permissions.includes(`${id}:WRITE`));
      const coachingAccess = coachingModules.includes(id) ? coaching : [];
      const readSquads = [...new Set([...coachingAccess, ...readable.flatMap(a => a.squad_ids ?? [])])];
      const writeSquads = [...new Set([...coachingAccess, ...writable.flatMap(a => a.squad_ids ?? [])])];
      const globalRead = readable.some(a => !(a.squad_ids ?? []).length), globalWrite = writable.some(a => !(a.squad_ids ?? []).length);
      return readSquads.length || globalRead ? [{ id, writable: globalWrite || writeSquads.length > 0, globalRead, globalWrite, readSquads, writeSquads }] : [];
    });
  }
  const staffIds = demo ? C.activeStaffIds() : [...(page?.staff.keys() ?? [])];
  const peopleIds = [...new Set(squads.flatMap(s => s.playerIds))];
  const sessionEvents = W.events.filter(e => e.clubId === clubId && e.type === 'TRAINING' && e.end > new Date(Date.now() - 864e5));
  const sessions = sessionEvents.sort((a, b) => a.start - b.start).map(e => ({ id: e.id, title: e.title ?? 'Training', starts_at: W.iso(e.start), squad_id: e.squadId, squad_name: squads.find(s => s.id === e.squadId)?.name ?? '' }));
  return { clubId, clubName: club.name, actorId, leadership, persona, role, state, squads, coaching, modules, staff: staffIds.map(choice), people: peopleIds.map(choice), sessions };
}
export function scoped(handler) {
  return req => {
    const ctx = workspaceContext(req.params, req.headers);
    return ctx ? handler({ ...req, ctx }) : denied();
  };
}
export function canRead(ctx, module, squad = null) {
  const access = ctx.modules.find(m => m.id === module);
  return Boolean(access && (access.globalRead || squad != null && access.readSquads.includes(Number(squad))));
}
export function canWrite(ctx, module, squad = null) {
  const access = ctx.modules.find(m => m.id === module);
  return Boolean(ctx.state.settings.enabled_modules.includes(module) && access?.writable && (access.globalWrite || squad != null && access.writeSquads.includes(Number(squad))));
}
export const findRecord = (ctx, id) => ctx.state.records.find(r => r.id === Number(id) && r.club_id === ctx.clubId && canRead(ctx, r.module, r.squad_id));
export function recordView(ctx, r) {
  const att = C.attentionDate(r), restricted = r.restricted;
  const base = { ...r, canEdit: canWrite(ctx, r.module, r.squad_id) && !restricted && !['ATTENDANCE', 'CONSENT', 'COLLECTION'].includes(r.kind),
    transitions: canWrite(ctx, r.module, r.squad_id) && !restricted ? C.transitionsFor(r.kind, r.status) : [], attentionDate: att, expired: Boolean(r.data.expiresOn && r.data.expiresOn < C.date(0)) };
  delete base.restricted;
  return restricted ? { ...base, subject_user_id: null, data: {}, title: r.kind === 'CLINICAL_NOTE' ? 'Restricted clinical note' : 'Confidential welfare case' } : base;
}
export function bootstrap(ctx) {
  const visible = ctx.state.records.filter(r => canRead(ctx, r.module, r.squad_id));
  const ids = ctx.leadership ? ctx.squads.map(s => s.id) : [...new Set(ctx.modules.flatMap(m => m.readSquads))];
  const squads = ctx.squads.filter(s => ctx.leadership || ids.includes(s.id));
  const people = ctx.people.filter(p => squads.some(s => s.playerIds.includes(p.id)));
  return { clubId: ctx.clubId, clubName: ctx.clubName, leadership: ctx.leadership, actorId: ctx.actorId, canReadMatches: true,
    definitions: C.definitions, specialisations: C.SPECIALISATIONS, permissions: ctx.modules.map(m => `${m.id}:${m.writable ? 'WRITE' : 'READ'}`),
    settings: { ...ctx.state.settings, enabled_modules: [...ctx.state.settings.enabled_modules] }, modules: ctx.modules,
    squads: squads.map(s => ({ id: s.id, name: s.name })), people, staff: ctx.staff,
    venues: W.venues.map(v => ({ id: v.id, name: v.name })),
    guardians: W.parents.filter(g => people.some(p => p.id === g.childId)).map(g => ({ ...choice(g.parentId), child_id: g.childId })),
    events: W.matches.filter(m => m.clubId === ctx.clubId && m.status === 'SCHEDULED' && (ctx.leadership || ids.includes(m.squadId))).map(m => ({ id: m.id, title: C.matchTitle(m), starts_at: W.iso(m.start) })),
    sessions: ctx.sessions.filter(s => ctx.leadership || ids.includes(s.squad_id)),
    links: visible.filter(r => ['ASSET', 'TRIP', 'FACILITY', 'EMERGENCY_PLAN', 'COLLECTION', 'CONSENT', 'COMPETITION_REQUIREMENTS'].includes(r.kind) && !['ARCHIVED', 'RETIRED'].includes(r.status)).map(r => ({ id: r.id, title: r.title, module: r.module, kind: r.kind, squad_id: r.squad_id })),
  };
}
export const roleRequestView = (ctx, r) => ({ ...r, revision: r.revision ?? 1, name: choice(r.user_id).name, squad_id: r.squad_ids[0] ?? null, squad_name: ctx.squads.find(s => s.id === r.squad_ids[0])?.name ?? null,
  squad_names: r.squad_ids.map(id => ctx.squads.find(s => s.id === id)?.name ?? ''), clubWide: !r.squad_ids.length, permissions: C.catalog.find(c => c.key === r.role_key)?.permissions ?? [], created_at: r.created_at ?? C.at(r.created ?? 0) });
export function rolesWorkspace(ctx, view) {
  const clubView = { id: 'club', label: 'Club administration', modules: C.MODULES, squadIds: ctx.squads.map(s => s.id), clubWide: true, appointmentId: null, revision: null };
  const coachingView = { id: 'coaching', label: 'Squad coach', modules: coachingModules, squadIds: ctx.coaching, clubWide: false, appointmentId: ctx.clubId === C.CLUB_ID ? C.myCoaching.id : null, revision: null };
  const personal = { id: ctx.persona ?? 'all', label: ctx.persona === 'analyst' ? 'Performance analyst' : ctx.persona === 'physio' ? 'Physio' : 'Your club workspace', modules: ctx.modules.map(m => m.id),
    squadIds: [...new Set(ctx.modules.flatMap(m => m.readSquads))], clubWide: ctx.modules.some(m => m.globalRead), appointmentId: null, revision: null };
  const views = [...(ctx.leadership ? [clubView] : []), ...(ctx.coaching.length ? [coachingView] : [])];
  if (!views.length) views.push(personal);
  const current = views.find(v => v.id === view) ?? (ctx.leadership ? { ...clubView, id: 'all', label: 'All my work' } : personal);
  const squads = ctx.squads.filter(s => current.clubWide || current.squadIds.includes(s.id));
  return { leadership: ctx.leadership, actorId: ctx.actorId, catalog: C.catalog, views, current, season,
    requestSquads: ctx.squads.map(s => ({ id: s.id, name: s.name })),
    squads: squads.map(s => ({ id: s.id, name: s.name, player_count: s.playerIds.length, section: sectionOf(s) })),
    people: squads.flatMap(s => s.playerIds.map(id => ({ ...choice(id), squad_id: s.id, squad_name: s.name }))),
    sessions: ctx.sessions.filter(s => squads.some(sq => sq.id === s.squad_id)),
    requests: ctx.state.requests.filter(r => ctx.leadership || r.user_id === ctx.actorId).map(r => roleRequestView(ctx, r)),
    invitations: ctx.state.appointments.filter(a => a.user_id === ctx.actorId && a.status === 'INVITED').map(appointmentView),
  };
}
export function validateScope(ctx, body) {
  const ids = [body.squadId, ...(body.squadIds ?? [])].filter(id => id != null);
  if (ids.some(id => !ctx.squads.some(s => s.id === Number(id)))) return bad('Choose squads from this club.');
  if (body.subjectUserId != null && !ctx.people.some(p => p.id === Number(body.subjectUserId)) && !ctx.staff.some(p => p.id === Number(body.subjectUserId))) return bad('Choose a person from this club.');
  if (body.assignedUserId != null && !ctx.staff.some(p => p.id === Number(body.assignedUserId)) && !W.parents.some(g => g.parentId === Number(body.assignedUserId) && g.childId === Number(body.subjectUserId))) return bad('Choose a responsible person from this club.');
  if (body.sessionId != null && !ctx.sessions.some(s => s.id === Number(body.sessionId) && (body.squadId == null || s.squad_id === Number(body.squadId)))) return bad('Choose a session from this squad.');
  if (body.eventId != null && !W.events.some(e => e.id === Number(body.eventId) && e.clubId === ctx.clubId)) return bad('Choose an event from this club.');
  if (body.relatedRecordId != null && !findRecord(ctx, body.relatedRecordId)) return bad('Choose a related record from this club.');
  return null;
}

