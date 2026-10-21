// Single training sessions: the existing squad API, shared by calendar and guided work.
import { get, post } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as P from '../pages-data.mjs';
import { canSelectSessionPlayer, squadAccess } from '../squad-access.mjs';
import { squadSessionDto, squadSessionForViewer } from '../squad-session-dto.mjs';
import { confirmation } from '../world-profile.mjs';
import { workspaceContext, canWrite, denied, missing, bad, conflict, created } from './workspace-context.mjs';
const requests = new Map();
function context(req) {
  const squad = W.squadById(req.params.id);
  const ctx = squad && workspaceContext({ id: squad.clubId }, req.headers);
  return ctx && squad ? { ctx, squad } : null;
}
function dto(squad, event) {
  return { ...squadSessionDto(squad, event, { source: 'SINGLE' }), starts_at: W.iso(event.start), ends_at: W.iso(event.end) };
}
get('/squad-communication/:id/sessions', req => {
  const squad = W.squadById(req.params.id);
  if (!squad || !P.isPageClub(squad.clubId)) return undefined;
  const own = context(req);
  const staffRead = Boolean(own && (own.ctx.leadership || own.ctx.coaching.includes(squad.id) || own.ctx.modules.some(m => ['ATTENDANCE', 'DEVELOPMENT', 'READINESS'].includes(m.id) && (m.globalRead || m.readSquads.includes(squad.id)))));
  const canonical = squadAccess(squad, req.headers);
  const selected = req.query.get('playerId');
  // This trusted scoped READ permission is not a management or write grant.
  if (!canSelectSessionPlayer(squad, canonical, selected, { staffRead })) return denied();
  const from = req.query.get('from') ? new Date(req.query.get('from')) : new Date(Date.now() - 7 * 864e5), to = req.query.get('to') ? new Date(req.query.get('to')) : new Date(Date.now() + 28 * 864e5);
  const saved = W.events.filter(e => e.squadId === squad.id && ['TRAINING', 'MATCH'].includes(e.type));
  // Preserve the old programme's saved days/time while training setup moves to its own flow.
  const programme = P.trainingOf(P.clubPage(squad.clubId), squad.id).map(t => ({ ...t, type: 'TRAINING', title: `${squad.name} training`, location: t.ground?.name ?? null }));
  const programmeIds = new Set(programme.map(event => event.id));
  const events = [...new Map([...saved, ...programme].map(e => [e.id, e])).values()]
    .filter(e => e.end >= from && e.start <= to)
    .filter(e => selected == null || (e.invitedPlayerIds ?? squad.playerIds).includes(Number(selected))).sort((a, b) => a.start - b.start);
  return events.flatMap(e => {
    const source = e.invitationPlan ? 'LEGACY' : programmeIds.has(e.id) ? 'PROGRAMME' : 'SINGLE';
    const value = squadSessionForViewer(squad, e, req.headers, { selectedPlayerId: selected, staffRead, source });
    // Keep the original single-session API's absolute instants. Programme clocks
    // retain their existing local timetable representation and grouping.
    return value ? [source === 'SINGLE' ? { ...value, starts_at: W.iso(e.start), ends_at: W.iso(e.end) } : value] : [];
  });
});
post('/squad-communication/:id/sessions', req => {
  const found = context(req); if (!found) return denied();
  const { ctx, squad } = found, body = req.body ?? {};
  if (!ctx.leadership && !ctx.coaching.includes(squad.id) && !canWrite(ctx, 'ATTENDANCE', squad.id)) return denied();
  if (!body.title?.trim() || !body.requestId) return bad('Name the session and include its request identity.');
  const start = new Date(body.startsAt), end = new Date(body.endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return bad('Check the session start and end.');
  const key = `${ctx.actorId}:${squad.id}:${body.requestId}`, fingerprint = JSON.stringify({ title: body.title.trim(), startsAt: start.toISOString(), endsAt: end.toISOString(), location: body.location ?? '' });
  const prior = requests.get(key);
  if (prior) {
    if (prior.fingerprint !== fingerprint) return conflict('This request already saved different session details. Refresh the session.');
    const event = W.events.find(e => e.id === prior.id); return event ? dto(squad, event) : missing();
  }
  const event = { id: C.nextId(), clubId: ctx.clubId, squadId: squad.id, type: 'TRAINING', title: body.title.trim(), start, end, location: body.location ?? '', revision: 1, venueId: null, pitch: '', status: 'SCHEDULED', seriesId: null, responseRequested: false, visibility: 'PRIVATE', publicationState: 'PRIVATE' };
  W.events.push(event); confirmation.set(event.id, false); requests.set(key, { id: event.id, fingerprint }); return created(dto(squad, event));
});

