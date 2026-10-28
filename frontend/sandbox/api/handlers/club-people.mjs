// Invented People fixtures for the local sandbox only. No private or production records.
import { get, post, del } from '../router.mjs';
import * as C from '../world-club.mjs';
import { scoped, denied, bad, missing, validateScope } from './workspace-context.mjs';
import { jobs, moreJobs, tools } from '../club-people-jobs.mjs';
const stores = new Map();
let nextId = 97000;
const squadsOf = (ctx, ids) => ctx.squads.filter(s => ids.includes(s.id)).map(({ id, name }) => ({ id, name }));
const jobFor = (ctx, job, title, squadIds = [], status = 'ACTIVE') => ({ kind: 'APPOINTMENT', id: nextId++, job, title,
  clubWide: !squadIds.length, squads: squadsOf(ctx, squadIds), status, unavailableReason: null, revision: 0,
  addedById: 1, addedByName: C.name(1), tools: [...jobs, ...moreJobs].find(j => j.key === job)?.tools ?? [], canChange: true, canEnd: true });
function store(ctx) {
  if (!stores.has(ctx.clubId)) {
    const owner = { userId: ctx.actorId, name: C.name(ctx.actorId), email: null, avatarUrl: null, needsLink: false,
      jobs: [{ ...jobFor(ctx, 'OWNER', 'Owner'), kind: 'OWNER', canChange: false, canEnd: false }] };
    const people = ctx.clubId === C.CLUB_ID ? [owner,
      { userId: 97001, name: 'Nino Japaridze', email: 'nino.jobs@example.test', avatarUrl: null, needsLink: false, jobs: [jobFor(ctx, 'SPECIALIST_COACH', 'Goalkeeper coach', [103])] },
      { userId: 97002, name: 'Giorgi Abashidze', email: 'giorgi.jobs@example.test', avatarUrl: null, needsLink: false, jobs: [jobFor(ctx, 'HEAD_OF_COACHING', 'Head of coaching')] },
      { userId: 97003, name: 'Mariam Kalandadze', email: 'mariam.jobs@example.test', avatarUrl: null, needsLink: false, jobs: [jobFor(ctx, 'TRAVEL_COORDINATOR', 'Travel coordinator')] }] : [];
    stores.set(ctx.clubId, { people, links: [], requests: new Map() });
    if (ctx.clubId === C.CLUB_ID) stores.get(ctx.clubId).links.push(makeLink(ctx, { job: 'HEAD_COACH', clubWide: true }));
  }
  return stores.get(ctx.clubId);
}
function makeLink(ctx, body) {
  const selected = jobs.find(j => j.key === body.job), id = nextId++;
  return { id, job: body.job, title: body.title?.trim() || selected.title, tools: selected.tools,
    clubWide: Boolean(body.clubWide), squads: body.clubWide ? [] : squadsOf(ctx, body.squadIds ?? []), status: 'ACTIVE',
    code: 'sandbox-staff-' + id, path: '/staff-invite/sandbox-staff-' + id, uses: 0, maxUses: 10,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), createdById: ctx.actorId, createdByName: C.name(ctx.actorId), joined: [] };
}
get('/clubs/:id/people', scoped(({ ctx }) => {
  if (ctx.persona === 'member' || !ctx.leadership && !ctx.coaching.length && !ctx.modules.length) return denied();
  return { viewer: { userId: ctx.actorId, leader: ctx.leadership, owner: ctx.role === 'OWNER', headCoachSquads: ctx.coaching },
    people: store(ctx).people.map(p => ({ ...p, email: ctx.leadership ? p.email : null,
      jobs: p.jobs.map(j => ({ ...j, canChange: ctx.leadership && j.kind === 'APPOINTMENT', canEnd: ctx.leadership && j.kind === 'APPOINTMENT' })) })),
    nameChecks: [], squads: squadsOf(ctx, ctx.squads.map(s => s.id)), jobs, moreJobs, tools };
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
  if (!ctx.leadership) return denied();
  const selected = [...jobs, ...moreJobs].find(j => j.key === body.job);
  if (!selected && body.job !== 'CUSTOM') return bad('Choose a job.');
  if (!body.name?.trim() || !body.email?.includes('@')) return bad('Enter a name and email.');
  if (body.job === 'CUSTOM' && (!body.title?.trim() || !body.tools?.length || body.tools.some(t => !tools.includes(t)))) return bad('Name the job and choose its tools.');
  const whole = body.clubWide || ['ADMIN', 'HEAD_OF_COACHING'].includes(body.job);
  const invalid = validateScope(ctx, body); if (invalid) return invalid;
  if (!whole && !body.squadIds?.length) return bad('Choose the whole club or at least one squad.');
  const title = body.title?.trim() || selected?.titles[0] || selected?.title;
  const job = jobFor(ctx, body.job, title, whole ? [] : body.squadIds, 'INVITED');
  if (body.job === 'CUSTOM') job.tools = body.tools;
  const person = { userId: nextId++, name: body.name.trim(), email: body.email, avatarUrl: null, needsLink: false, jobs: [job] };
  store(ctx).people.push(person);
  return { userId: person.userId, name: person.name, inApp: true, link: null, status: 'INVITED' };
}));
