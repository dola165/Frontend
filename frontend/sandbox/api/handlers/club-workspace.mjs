// Operational records and staff work use one store per club and confirmed viewer access.
import { get as routeGet, post as routePost, put as routePut, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';
import { scoped, workspaceContext, stateFor, appointmentsFor, canRead, canWrite, findRecord, recordView, bootstrap, rolesWorkspace, roleRequestView, validateScope, appointmentView, denied, missing, bad, conflict, created } from './workspace-context.mjs';
import { validateLinkedTravelTransition, validateLinkedTravelEdit } from './linked-travel-guards.mjs';
const get = (path, fn) => routeGet(path, scoped(fn));
const post = (path, fn) => routePost(path, scoped(fn));
const put = (path, fn) => routePut(path, scoped(fn));
const ROOT = '/clubs/:id/operations';
const recordCreations = new Map(); // actor + club + this operation + UUID; no client payload storage

get(ROOT, ({ ctx }) => bootstrap(ctx));
put(`${ROOT}/settings`, ({ ctx, body }) => {
  if (!ctx.leadership) return denied();
  const s = ctx.state.settings;
  if (body?.revision !== s.revision) return conflict('Club settings changed since you opened them. Reload and try again.');
  Object.assign(s, { setting: body.setting, playing_level: body.playingLevel, currency: body.currency, country_code: body.countryCode, timezone: body.timezone, legal_name: body.legalName, registration_reference: body.registrationReference, enabled_modules: body.enabledModules ?? s.enabled_modules, revision: s.revision + 1 });
  return s;
});
get(`${ROOT}/finance-summary`, ({ ctx }) => {
  if (!canRead(ctx, 'FINANCE')) return denied();
  const fin = ctx.state.records.filter(r => r.module === 'FINANCE');
  const currencies = [...new Set(fin.map(r => r.data.currency).filter(Boolean))];
  return currencies.map(currency => {
    const sum = (kinds, statuses) => fin.filter(r => r.data.currency === currency && kinds.includes(r.kind) && statuses.includes(r.status)).reduce((n, r) => n + Number(r.data.amount ?? 0), 0);
    return { currency, budget: sum(['BUDGET'], ['APPROVED']), committed: sum(['PURCHASE', 'REIMBURSEMENT'], ['APPROVED']), spent: sum(['PURCHASE', 'REIMBURSEMENT'], ['PAID']), membership_due: sum(['INSTALMENT'], ['DUE']), membership_recorded: sum(['INSTALMENT'], ['PAID']) };
  });
});
get(`${ROOT}/records/:rid`, ({ ctx, params }) => { const r = findRecord(ctx, params.rid); return r ? recordView(ctx, r) : missing(); });
get(`${ROOT}/records/:rid/history`, ({ ctx, params }) => { const r = findRecord(ctx, params.rid); return r ? r.restricted ? [] : [...(ctx.state.history.get(r.id) ?? [])].reverse() : missing(); });
get(`${ROOT}/records/:rid/documents`, ({ ctx, params }) => { const r = findRecord(ctx, params.rid); return r ? r.restricted ? [] : (ctx.state.documents.get(r.id) ?? []) : missing(); });
get(`${ROOT}/records/:rid/documents/:did`, ({ ctx, params }) => {
  const r = findRecord(ctx, params.rid), doc = r && ctx.state.documents.get(r.id)?.find(d => d.id === Number(params.did));
  return doc && !r.restricted ? reply(200, '%PDF-1.4\n% Club record document\n', { 'content-type': 'application/pdf' }) : missing();
});
post(`${ROOT}/records/:rid/documents`, ({ ctx, params, body }) => {
  const r = findRecord(ctx, params.rid); if (!r) return missing();
  if (r.restricted || !canWrite(ctx, r.module, r.squad_id)) return denied();
  const list = ctx.state.documents.get(r.id) ?? [], d = { id: C.nextId(), file_name: `document-${list.length + 1}.pdf`, bytes: body?._raw ?? 120000, created_at: C.nowIso() };
  list.push(d); ctx.state.documents.set(r.id, list); return created(d);
});
function log(ctx, r, action, from, to, note) {
  const h = ctx.state.history.get(r.id) ?? [];
  h.push({ id: C.nextId(), action, from_status: from, to_status: to, note: note ?? null, actor: P.viewerName(ctx.actorId), created_at: C.nowIso() }); ctx.state.history.set(r.id, h);
}
const input = (body, previous) => ({ title: String(body.title ?? previous?.title ?? '').trim().slice(0, 160), squad_id: body.squadId ?? null,
  subject_user_id: previous ? previous.subject_user_id : (body.subjectUserId ?? null), assigned_user_id: body.assignedUserId ?? null,
  event_id: previous ? previous.event_id : (body.eventId ?? null), session_id: previous ? previous.session_id : (body.sessionId ?? null),
  related_record_id: previous ? previous.related_record_id : (body.relatedRecordId ?? null), due_on: body.dueOn ?? null,
  data: Object.fromEntries(Object.entries(body.data ?? {}).map(([k, v]) => [k, String(v ?? '')])) });
function validate(ctx, body, def) {
  if (!def) return bad('Choose a record type.');
  if (!canWrite(ctx, def.module, body.squadId ?? null)) return denied();
  if (!body.title?.trim()) return bad('Add a title.');
  const missingFields = def.fields.filter(f => f.required && !String(body.data?.[f.key] ?? '').trim()).map(f => f.label);
  if (missingFields.length && body.kind !== 'OBSERVATION') return bad(`Complete the required details: ${missingFields.join(', ')}.`);
  return validateScope(ctx, body);
}
post(`${ROOT}/records`, ({ ctx, body, headers }) => {
  const def = C.definitionFor(body?.kind), failure = validate(ctx, body ?? {}, def); if (failure) return failure;
  const requestId = headers?.['idempotency-key'] ?? headers?.['Idempotency-Key'];
  if (requestId && (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))) return bad('Use a UUID for this save request.');
  const key = requestId ? `${ctx.actorId}:${ctx.clubId}:${requestId.toLowerCase()}` : null, normalized = input(body);
  const fingerprint = JSON.stringify({ kind: def.kind, ...normalized, data: Object.fromEntries(Object.entries(normalized.data).sort(([a], [b]) => a.localeCompare(b))) });
  const previous = key && recordCreations.get(key);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return conflict('This request already submitted different record details.');
    const record = findRecord(ctx, previous.id);
    if (!record) return ctx.state.records.some(r => r.id === previous.id) ? denied() : conflict('This saved record was deleted. The request identity is already used.');
    if (!canWrite(ctx, record.module, record.squad_id)) return denied();
    return recordView(ctx, record);
  }
  const r = { id: C.nextRecordId(), club_id: ctx.clubId, module: def.module, kind: def.kind, status: def.states[0], ...input(body), revision: 0, created_at: C.nowIso(), updated_at: C.nowIso(), restricted: false, map_plan_id: null };
  ctx.state.records.push(r); log(ctx, r, 'CREATED', null, r.status, null); if (key) recordCreations.set(key, { id: r.id, fingerprint }); return created(recordView(ctx, r));
});
put(`${ROOT}/records/:rid`, ({ ctx, params, body, headers }) => {
  const r = findRecord(ctx, params.rid); if (!r) return missing();
  if (r.restricted || !recordView(ctx, r).canEdit) return denied();
  if (body?.kind !== r.kind) return bad('The record type cannot change.');
  if (body?.revision !== r.revision) return conflict();
  const failure = validate(ctx, body, C.definitionFor(r.kind)); if (failure) return failure;
  const linkedFailure = validateLinkedTravelEdit(ctx, r, headers); if (linkedFailure) return linkedFailure;
  Object.assign(r, input(body, r), { revision: r.revision + 1, updated_at: C.nowIso() }); log(ctx, r, 'UPDATED', null, null, null);
  return recordView(ctx, r);
});
post(`${ROOT}/records/:rid/transition`, ({ ctx, params, body, headers }) => {
  const r = findRecord(ctx, params.rid); if (!r) return missing();
  const guardianDecision = ['CONSENT', 'COLLECTION'].includes(r.kind) && r.assigned_user_id === ctx.actorId;
  if (r.restricted || !(guardianDecision || canWrite(ctx, r.module, r.squad_id))) return denied();
  if (body?.revision !== r.revision) return conflict();
  const allowed = C.transitionsFor(r.kind, r.status);
  if (['CONSENT', 'COLLECTION'].includes(r.kind) && !guardianDecision && ['GRANTED', 'DECLINED', 'REVOKED'].includes(body?.status)) return denied();
  const validGuardianDecision = guardianDecision && (r.status === 'PENDING' && ['GRANTED', 'DECLINED'].includes(body?.status) || r.status === 'GRANTED' && body?.status === 'REVOKED');
  if (!allowed.includes(body?.status) && !validGuardianDecision) return conflict(`This record cannot move from ${r.status.toLowerCase()} to ${String(body?.status).toLowerCase()}.`);
  if (r.kind === 'ATTENDANCE' && body.status === 'EXPECTED' && !body.note) return bad('Give a reason for the correction.');
  const linkedFailure = validateLinkedTravelTransition(ctx, r, body.status, headers); if (linkedFailure) return linkedFailure;
  const from = r.status; r.status = body.status; r.revision++; r.updated_at = C.nowIso(); log(ctx, r, 'STATUS_CHANGED', from, r.status, body.note);
  return recordView(ctx, r);
});
post(`${ROOT}/records/:rid/feedback`, ({ ctx, params }) => findRecord(ctx, params.rid) ? created({ recorded: true }) : missing());
post(`${ROOT}/concerns`, ({ ctx, body }) => {
  if (!body?.description?.trim()) return bad('Describe what happened.');
  const failure = validateScope(ctx, body); if (failure) return failure;
  if (!canWrite(ctx, 'WELFARE', body.squadId ?? null)) return denied();
  const r = { id: C.nextRecordId(), club_id: ctx.clubId, module: 'WELFARE', kind: 'CONCERN', title: 'Confidential welfare case', status: 'OPEN',
    ...input({ ...body, data: { description: body.description, immediateAction: body.immediateAction ?? '' } }), revision: 0, created_at: C.nowIso(), updated_at: C.nowIso(), restricted: true };
  ctx.state.records.push(r); log(ctx, r, 'CREATED', null, r.status, null); return created({ id: r.id });
});
post(`${ROOT}/education-absences`, ({ ctx, body }) => {
  const squadId = ctx.squads.find(s => s.playerIds.includes(body?.subjectUserId))?.id, def = C.definitionFor('EDUCATION_ABSENCE');
  const payload = { ...body, kind: def.kind, squadId, title: `${ctx.people.find(p => p.id === body?.subjectUserId)?.name ?? 'Player'} · school`,
    data: { reason: body?.reason ?? 'OTHER', startsOn: body?.startsOn ?? '', endsOn: body?.endsOn ?? '', notes: body?.notes ?? '' } };
  const failure = validate(ctx, payload, def); if (failure) return failure;
  const r = { id: C.nextRecordId(), club_id: ctx.clubId, module: def.module, kind: def.kind, ...input(payload), status: 'RECORDED', revision: 0, created_at: C.nowIso(), updated_at: C.nowIso(), restricted: false };
  ctx.state.records.push(r); log(ctx, r, 'CREATED', null, r.status, null); return created({ id: r.id });
});

get(`${ROOT}/appointments`, ({ ctx }) => ctx.state.appointments.filter(a => ctx.leadership || a.user_id === ctx.actorId || canRead(ctx, 'STAFF', a.squad_id)).map(appointmentView));
get(`${ROOT}/staff-candidates`, ({ ctx, query }) => {
  if (!ctx.leadership) return denied();
  const q = (query.get('q') ?? '').toLowerCase();
  return [...W.people.filter(p => p.birthYear <= new Date().getFullYear() - 18 && p.role !== 'PLAYER').map(p => ({ id: p.id, name: p.fullName, username: p.username })), ...[...V.accounts.values()].filter(p => P.viewerAge(p.id) >= 18).map(p => ({ id: p.id, name: p.fullName, username: '' }))]
    .filter(p => p.id !== ctx.actorId && `${p.name} ${p.username}`.toLowerCase().includes(q)).slice(0, 12).map(({ id, name }) => ({ id, name }));
});
function appointmentInput(ctx, body) {
  const ids = body.clubWide ? [] : body.squadIds ?? [];
  return { title: body.title, specialisations: body.specialisations ?? [], engagement: body.engagement ?? 'VOLUNTEER', permissions: body.permissions ?? [],
    squad_ids: ids, squad_id: ids[0] ?? null, squad_name: ctx.squads.find(s => s.id === ids[0])?.name ?? null, squad_names: ids.map(id => ctx.squads.find(s => s.id === id)?.name ?? ''), club_wide: !ids.length, starts_on: body.startsOn, ends_on: body.endsOn ?? null };
}
function invite(ctx, body) {
  const person = W.personById(body?.userId) ?? V.account(body?.userId);
  if (!person || P.viewerAge(person.id) == null && person.birthYear > new Date().getFullYear() - 18 || V.account(person.id) && P.viewerAge(person.id) < 18) return bad('Choose an adult account.');
  if (!body.title?.trim() || !body.specialisations?.length) return bad('Choose a role and at least one football responsibility.');
  const connected = P.ownedPages(person.id).find(p => p.clubId && p.clubId !== ctx.clubId) ?? P.clubOf(person.id) ?? (C.memberRole(person.id) ? { ref: { id: C.CLUB_ID } } : null); if (connected && connected.ref.id !== ctx.clubId) return conflict('This person already belongs to another club.');
  const a = { id: C.nextId(), club_id: ctx.clubId, club_name: ctx.clubName, user_id: person.id, name: person.fullName, status: 'INVITED', revision: 0, published: false, timezone: ctx.state.settings.timezone, expires_at: C.at(14, 23, 59), provenance: 'CLUB_APPOINTMENT', unavailable_reason: null, ...appointmentInput(ctx, body) };
  ctx.state.appointments.push(a); return created(appointmentView(a));
}
post(`${ROOT}/appointments`, ({ ctx, body }) => !ctx.leadership ? denied() : validateScope(ctx, body ?? {}) ?? invite(ctx, body ?? {}));
put(`${ROOT}/appointments/:aid`, ({ ctx, params, body }) => {
  if (!ctx.leadership) return denied();
  const a = ctx.state.appointments.find(a => a.id === Number(params.aid)); if (!a) return missing();
  if (body?.revision !== a.revision) return conflict();
  const failure = validateScope(ctx, body ?? {}); if (failure) return failure;
  if (!body.title?.trim() || !body.specialisations?.length) return bad('Choose a role and at least one football responsibility.');
  Object.assign(a, appointmentInput(ctx, body), { status: 'INVITED', revision: a.revision + 1, expires_at: C.at(14, 23, 59) }); return appointmentView(a);
});
routePost(`${ROOT}/appointments/:aid/transition`, ({ params, headers, body }) => {
  const clubId = Number(params.id), actorId = V.viewerId(headers), club = W.clubById(clubId);
  const own = appointmentsFor(actorId).find(a => a.id === Number(params.aid) && a.club_id === clubId);
  const ctx = workspaceContext(params, headers) ?? (own && club ? { clubId, clubName: club.name, actorId, leadership: false, state: stateFor(clubId) } : null);
  if (!ctx) return denied();
  const a = ctx.state.appointments.find(a => a.id === Number(params.aid)); if (!a) return missing();
  if (body?.revision !== a.revision) return conflict();
  const ownDecision = a.user_id === ctx.actorId && ['ACTIVE', 'DECLINED', 'ENDED'].includes(body?.status);
  if (!ownDecision && !(ctx.leadership && body?.status === 'ENDED')) return denied();
  if (body.status === 'ACTIVE' && a.status !== 'INVITED') return conflict();
  const connected = P.ownedPages(a.user_id).find(p => p.clubId && p.clubId !== ctx.clubId) ?? P.clubOf(a.user_id) ?? (C.memberRole(a.user_id) ? { ref: { id: C.CLUB_ID } } : null);
  if (body.status === 'ACTIVE' && connected && connected.ref.id !== ctx.clubId) return conflict('This person already belongs to another club.');
  a.status = body.status; a.revision++;
  if (a.status === 'ENDED' && !a.ends_on) a.ends_on = C.date(0);
  if (a.status === 'ACTIVE' && ctx.clubId !== C.CLUB_ID) P.clubPage(ctx.clubId).staff.set(a.user_id, 'COACH');
  return appointmentView(a);
});
put(`${ROOT}/appointments/:aid/publication`, ({ ctx, params, body }) => {
  if (!ctx.leadership) return denied();
  const a = ctx.state.appointments.find(a => a.id === Number(params.aid)); if (!a) return missing();
  if (body?.revision != null && body.revision !== a.revision) return conflict();
  a.published = Boolean(body?.published); a.revision++; return appointmentView(a);
});

get('/clubs/:id/workspace-roles', ({ ctx, query }) => rolesWorkspace(ctx, query.get('view')));
function work(ctx, query) {
  const module = query.get('module') ?? 'HOME', q = (query.get('q') ?? '').trim().toLowerCase(), kind = query.get('kind'), mine = query.get('mine') === 'true', state = query.get('state');
  const squad = Number(query.get('squad')) || null, session = Number(query.get('session')) || null, person = Number(query.get('person')) || null;
  let rows = ctx.state.records.filter(r => canRead(ctx, r.module, r.squad_id) && (module === 'HOME' ? C.isOpen(r) && C.attentionDate(r) && C.attentionDate(r) <= C.date(21) && !r.restricted && r.module !== 'ATTENDANCE' : r.module === module));
  if (module !== 'HOME' && !ctx.modules.some(m => m.id === module)) return denied();
  if (module === 'HOME') rows = rows.filter(r => !['CLINICAL_NOTE', 'EMERGENCY_CONTACT', 'PASSENGER'].includes(r.kind) && !(['CONSENT', 'COLLECTION'].includes(r.kind) && (r.status !== 'PENDING' || r.assigned_user_id !== ctx.actorId)));
  rows = rows.filter(r => (!kind || r.kind === kind) && (!mine || r.assigned_user_id === ctx.actorId) && (state !== 'open' || C.isOpen(r)) && (!squad || r.squad_id === squad) && (!session || r.session_id === session) && (!person || r.subject_user_id === person)
    && (!q || `${r.title} ${Object.values(r.restricted ? {} : r.data).join(' ')}`.toLowerCase().includes(q)));
  rows.sort(module === 'HOME' ? (a, b) => C.attentionDate(a).localeCompare(C.attentionDate(b)) : (a, b) => (C.isOpen(b) - C.isOpen(a)) || b.updated_at.localeCompare(a.updated_at));
  const page = Math.max(0, Number(query.get('page')) || 0); return rows.slice(page * 100, page * 100 + 100).map(r => recordView(ctx, r));
}
get('/clubs/:id/workspace-roles/work', ({ ctx, query }) => work(ctx, query));
get('/clubs/:id/workspace-roles/records', ({ ctx, query }) => work(ctx, query));
get(`${ROOT}/records`, ({ ctx, query }) => work(ctx, query));
post('/clubs/:id/workspace-roles/requests', ({ ctx, body }) => {
  const role = C.catalog.find(c => c.key === body?.roleKey); if (!role) return bad('Choose a role.');
  const failure = validateScope(ctx, body ?? {}); if (failure) return failure;
  if (ctx.state.requests.some(r => r.user_id === ctx.actorId && r.status === 'PENDING')) return conflict('You already have a pending request.');
  const r = { id: C.nextId(), user_id: ctx.actorId, role_key: role.key, squad_ids: body.clubWide ? [] : body.squadIds ?? [], note: body.note ?? null, status: 'PENDING', created_at: C.nowIso(), revision: 1, replace_appointment_id: body.replaceAppointmentId ?? null, review_note: null };
  ctx.state.requests.unshift(r); return created(roleRequestView(ctx, r));
});
post('/clubs/:id/workspace-roles/requests/:rid', ({ ctx, params, body }) => {
  const r = ctx.state.requests.find(r => r.id === Number(params.rid)); if (!r) return missing();
  if (!ctx.leadership || r.user_id === ctx.actorId) return denied();
  if (body?.revision !== (r.revision ?? 1)) return conflict();
  if (r.status !== 'PENDING' || !['APPROVED', 'DECLINED'].includes(body.status)) return conflict();
  r.status = body.status; r.review_note = body.note ?? null; r.revision = (r.revision ?? 1) + 1;
  if (r.status === 'APPROVED') {
    const role = C.catalog.find(c => c.key === r.role_key);
    const result = invite(ctx, { userId: r.user_id, title: role.title, specialisations: [role.key], permissions: role.permissions, clubWide: !r.squad_ids.length, squadIds: r.squad_ids, startsOn: C.date(0) });
    if (result.status !== 201) { r.status = 'PENDING'; r.revision--; return result; }
  }
  return roleRequestView(ctx, r);
});
post('/clubs/:id/workspace-roles/assignments', ({ ctx, body }) => {
  if (!ctx.leadership) return denied();
  const role = C.catalog.find(c => c.key === body?.roleKey); if (!role) return bad('Choose a role.');
  return validateScope(ctx, body ?? {}) ?? invite(ctx, { ...body, title: role.title, specialisations: [role.key === 'TRAVEL_COORDINATOR' ? 'TEAM_MANAGER' : role.key], permissions: role.permissions, startsOn: C.date(0) });
});
routeGet('/club-operations/mine', ({ headers }) => {
  const actor = V.viewerId(headers), clubs = actor === W.ME_ID ? [C.CLUB_ID] : P.ownedPages(actor).filter(p => p.clubId).map(p => p.clubId);
  const contexts = clubs.map(id => workspaceContext({ id }, headers)).filter(Boolean);
  return { appointments: appointmentsFor(actor).map(appointmentView), permissions: [], clubs: contexts.map(ctx => ({ id: ctx.clubId, name: ctx.clubName, canWork: ctx.modules.length > 0 })) };
});

