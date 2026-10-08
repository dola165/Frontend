import { http, HttpResponse } from 'msw';
import { currentUserId, users } from '../data/store';
import type { SaveVolunteerShift, VolunteerShift, VolunteerSource } from '../../features/volunteers/api';

// Opt-in local demo only. Production has no volunteer-shift API; the capability
// gate hides this surface unless mocks are explicitly enabled.
const owner = 2;
const source: VolunteerSource = { id: 1, kind: 'TOURNAMENT', title: 'Summer Cup 2026', visibility: 'PUBLIC' };
const tomorrow = new Date(Date.now() + 86400000); tomorrow.setMinutes(0, 0, 0);
const shifts = new Map<number, VolunteerShift>([[501, {
  id: 501, eventId: null, tournamentId: 1, sourceTitle: source.title, title: 'Welcome desk & team check-in', description: 'Welcome arriving squads, help families find their pitch and check teams in with the event coordinator.',
  meetingPoint: 'Main entrance, beside the registration tent', startsAt: tomorrow.toISOString(), endsAt: new Date(tomorrow.getTime() + 7200000).toISOString(), capacity: 4, signupCount: 0,
  status: 'OPEN', cancellationReason: null, signedUp: false, canManage: false, canJoin: true, volunteers: [],
  tasks: [{ id: 601, label: 'Set out team check-in signs', completed: false, canToggle: false }, { id: 602, label: 'Collect registration materials', completed: false, canToggle: false }],
}]]);
const completions = new Map<number, number>();
let nextId = 700;
const fail = (error: string, status = 409) => HttpResponse.json({ error }, { status });
const projection = (shift: VolunteerShift, viewer: number): VolunteerShift => {
  const manager = viewer === owner, mine = shift.volunteers.some(v => v.userId === viewer);
  return { ...shift, canManage: manager, signedUp: mine, signupCount: shift.volunteers.length,
    canJoin: shift.status === 'OPEN' && !mine && shift.volunteers.length < shift.capacity && new Date(shift.startsAt).getTime() > Date.now(),
    volunteers: manager ? shift.volunteers : [], tasks: shift.tasks.map(t => ({ ...t, canToggle: shift.status === 'OPEN' && (manager || (mine && (!t.completed || completions.get(t.id) === viewer))) })) };
};
const base = '*/api/volunteer-shifts';
export const volunteerHandlers = [
  http.get(`${base}/sources`, () => currentUserId() === null ? fail('Sign in to continue.', 401) : HttpResponse.json(currentUserId() === owner ? [source] : [])),
  http.get(base, ({ request }) => {
    const uid = currentUserId(); if (uid === null) return fail('Sign in to continue.', 401);
    const p = new URL(request.url).searchParams, view = p.get('view'), page = Math.max(0, Number(p.get('page') || 0));
    const rows = [...shifts.values()].map(s => projection(s, uid)).filter(s => (!p.has('eventId') || s.eventId === Number(p.get('eventId'))) && (!p.has('tournamentId') || s.tournamentId === Number(p.get('tournamentId')))
      && (view === 'mine' ? s.signedUp : view === 'manage' ? s.canManage : s.status === 'OPEN' && new Date(s.startsAt).getTime() > Date.now())).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return HttpResponse.json({ items: rows.slice(page * 30, page * 30 + 30), hasMore: rows.length > page * 30 + 30 });
  }),
  http.get(`${base}/:id`, ({ params }) => { const uid = currentUserId(), shift = shifts.get(Number(params.id)); return uid === null ? fail('Sign in to continue.', 401) : shift ? HttpResponse.json(projection(shift, uid)) : fail('Shift not found.', 404); }),
  http.post(base, async ({ request }) => save(request)),
  http.put(`${base}/:id`, async ({ request, params }) => save(request, Number(params.id))),
  http.post(`${base}/:id/signup`, ({ params }) => {
    const uid = currentUserId(), shift = shifts.get(Number(params.id)); if (uid === null) return fail('Sign in to continue.', 401); if (!shift) return fail('Shift not found.', 404);
    if (shift.status !== 'OPEN') return fail('This shift is closed.');
    if (shift.volunteers.some(v => v.userId === uid)) return HttpResponse.json(projection(shift, uid));
    if (!projection(shift, uid).canJoin) return fail('This shift is full or has already started.');
    if ([...shifts.values()].some(s => s.status === 'OPEN' && s.volunteers.some(v => v.userId === uid) && new Date(s.startsAt) < new Date(shift.endsAt) && new Date(s.endsAt) > new Date(shift.startsAt))) return fail('You are already volunteering during this time.');
    shift.volunteers.push({ id: ++nextId, userId: uid, name: users().get(uid)?.fullName ?? 'Demo volunteer', signedUpAt: new Date().toISOString() });
    return HttpResponse.json(projection(shift, uid));
  }),
  http.delete(`${base}/:id/signup`, ({ params }) => {
    const uid = currentUserId(), shift = shifts.get(Number(params.id)); if (uid === null) return fail('Sign in to continue.', 401); if (!shift) return fail('Shift not found.', 404);
    shift.volunteers = shift.volunteers.filter(v => v.userId !== uid); return HttpResponse.json(projection(shift, uid));
  }),
  http.post(`${base}/:id/cancel`, async ({ request, params }) => {
    const uid = currentUserId(), shift = shifts.get(Number(params.id)); if (uid !== owner) return fail('Only coordinators can cancel a shift.', 403); if (!shift) return fail('Shift not found.', 404);
    const { reason } = await request.json() as { reason: string }; if (!reason?.trim() || reason.length > 500) return fail('Add a cancellation reason.', 400);
    shift.status = 'CANCELLED'; shift.cancellationReason = reason.trim(); return HttpResponse.json(projection(shift, uid));
  }),
  http.put(`${base}/:id/tasks/:taskId`, async ({ request, params }) => {
    const uid = currentUserId(), shift = shifts.get(Number(params.id)); if (uid === null) return fail('Sign in to continue.', 401); if (!shift) return fail('Shift not found.', 404);
    const task = shift.tasks.find(t => t.id === Number(params.taskId)), visible = projection(shift, uid).tasks.find(t => t.id === Number(params.taskId));
    if (!task) return fail('Task not found.', 404); if (!visible?.canToggle) return fail('You cannot change this task.', 403);
    const { completed } = await request.json() as { completed: boolean }; task.completed = completed; if (completed) completions.set(task.id, uid); else completions.delete(task.id);
    return HttpResponse.json(projection(shift, uid));
  }),
];
async function save(request: Request, id?: number) {
  const uid = currentUserId(); if (uid !== owner) return fail('Only coordinators can manage shifts.', 403);
  const b = await request.json() as SaveVolunteerShift;
  if (!b.title?.trim() || b.title.length > 140 || b.eventId !== null || b.tournamentId !== source.id || !(b.capacity >= 1 && b.capacity <= 500) || !Number.isInteger(b.capacity) || !Array.isArray(b.tasks) || b.tasks.length > 30 || b.tasks.some(t => typeof t !== 'string' || !t.trim() || t.length > 200) || new Set(b.tasks.map(t => t.trim())).size !== b.tasks.length
      || !Number.isFinite(Date.parse(b.startsAt)) || !Number.isFinite(Date.parse(b.endsAt)) || new Date(b.startsAt) <= new Date() || new Date(b.endsAt) <= new Date(b.startsAt)) return fail('Check the shift details.', 400);
  const existing = id ? shifts.get(id) : undefined;
  if (id && !existing) return fail('Shift not found.', 404);
  if (existing?.status === 'CANCELLED') return fail('This shift is closed.');
  if ((existing?.volunteers.length ?? 0) > b.capacity) return fail('Capacity cannot be lower than the confirmed volunteers.');
  const shift: VolunteerShift = { ...b, id: id ?? ++nextId, sourceTitle: source.title, status: 'OPEN', cancellationReason: null, signedUp: false, canManage: true, canJoin: true, signupCount: 0, volunteers: existing?.volunteers ?? [],
    tasks: b.tasks.map(label => existing?.tasks.find(t => t.label === label.trim()) ?? { id: ++nextId, label: label.trim(), completed: false, canToggle: true }) };
  shifts.set(shift.id, shift); return HttpResponse.json(projection(shift, uid), { status: id ? 200 : 201 });
}
