import { reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import { stateFor } from './workspace-context.mjs';
import { mapPlanningContext, fixturesForScope } from './map-planning-context.mjs';
import { canReadTrainingSession } from './club-training-calendar.mjs';
import { publishedJourneyState } from './map-planning-source.mjs';
import { planningScope, planReadable, planWritable, planRights, viewPlan, publicationOf, rememberPublication, familySubjects, adultActor, actorName, arrangementFingerprint } from './map-planning-access.mjs';

const denied = () => reply(403, { status: 403, message: 'This journey is outside your current club responsibilities.' });
const missing = () => reply(404, { status: 404, message: 'This journey is unavailable.' });
const bad = message => reply(400, { status: 400, message });
const conflict = message => reply(409, { status: 409, message });
const uuid = value => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(String(value ?? ''));
const summaries = plan => ({ id: plan.id, club_id: plan.club_id, squad_id: plan.squad_id, title: plan.title, revision: plan.revision,
  published_version: plan.published_version, published_revision: plan.published_revision, updated_at: plan.updated_at, starts_at: plan.starts_at });
const receipts = new Map(), preferences = new Map(), acknowledgements = new Map();
const responseKey = (plan, version, subject) => `${plan.id}:${version}:${subject}`;
const responseOf = (plan, version, subject) => F.planReplies.get(responseKey(plan, version, subject)) ?? 'PENDING';
const open = publication => Date.parse(publication.snapshot.endsAt) > Date.now();
const total = draft => draft.arrangements.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
const financialState = draft => JSON.stringify([draft.currency, draft.budgetMinor, draft.arrangements]);
const familyPermission = record => record ? {
  id: record.id, club_id: record.club_id, squad_id: record.squad_id, module: record.module, kind: record.kind,
  title: record.title, status: record.status, revision: record.revision,
  data: { wording: record.data?.wording, version: record.data?.version }, transitions: [],
} : null;

function validateDraft(draft, scope, squadId, previous, headers) {
  const squad = scope.squads.find(item => item.id === Number(squadId));
  if (!draft || !squad || !draft.title?.trim() || !['participants', 'activities', 'arrangements', 'places'].every(key => Array.isArray(draft[key]))) return bad('Add the journey name and review its details.');
  if (!Number.isSafeInteger(draft.budgetMinor) || draft.budgetMinor < 0
    || draft.arrangements.some(item => !Number.isSafeInteger(item.amountMinor ?? 0) || (item.amountMinor ?? 0) < 0)
    || !Number.isSafeInteger(total(draft))) return bad('Use non-negative whole minor units for the budget and estimates.');
  if (draft.participants.some(id => !squad.playerIds.includes(id))) return bad('Every traveller must be on this squad’s current roster.');
  const fixtures = fixturesForScope(scope).filter(fixture => fixture.squadId === squad.id);
  for (const activity of draft.activities) {
    if (activity.eventId != null && !fixtures.some(fixture => fixture.id === activity.eventId)) return denied();
    if (activity.sessionId != null && !W.events.some(event => event.id === activity.sessionId && event.clubId === scope.clubId
      && event.squadId === squad.id && (!event.invitationPlan || canReadTrainingSession(event, headers)))) return denied();
  }
  for (const arrangement of draft.arrangements) if (arrangement.financeRecordId != null) {
    const record = scope.state.records.find(item => item.id === arrangement.financeRecordId && item.club_id === scope.clubId && item.squad_id === squad.id && item.module === 'FINANCE');
    const unchanged = previous?.arrangements.some(item => item.key === arrangement.key && item.financeRecordId === arrangement.financeRecordId);
    if (!record || !scope.can(squad.id, 'FINANCE') && !unchanged) return denied();
  }
  return null;
}

function currentPlan(req, write = false) {
  const plan = F.planById(req.params.id);
  if (!plan) return { error: missing() };
  if (!(write ? planWritable(plan, req.headers) : planReadable(plan, req.headers))) return { error: denied() };
  return { plan, scope: planningScope(plan.club_id, req.headers) };
}
const expected = (plan, body) => Number.isInteger(body?.revision) && body.revision === plan.revision;

function familyResponse(req, read = false) {
  const plan = F.planById(req.params.id), publication = plan && publicationOf(plan);
  if (!publication) return missing();
  const subjectId = Number(req.body?.subjectId ?? req.body?.childId ?? V.viewerId(req.headers));
  const subject = familySubjects(plan, req.headers).find(item => item.id === subjectId);
  if (!subject) return denied();
  if (req.body?.version !== publication.version || !open(publication)) return conflict('This itinerary version is no longer open. Refresh the journey.');
  if (read) {
    const key = `${plan.id}:${publication.version}:${subjectId}:${V.viewerId(req.headers)}`;
    if (!acknowledgements.has(key)) acknowledgements.set(key, W.iso(new Date()));
    return { acknowledged: true };
  }
  if (!['GOING', 'NOT_GOING'].includes(req.body?.response)) return bad('Choose going or not going.');
  if (!subject.guardian && !adultActor(req.headers)) return denied();
  if (!publishedJourneyState(plan, publication).canRespond) return conflict('This journey changed or replies are closed. Read the latest club update before replying.');
  F.planReplies.set(responseKey(plan, publication.version, subjectId), req.body.response);
  return { recorded: true };
}

function familyPlans(headers) {
  return F.plans.flatMap(plan => {
    const publication = publicationOf(plan);
    if (!publication) return [];
    return familySubjects(plan, headers).map(subject => {
      const record = stateFor(plan.club_id).records.find(item => item.kind === 'CONSENT' && item.map_plan_id === plan.id
        && item.subject_user_id === subject.id && item.assigned_user_id === V.viewerId(headers)
        && item.data?.version === `map-plan-${plan.id}-v${publication.version}`);
      return { id: `${plan.id}:${subject.id}`, plan_id: plan.id, club_id: plan.club_id, title: publication.snapshot.title, version: publication.version,
        child_id: subject.id, child_name: subject.name, club_name: W.clubById(plan.club_id)?.name,
        viewer: subject.guardian ? 'GUARDIAN' : 'PLAYER', published_at: publication.at,
        acknowledged_at: acknowledgements.get(`${plan.id}:${publication.version}:${subject.id}:${V.viewerId(headers)}`) ?? null,
        canRespond: publishedJourneyState(plan, publication).canRespond && (subject.guardian || adultActor(headers)),
        response: { status: responseOf(plan, publication.version, subject.id) },
        permission_id: record?.id ?? null, permission: familyPermission(record),
        itinerary: structuredClone(publication.snapshot), travel: { status: plan.trip?.status ?? 'NOT_RECORDED' } };
    });
  });
}

function journeyEntries(query, headers) {
  const from = query.get('from') ? Date.parse(query.get('from')) : null, to = query.get('to') ? Date.parse(query.get('to')) : null;
  const child = Number(query.get('childId')) || null, squadId = Number(query.get('squadId')) || null;
  return F.plans.flatMap(plan => {
    const publication = publicationOf(plan);
    if (!publication || squadId && plan.squad_id !== squadId) return [];
    const staff = planReadable(plan, headers), own = familySubjects(plan, headers).filter(subject => !child || subject.id === child);
    if (!staff && !own.length || child && !own.length) return [];
    const current = publishedJourneyState(plan, publication);
    const subjects = own.map(subject => ({ ...subject, canRespond: current.canRespond && (subject.guardian || adultActor(headers)), response: responseOf(plan, publication.version, subject.id) }));
    const squad = W.squadById(plan.squad_id), responses = (staff ? publication.participants.filter(id => squad.playerIds.includes(id)) : own.map(subject => subject.id)).map(id => responseOf(plan, publication.version, id));
    return current.activities.map(({ activity, source, startsAt, endsAt }, index) => ({
      id: `journey:${plan.id}:${index}`, planId: plan.id, activityKey: publication.activities[index]?.key, version: publication.version,
      clubId: plan.club_id, squadId: plan.squad_id, squadName: squad.name, clubName: W.clubById(plan.club_id)?.name, journeyTitle: publication.snapshot.title,
      timezone: publication.snapshot.timezone, title: source?.title ?? activity.title, kind: activity.kind, startsAt, endsAt,
      status: current.cancelled ? 'CANCELLED' : source?.status ?? 'SCHEDULED', sourceChanged: current.sourceChanged, place: activity.place,
      eventId: publication.activities[index]?.eventId ?? null, sessionId: publication.activities[index]?.sessionId ?? null,
      staff, itinerary: structuredClone(publication.snapshot), subjects,
      attendance: { total: responses.length, going: responses.filter(response => response === 'GOING').length, pending: responses.filter(response => response === 'PENDING').length },
      replyScope: staff ? 'STAFF' : own.some(subject => subject.guardian) ? 'GUARDIAN' : 'PLAYER',
    })).filter(entry => (from == null || Date.parse(entry.endsAt) >= from) && (to == null || Date.parse(entry.startsAt) <= to));
  });
}

export function registerMapPlanning({ get, post, put, itinerary }) {
  get('/map/plans/context', ({ headers }) => mapPlanningContext(headers));
  get('/map/plans/family', ({ headers }) => familyPlans(headers));
  get('/map/plans', req => {
    const clubId = Number(req.query.get('clubId'));
    if (!clubId) return bad('Choose the club whose journeys you want to read.');
    const scope = planningScope(clubId, req.headers);
    if (!scope.squads.some(squad => scope.read(squad.id))) return denied();
    return F.plans.filter(plan => plan.club_id === clubId && scope.read(plan.squad_id)).map(summaries);
  });
  get('/map/plans/:id', req => { const { plan, error } = currentPlan(req); return error ?? viewPlan(plan, req.headers); });
  get('/map/plans/:id/changes', req => { const { plan, error } = currentPlan(req); return error ?? { changes: [], revision: plan.revision }; });
  post('/map/plans', req => {
    const scope = planningScope(req.body?.clubId, req.headers), squadId = Number(req.body?.squadId);
    if (!scope.write(squadId)) return denied();
    if (!uuid(req.body?.requestId)) return bad('Use a request ID so retrying keeps one journey.');
    const key = `${scope.actor}:${req.body.requestId}`, previous = receipts.get(key);
    if (previous) {
      const saved = F.planById(previous);
      return saved?.club_id === scope.clubId && saved.squad_id === squadId && planReadable(saved, req.headers) ? viewPlan(saved, req.headers) : conflict('This request ID already belongs to another journey.');
    }
    const problem = validateDraft(req.body.draft, scope, squadId, undefined, req.headers);
    if (problem) return problem;
    const draft = structuredClone(req.body.draft), now = W.iso(new Date());
    const plan = { id: W.newId(), club_id: scope.clubId, squad_id: squadId, created_by: scope.actor, last_editor: scope.actor, title: draft.title,
      revision: 1, published_version: 0, published_revision: null, updated_at: now, starts_at: draft.startsAt, draft,
      suppliers: {}, totalMinor: total(draft), budgetApproved: false, approvedBy: null,
      history: [{ id: W.newId(), action: 'CREATED', created_at: now, actor: actorName(req.headers) }], familyResponses: [], journeyResponses: [], playerResponses: [],
      trip_id: null, trip: null, passengers: [], linkedSchedule: [], issues: [] };
    F.plans.push(plan); receipts.set(key, plan.id);
    return reply(201, viewPlan(plan, req.headers));
  });
  put('/map/plans/:id', req => {
    const { plan, scope, error } = currentPlan(req, true); if (error) return error;
    if (!expected(plan, req.body)) return conflict('Someone else saved this journey. Reload before saving.');
    const problem = validateDraft(req.body.draft, scope, plan.squad_id, plan.draft, req.headers); if (problem) return problem;
    if (financialState(plan.draft) !== financialState(req.body.draft)) plan.budgetApproved = false;
    plan.draft = structuredClone(req.body.draft); plan.title = plan.draft.title; plan.starts_at = plan.draft.startsAt;
    plan.totalMinor = total(plan.draft);
    plan.revision++; plan.updated_at = W.iso(new Date()); plan.last_editor = scope.actor;
    return viewPlan(plan, req.headers);
  });
  for (const route of ['/journeys/:id/reply', '/map/plans/:id/journey-response']) post(route, req => familyResponse(req));
  post('/map/plans/:id/acknowledge', req => familyResponse(req, true));
  post('/map/plans/:id/my-response', req => familyResponse(req, req.body?.response === 'READ'));
  get('/journeys/schedule', ({ query, headers }) => journeyEntries(query, headers));
  get('/journeys/squads/:id/preferences', req => {
    const squad = W.squadById(req.params.id);
    if (!squad) return denied();
    const scope = planningScope(squad.clubId, req.headers);
    if (!scope.can(squad.id, 'MATCHES') && !scope.can(squad.id, 'TRAVEL')) return denied();
    return preferences.get(squad.id) ?? { revision: 0, preferences: { mode: 'TRAVEL_TOGETHER', meetingPoint: '', travelMinutes: null, arrivalMinutes: 45, loadingMinutes: 10, recoveryMinutes: 20 } };
  });
  put('/journeys/squads/:id/preferences', req => {
    const squad = W.squadById(req.params.id);
    if (!squad || !planningScope(squad.clubId, req.headers).write(squad.id)) return denied();
    const revision = preferences.get(squad.id)?.revision ?? 0;
    if (req.body?.revision !== revision) return conflict('Journey preferences changed. Reload before saving.');
    const value = { revision: revision + 1, preferences: structuredClone(req.body.preferences ?? {}) }; preferences.set(squad.id, value); return value;
  });
  post('/map/plans/:id/:action', req => {
    const { plan, scope, error } = currentPlan(req); if (error) return error;
    const rights = planRights(plan, req.headers), action = req.params.action;
    const permission = action === 'approve-budget' ? scope.can(plan.squad_id, 'FINANCE', true) : action === 'publish' ? rights.publish
      : ['supplier', 'connect-trip', 'passengers', 'milestones'].includes(action) ? rights.travel : ['request-review', 'calendar-event', 'apply-changes'].includes(action) ? rights.edit : null;
    if (permission == null) return bad('Choose an available journey action.');
    if (!permission) return denied();
    if (!expected(plan, req.body)) return conflict('This journey changed. Reload before continuing.');
    if (action === 'connect-trip') {
      if (!plan.published_version) return conflict('Publish the family itinerary before connecting the travel record.');
      if (plan.published_revision !== plan.revision) return conflict('Publish the current draft before updating travel.');
      const trip = scope.state.records.find(record => record.id === plan.trip_id && record.club_id === plan.club_id
        && record.squad_id === plan.squad_id && record.module === 'TRAVEL' && record.kind === 'TRIP');
      if (trip && ['DEPARTED', 'RETURNED', 'CANCELLED'].includes(trip.status)) return viewPlan({ ...plan, trip }, req.headers);
      // Shared operations do not yet represent Java's trip/passenger states or linked permission guards.
      return conflict('The travel record could not be connected. No trip or passenger checks were changed.');
    }
    if (action === 'supplier') {
      const { arrangementKey, status, source, evidence } = req.body;
      const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
      if (!text(arrangementKey, 80) || !['PENDING', 'CONFIRMED', 'DECLINED'].includes(status) || !text(source, 160) || !text(evidence, 2000)) return bad('Choose a supplier answer and add its source and evidence within the allowed lengths.');
      const arrangement = plan.draft.arrangements.find(item => item.key === arrangementKey);
      if (!arrangement) return bad('Choose an arrangement in this plan.');
      const now = W.iso(new Date());
      plan.suppliers = { ...plan.suppliers, [arrangementKey]: { status, source, evidence, fingerprint: arrangementFingerprint(arrangement), actor: scope.actor, at: now } };
      plan.revision++; plan.updated_at = now;
      plan.history.unshift({ id: W.newId(), revision: plan.revision, action: 'SUPPLIER_EVIDENCE', note: `${status}: ${arrangement.title}`, created_at: now, actor: actorName(req.headers) });
    }
    if (action === 'approve-budget') {
      if (!rights.finance) return conflict('Another authorized finance reviewer must approve these costs.');
      if (total(plan.draft) > plan.draft.budgetMinor) return conflict('The estimate exceeds the budget. Agree a revised budget or reduce the costs before approval.');
      plan.budgetApproved = true; plan.approvedBy = scope.actor; plan.revision++; plan.updated_at = W.iso(new Date());
    }
    if (action === 'publish') {
      const problem = validateDraft(plan.draft, scope, plan.squad_id, plan.draft, req.headers); if (problem) return problem;
      if (!plan.draft.activities.length || !plan.draft.participants.length) return bad('Add an activity and select the travelling players before sharing.');
      plan.published_version++; plan.published_revision = plan.revision; plan.published = itinerary(plan);
      plan.history.unshift({ id: W.newId(), action: 'PUBLISHED', created_at: W.iso(new Date()), actor: actorName(req.headers) }); rememberPublication(plan);
    }
    return viewPlan(plan, req.headers);
  });
}
