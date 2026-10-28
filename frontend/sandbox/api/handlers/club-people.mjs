// Invented Staff fixtures for the local sandbox only. No private or production records.
// Club office › Staff (step 2, 28 October 2026): everyone with a job reads it, with the email and the phone each person
// added on their profile, unless they hid them; admins change it. The viewer's own row follows the persona (Owner, head
// coach, physio, analyst) and its phone is the one added on their profile (none until they add it).
import { get, post, put, del } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as V from '../viewer.mjs';
import { profilePhone } from '../profile-phones.mjs';
import { scoped, denied, bad, missing, validateScope } from './workspace-context.mjs';
import { jobs, moreJobs, tools } from '../club-people-jobs.mjs';
const stores = new Map();
let nextId = 97000;
const squadsOf = (ctx, ids) => ctx.squads.filter(s => ids.includes(s.id)).map(({ id, name }) => ({ id, name }));
const jobFor = (ctx, job, title, squadIds = [], status = 'ACTIVE', id = nextId++) => ({ kind: 'APPOINTMENT', id, job, title,
  clubWide: !squadIds.length, squads: squadsOf(ctx, squadIds), status, unavailableReason: null, revision: 0,
  addedById: 1, addedByName: C.name(1), tools: [...jobs, ...moreJobs].find(j => j.key === job)?.tools ?? [], canChange: true, canEnd: true });
const leaderJob = (ctx, kind, id) => ({ ...jobFor(ctx, kind, kind === 'OWNER' ? 'Owner' : 'Admin', [], 'ACTIVE', id), kind, canChange: false, canEnd: false });
const person = (userId, name, email, phone, jobs, extra = {}) => ({ userId, name, email, phone, avatarUrl: null, needsLink: false, jobs, ...extra });
const HELPERS = ['ASSISTANT_COACH', 'TEAM_MANAGER'];
// Every job holder reads Staff (SEE_STAFF); a plain member doesn't.
const staffOnly = ctx => ctx.persona === 'member' || !ctx.leadership && !ctx.coaching.length && !ctx.modules.length;

function store(ctx) {
  if (!stores.has(ctx.clubId)) {
    const demo = ctx.clubId === C.CLUB_ID;
    const people = demo ? [
      person(C.STAFF.director, C.name(C.STAFF.director), 'director@academy.example.test', '+995 555 10 20 30', [leaderJob(ctx, 'ADMIN', 96010)]),
      person(97001, 'Nino Japaridze', 'nino.jobs@example.test', '+995 555 41 22 63', [jobFor(ctx, 'SPECIALIST_COACH', 'Goalkeeper coach', [103])]),
      person(97002, 'Giorgi Abashidze', 'giorgi.jobs@example.test', '+995 555 73 18 04', [jobFor(ctx, 'HEAD_OF_COACHING', 'Head of coaching')]),
      person(97003, 'Mariam Kalandadze', 'mariam.jobs@example.test', '+995 555 66 09 12', [jobFor(ctx, 'TRAVEL_COORDINATOR', 'Travel coordinator')]),
      person(C.STAFF.physio, C.name(C.STAFF.physio), 'physio@academy.example.test', '+995 555 38 47 91', [jobFor(ctx, 'PHYSIOTHERAPIST', 'Physio')]),
      person(97004, 'Tamar Lomidze', 'tamar.jobs@example.test', '+995 555 90 14 27', [jobFor(ctx, 'ASSISTANT_COACH', 'Assistant coach', [102], 'INVITED')], { needsLink: true }),
    ] : [];
    // Giorgi keeps his phone to himself.
    stores.set(ctx.clubId, { people, links: [], requests: new Map(), sharing: new Map(demo ? [[97002, { hideEmail: false, hidePhone: true }]] : []) });
    if (demo) stores.get(ctx.clubId).links.push(makeLink(ctx, { job: 'HEAD_COACH', clubWide: true }));
  }
  return stores.get(ctx.clubId);
}

/** The viewer's own row, from their club access now; a persona is Luka with another job, so the director owns the club. */
function ownRow(ctx) {
  const account = V.account(ctx.actorId);
  const name = account?.fullName ?? C.name(ctx.actorId);
  const coached = ctx.coaching.length ? ctx.coaching : [...C.myCoaching.squad_ids];
  const held = ctx.persona === 'physio' ? [jobFor(ctx, 'PHYSIOTHERAPIST', 'Physio', [], 'ACTIVE', 96003)]
    : ctx.persona === 'attendance' ? [{ ...jobFor(ctx, 'CUSTOM', 'Attendance helper', [], 'ACTIVE', 96006), tools: ['ATTENDANCE:WRITE'] }]
    : ctx.persona === 'analyst' ? [jobFor(ctx, 'ANALYST', 'Performance analyst', coached, 'ACTIVE', 96004)]
      : ctx.persona === 'headcoach' ? [jobFor(ctx, 'HEAD_COACH', 'Head coach', coached, 'ACTIVE', 96002)]
        : ctx.persona === 'member' ? []
          : ctx.role === 'OWNER' ? [leaderJob(ctx, 'OWNER', 96001), ...(ctx.coaching.length ? [jobFor(ctx, 'HEAD_COACH', 'Head coach', ctx.coaching, 'ACTIVE', 96002)] : [])]
            : ctx.leadership ? [leaderJob(ctx, 'ADMIN', 96005)] : [];
  return person(ctx.actorId, name, account?.email ?? 'luka.gelashvili@example.test', profilePhone(ctx.actorId), held);
}
const rows = ctx => {
  const state = store(ctx);
  const others = state.people.filter(p => p.userId !== ctx.actorId)
    .map(p => p.userId === C.STAFF.director && ctx.persona ? { ...p, jobs: [leaderJob(ctx, 'OWNER', 96011)] } : p);
  return [ownRow(ctx), ...others].filter(p => p.jobs.length);
};
/** Fellow staff see what each person shares; admins always see emails; nobody sees an invitee's phone. */
function contacts(ctx, p) {
  if (p.userId === ctx.actorId) return { email: p.email, phone: p.phone };
  const choice = store(ctx).sharing.get(p.userId) ?? { hideEmail: false, hidePhone: false };
  const invited = p.jobs.every(j => j.status === 'INVITED' || j.status === 'SUGGESTED');
  return { email: ctx.leadership || !choice.hideEmail ? p.email : null, phone: invited || choice.hidePhone ? null : p.phone };
}
/** Duties someone has today, from Staff duties. */
const dutiesOf = (ctx, userId) => ctx.state.records.filter(r => r.kind === 'DUTY' && r.assigned_user_id === userId && !['CANCELLED', 'COMPLETED'].includes(r.status)
  && String(r.data.startsAt ?? '').slice(0, 10) === C.date(0))
  .map(r => ({ id: r.id, title: r.title, startsAt: r.data.startsAt, endsAt: r.data.endsAt ?? null, location: r.data.location ?? null }));
const SERVICE = { PSYCHOLOGY: 'Sports psychologist', NUTRITION: 'Nutritionist', PHYSIOTHERAPY: 'Physiotherapist', VIDEO_ANALYSIS: 'Video analyst',
  STRENGTH_CONDITIONING: 'Strength & conditioning coach', MEDICAL: 'Doctor', LEGAL: 'Sports lawyer', PHOTOGRAPHY: 'Football photographer' };
/** Outside specialists the club works with now, from Specialists. */
const specialists = ctx => ctx.state.records.filter(r => r.kind === 'ENGAGEMENT' && r.status === 'ACTIVE' && (!r.data.endsOn || r.data.endsOn >= C.date(0)))
  .map(r => ({ id: r.id, name: r.data.specialist, specialisation: SERVICE[r.data.service] ?? null, contact: r.data.contact ?? null, startsAt: r.data.startsOn ?? null, endsAt: r.data.endsOn ?? null }));
const findJob = (ctx, id) => { for (const p of store(ctx).people) { const job = p.jobs.find(j => j.id === Number(id)); if (job) return { p, job }; } return null; };
const drop = (ctx, p, job) => { p.jobs = p.jobs.filter(j => j !== job); if (!p.jobs.length) store(ctx).people = store(ctx).people.filter(other => other !== p); };

function makeLink(ctx, body) {
  const selected = jobs.find(j => j.key === body.job), id = nextId++;
  return { id, job: body.job, title: body.title?.trim() || selected.title, tools: selected.tools,
    clubWide: Boolean(body.clubWide), squads: body.clubWide ? [] : squadsOf(ctx, body.squadIds ?? []), status: 'ACTIVE',
    code: 'sandbox-staff-' + id, path: '/staff-invite/sandbox-staff-' + id, uses: 0, maxUses: 10,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), createdById: ctx.actorId, createdByName: C.name(ctx.actorId), joined: [] };
}
/**
 * As the server lists them: admins see every job; a colleague sees the jobs people hold now, as job and where only,
 * and, in full, their own, the ones they suggested and those in the squads they coach. In a persona the director gave the jobs.
 */
function shown(ctx, p) {
  const full = j => ctx.leadership || p.userId === ctx.actorId || j.suggestedById === ctx.actorId || j.squads.some(s => ctx.coaching.includes(s.id));
  const given = j => ctx.persona && j.addedById === ctx.actorId && j.suggestedById !== ctx.actorId ? { ...j, addedById: C.STAFF.director, addedByName: C.name(C.STAFF.director) } : j;
  return p.jobs.flatMap(j => full(j) ? [given(j)] : j.status === 'ACTIVE' ? [{ ...j, tools: [], addedById: null, addedByName: null }] : []);
}
get('/clubs/:id/people', scoped(({ ctx }) => {
  if (staffOnly(ctx)) return denied();
  const mine = store(ctx).sharing.get(ctx.actorId) ?? { hideEmail: false, hidePhone: false };
  return { viewer: { userId: ctx.actorId, leader: ctx.leadership, owner: ctx.role === 'OWNER', headCoachSquads: ctx.coaching, ...mine },
    people: rows(ctx).map(p => ({ ...p, jobs: shown(ctx, p) })).filter(p => p.jobs.length).map(p => ({ ...p, ...contacts(ctx, p), onDuty: dutiesOf(ctx, p.userId),
      jobs: p.jobs.map(j => ({ ...j, canChange: ctx.leadership && j.kind === 'APPOINTMENT' && j.status !== 'SUGGESTED', canEnd: ctx.leadership && j.kind === 'APPOINTMENT' && j.status !== 'SUGGESTED',
        canConfirm: j.status === 'SUGGESTED' ? ctx.leadership : undefined })) })),
    nameChecks: [], squads: squadsOf(ctx, ctx.squads.map(s => s.id)), jobs, moreJobs, tools, specialists: specialists(ctx) };
}));
put('/clubs/:id/people/me/contact', scoped(({ ctx, body = {} }) => {
  if (staffOnly(ctx)) return denied();
  store(ctx).sharing.set(ctx.actorId, { hideEmail: Boolean(body.hideEmail), hidePhone: Boolean(body.hidePhone) });
  return {};
}));
put('/clubs/:id/people/jobs/:job', scoped(({ ctx, params, body = {} }) => {
  if (!ctx.leadership) return denied();
  const found = findJob(ctx, params.job);
  if (!found) return missing();
  const invalid = validateScope(ctx, body); if (invalid) return invalid;
  const selected = [...jobs, ...moreJobs].find(j => j.key === body.job);
  const whole = body.clubWide || ['ADMIN', 'HEAD_OF_COACHING'].includes(body.job);
  Object.assign(found.job, { job: body.job, title: body.title?.trim() || selected?.title || found.job.title, tools: body.tools ?? selected?.tools ?? found.job.tools,
    clubWide: whole, squads: whole ? [] : squadsOf(ctx, body.squadIds ?? []), revision: found.job.revision + 1, changedByName: C.name(ctx.actorId), changedAt: new Date().toISOString() });
  return {};
}));
post('/clubs/:id/people/jobs/:job/end', scoped(({ ctx, params }) => {
  if (!ctx.leadership) return denied();
  const found = findJob(ctx, params.job);
  if (!found) return missing();
  drop(ctx, found.p, found.job); return {};
}));
post('/clubs/:id/people/admins/:user/end', scoped(({ ctx, params }) => {
  if (!ctx.leadership) return denied();
  const p = store(ctx).people.find(other => other.userId === Number(params.user)), job = p?.jobs.find(j => j.kind === 'ADMIN');
  if (!job) return missing();
  drop(ctx, p, job); return {};
}));
post('/clubs/:id/people/:user/link', scoped(({ ctx, params }) => {
  if (!ctx.leadership) return denied();
  return store(ctx).people.some(p => p.userId === Number(params.user) && p.needsLink)
    ? { token: 'sandbox-invite-' + params.user + '-' + Date.now(), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() } : missing();
}));
// A head coach's suggestion waits for an admin; the first answer counts.
post('/clubs/:id/people/suggestions/:job', scoped(({ ctx, params, body = {} }) => {
  if (!ctx.leadership) return denied();
  const found = findJob(ctx, params.job);
  if (!found || found.job.status !== 'SUGGESTED') return bad('This suggestion was already answered.');
  if (!body.confirm) { drop(ctx, found.p, found.job); return { appointmentId: found.job.id, outcome: 'DECLINED', answeredBy: C.name(ctx.actorId), link: null }; }
  Object.assign(found.job, { status: 'INVITED', addedById: ctx.actorId, addedByName: C.name(ctx.actorId) }); found.p.needsLink = true;
  return { appointmentId: found.job.id, outcome: 'CONFIRMED', answeredBy: C.name(ctx.actorId), link: { token: 'sandbox-invite-' + found.p.userId, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() } };
}));
get('/clubs/:id/staff-links', scoped(({ ctx }) => ctx.leadership ? store(ctx).links : denied()));
post('/clubs/:id/staff-links', scoped(({ ctx, body = {} }) => {
  if (!ctx.leadership) return denied();
  if (!jobs.slice(0, 4).some(j => j.key === body.job)) return bad('Choose Head coach, Assistant coach, Team manager or Fees.');
  const invalid = validateScope(ctx, body); if (invalid) return invalid;
  if (!body.clubWide && !body.squadIds?.length) return bad('Choose the whole club or at least one squad.');
  if (!body.requestId) return bad('A request id is required.');
  const state = store(ctx), previous = state.requests.get(body.requestId);
  if (previous) return previous;
  const link = makeLink(ctx, body); state.links.unshift(link); state.requests.set(body.requestId, link); return link;
}));
del('/clubs/:id/staff-links/:link', scoped(({ ctx, params }) => {
  if (!ctx.leadership) return denied();
  const state = store(ctx), link = state.links.find(l => l.id === Number(params.link));
  if (!link) return missing();
  state.links = state.links.filter(l => l !== link); return { ...link, status: 'REVOKED', code: null, path: null };
}));
post('/clubs/:id/people/invites', scoped(({ ctx, body = {} }) => {
  const suggestion = !ctx.leadership && ctx.coaching.length > 0;
  if (!ctx.leadership && !suggestion) return denied();
  const selected = [...jobs, ...moreJobs].find(j => j.key === body.job);
  if (!selected && body.job !== 'CUSTOM') return bad('Choose a job.');
  if (!body.name?.trim() || !body.email?.includes('@')) return bad('Enter a name and email.');
  // A head coach suggests a helper for a squad they coach; an admin confirms it.
  if (suggestion && (!HELPERS.includes(body.job) || !body.squadIds?.length || body.squadIds.some(id => !ctx.coaching.includes(Number(id))))) return bad('Suggest an assistant coach or a team manager for a squad you coach.');
  if (body.job === 'CUSTOM' && (!body.title?.trim() || !body.tools?.length || body.tools.some(t => !tools.includes(t)))) return bad('Name the job and choose its tools.');
  const whole = body.clubWide || ['ADMIN', 'HEAD_OF_COACHING'].includes(body.job);
  const invalid = validateScope(ctx, body); if (invalid) return invalid;
  if (!whole && !body.squadIds?.length) return bad('Choose the whole club or at least one squad.');
  const title = body.title?.trim() || selected?.titles[0] || selected?.title;
  const job = jobFor(ctx, body.job, title, whole ? [] : body.squadIds, suggestion ? 'SUGGESTED' : 'INVITED');
  if (suggestion) Object.assign(job, { suggestedById: ctx.actorId, suggestedByName: C.name(ctx.actorId), revision: 1 });
  if (body.job === 'CUSTOM') job.tools = body.tools;
  const added = { userId: nextId++, name: body.name.trim(), email: body.email, phone: null, avatarUrl: null, needsLink: !suggestion, jobs: [job] };
  store(ctx).people.push(added);
  return { userId: suggestion ? null : added.userId, name: added.name, inApp: true, link: null, status: suggestion ? 'SUGGESTED' : 'INVITED' };
}));
