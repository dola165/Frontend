// Synthetic adapter for the existing frontend squad event preview/commit contract. No public listings or bookings.
import { get, post, reply, handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as S from '../world-social.mjs';
import * as P from '../world-profile.mjs';
import { squadAccess } from '../squad-access.mjs';

const receipts = new Map();
const publicPass = Symbol('public-training-projection');
// Private invitations never become public timetable entries just because they share the session store.
get('/clubs/:id/squads/:sid/training-schedule', async req => {
  if (req.headers[publicPass]) return undefined;
  const privateIds = new Set(W.events.filter(event => event.invitationPlan && event.squadId === Number(req.params.sid)).map(event => event.id));
  if (!privateIds.size) return undefined;
  const result = await handleApi({ ...req, headers: { ...req.headers, [publicPass]: true } });
  if (!result?.body?.sessions) return result ? reply(result.status, result.body, result.headers) : undefined;
  return reply(result.status, { ...result.body, sessions: result.body.sessions.filter(session => !privateIds.has(Number(session.id))) }, result.headers);
});
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const fail = (message, status = 400) => reply(status, { status, message });
const parts = (instant, timezone) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
const stamp = p => `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
function wallInstant(day, time, timezone) {
  const wall = `${day}T${time}`, expected = Date.parse(`${wall}Z`);
  let at = expected;
  for (let i = 0; i < 3; i++) at += expected - Date.parse(`${stamp(parts(new Date(at), timezone))}Z`);
  if (stamp(parts(new Date(at), timezone)) !== wall) throw new Error('This time does not exist in the selected time zone.');
  return new Date(at);
}
function prepare(squad, plan) {
  if (!plan?.requestId || !String(plan.title ?? '').trim() || String(plan.title).length > 200 || !Array.isArray(plan.playerIds) || plan.playerIds.some(id => !squad.playerIds.includes(id))) throw new Error('Review the training name and current squad invitation list.');
  if (plan.eventType !== 'TRAINING' || !String(plan.location ?? '').trim()) throw new Error('Add a training ground.');
  const start = new Date(plan.startsAt), end = new Date(plan.endsAt);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || start <= new Date()) throw new Error('Choose future training dates and a later finish time.');
  const first = parts(start, plan.timezone), finish = parts(end, plan.timezone);
  if (first.year !== finish.year || first.month !== finish.month || first.day !== finish.day) throw new Error('Choose training that starts and ends on the same day.');
  const occurrences = [];
  if (!plan.repeat) occurrences.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
  else {
    const repeat = plan.repeat, firstDay = `${first.year}-${first.month}-${first.day}`, lastDay = repeat.endDate;
    const from = Date.parse(`${firstDay}T00:00:00Z`), until = Date.parse(`${lastDay}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDay ?? '') || !Number.isFinite(until) || new Date(until).toISOString().slice(0, 10) !== lastDay || until < from || until - from > 366 * 86400000 || !Number.isInteger(repeat.intervalWeeks) || repeat.intervalWeeks < 1 || !repeat.daysOfWeek?.length || repeat.daysOfWeek.some(day => !DAYS.includes(day))) throw new Error('Choose training days and an end date within a year.');
    const monday = from - (new Date(from).getUTCDay() + 6) % 7 * 86400000;
    for (let day = from; day <= until; day += 86400000) {
      if (Math.floor((day - monday) / (7 * 86400000)) % repeat.intervalWeeks || !repeat.daysOfWeek.includes(DAYS[new Date(day).getUTCDay()])) continue;
      const date = new Date(day).toISOString().slice(0, 10);
      const a = wallInstant(date, `${first.hour}:${first.minute}:${first.second}`, plan.timezone), b = wallInstant(date, `${finish.hour}:${finish.minute}:${finish.second}`, plan.timezone);
      if (a < start) continue;
      occurrences.push({ startsAt: a.toISOString(), endsAt: b.toISOString() });
    }
  }
  if (!occurrences.length) throw new Error('No training dates match this plan.');
  const recipients = new Set([squad.headCoachId, ...(squad.clubId === 1 ? [S.STAFF.assistant, S.STAFF.gk] : [])].filter(Boolean));
  for (const id of plan.playerIds) {
    const guardians = W.parents.filter(link => link.childId === id).map(link => link.parentId);
    for (const person of guardians.length ? guardians : [id]) recipients.add(person);
  }
  return { occurrences, participantCount: new Set(plan.playerIds).size, notificationRecipients: recipients.size, requestResponses: !!plan.requestResponses,
    conflictingOccurrences: occurrences.filter(o => W.events.some(e => e.squadId === squad.id && !e.cancelled && e.start < new Date(o.endsAt) && e.end > new Date(o.startsAt))).length };
}
post('/squad-communication/:id/events/preview', ({ params, headers, body }) => {
  const squad = W.squadById(params.id);
  if (!squadAccess(squad, headers)?.canManage) return fail('Only the squad staff plan training.', 403);
  try { return prepare(squad, body); } catch (e) { return fail(e.message); }
});
post('/squad-communication/:id/events', ({ params, headers, body }) => {
  const squad = W.squadById(params.id), access = squadAccess(squad, headers);
  if (!access?.canManage) return fail('Only the squad staff plan training.', 403);
  const key = `${access.viewer}:${squad.id}:${body?.requestId}`, signature = JSON.stringify(body), prior = receipts.get(key);
  if (prior) return prior.signature === signature ? prior.result : fail('This request ID already belongs to another plan.', 409);
  let preview;
  try { preview = prepare(squad, body); } catch (e) { return fail(e.message); }
  const planId = `squad-training-${W.newId()}`;
  const sessions = preview.occurrences.map(o => ({ id: W.newId(), clubId: squad.clubId, squadId: squad.id, type: 'TRAINING', title: body.title.trim(), start: new Date(o.startsAt), end: new Date(o.endsAt),
    venueId: null, location: body.location.trim(), notes: body.description ?? null, coachId: squad.headCoachId, revision: 1, seriesId: body.repeat ? planId : null, invitedPlayerIds: [...new Set(body.playerIds)], invitationPlan: true, visibility: 'PRIVATE', publicationState: 'PRIVATE' }));
  for (const session of sessions) { W.events.push(session); P.confirmation.set(session.id, !!body.requestResponses); }
  const result = { planId, sessionIds: sessions.map(s => s.id) };
  receipts.set(key, { signature, result });
  return result;
});
