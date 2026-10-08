import { http, HttpResponse } from 'msw';
import { currentUserId, users } from '../data/store';
import { createUser } from '../data/factories';
import { getMockTournament } from './tournaments';
import type { Referee } from '../../features/matchExchange/api';
import type { TournamentRefereeAppointment } from '../../features/tournaments/refereeApi';

const API = '*/api';
const appointments: TournamentRefereeAppointment[] = [];
const snapshots = new Map<number, string>();
const windows = new Map<number, { id: number; starts_at: string; ends_at: string }[]>();
const profiles = new Map<number, Referee>();
let nextId = 1;
export function resetMockTournamentReferees() { appointments.length = 0; snapshots.clear(); windows.clear(); profiles.clear(); nextId = 1; }
const fail = (error: string, status = 409) => HttpResponse.json({ error }, { status });
const live = (a: TournamentRefereeAppointment) => ['INVITED', 'ACCEPTED'].includes(a.status);
function seed() {
  if (!users().has(9001)) users().set(9001, createUser({ id: 9001, email: 'referee@test.dev', password: 'mock', role: 'REFEREE', fullName: 'Alex Morgan', dob: '1990-01-01' }));
  for (const u of users().values()) if (u.role === 'REFEREE' && !profiles.has(u.id)) profiles.set(u.id, {
    user_id: u.id, full_name: u.fullName ?? u.name ?? 'Referee', published: true, biography: 'Local demo referee',
    qualifications: 'Self-reported demo experience', formats: '7_A_SIDE,11_A_SIDE', languages: 'English', service_area: 'Cardiff',
    travel_km: 50, accepts_paid: true, accepts_volunteer: true, fee: 30, currency: 'GBP', timezone: 'Europe/London', revision: 0, career: [], match_history: [],
  });
}
function sync() {
  for (const a of appointments) {
    const t = getMockTournament(a.tournament_id), f = t.fixtures.find(item => item.id === a.fixture_id);
    if (live(a) && (!f || t.status === 'CANCELLED' || f.status === 'CANCELLED' || snapshots.get(a.id) !== JSON.stringify([f.scheduledAt, f.locationId, f.linkedMatchId]))) a.status = 'CANCELLED';
    a.fixture_status = f?.status ?? 'CANCELLED'; a.tournament_status = t.status;
  }
}
function operator(tournament: number) {
  return getMockTournament(tournament).staffAssignments.some(s => s.userId === currentUserId() && s.status === 'ACTIVE' && ['ADMIN', 'STAFF'].includes(s.role));
}
function referee() { seed(); return currentUserId() != null && users().get(currentUserId()!)?.role === 'REFEREE'; }
function wallInstant(value: string, timezone: string) {
  const wall = Date.parse(value.slice(0, 19) + 'Z');
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let result = wall;
  for (let n = 0; n < 3; n++) result += wall - Date.parse(formatter.format(new Date(result)).replace(' ', 'T') + 'Z');
  return result;
}
function privateRows(tournament: number, fixture: number) {
  sync(); const staff = operator(tournament);
  return appointments.filter(a => a.tournament_id === tournament && a.fixture_id === fixture && (staff || a.referee_id === currentUserId() || a.status === 'ACCEPTED'))
    .map(a => staff || a.referee_id === currentUserId() ? a : { ...a, fee: null, currency: null, report: null, report_submitted_at: null });
}

export function mockTournamentRefereeCalendar(user: number) {
  sync(); seed(); const timezone = profiles.get(user)?.timezone ?? 'UTC';
  const local = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T');
  return appointments.filter(a => a.referee_id === user && a.status === 'ACCEPTED' && a.fixture_status !== 'CANCELLED').map(a => ({
    eventId: -a.id, occurrenceId: `tournament-referee:${a.id}@${local(a.starts_at)}`, clubId: null, clubName: null, userId: null,
    eventType: 'MATCH', title: `${a.tournament_name} · ${a.duty}`, description: `Tournament referee appointment. Times: ${timezone}`,
    startsAt: local(a.starts_at), endsAt: local(a.ends_at), locationName: null, locationLat: null, locationLng: null,
    visibility: 'PRIVATE', publishAt: null, publicNow: false, recurring: false, recurrence: null,
    opponentClubId: null, opponentClubName: null, challengeStatus: null, status: a.fixture_status, hasConflict: false, conflictingEventIds: [],
  }));
}

export const tournamentRefereeHandlers = [
  http.get(`${API}/referees`, ({ request }) => {
    seed(); const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
    const items = [...profiles.values()].filter(p => p.published && `${p.full_name} ${p.service_area} ${p.languages}`.toLowerCase().includes(q));
    return HttpResponse.json({ items, total: items.length });
  }),
  http.get(`${API}/referees/me`, () => referee() ? HttpResponse.json({ profile: profiles.get(currentUserId()!), appointments: [], availability: windows.get(currentUserId()!) ?? [] }) : fail('An active referee role is required.', 403)),
  http.get(`${API}/referees/:id`, ({ params }) => { seed(); return profiles.has(Number(params.id)) ? HttpResponse.json(profiles.get(Number(params.id))) : fail('Referee not found.', 404); }),
  http.post(`${API}/referees/me/availability`, async ({ request }) => {
    if (!referee()) return fail('An active referee role is required.', 403);
    const r = await request.json() as { startsAt: string; endsAt: string };
    if (!(Date.parse(r.startsAt) < Date.parse(r.endsAt))) return fail('Choose a complete availability window.', 400);
    const user = currentUserId()!, current = windows.get(user) ?? [];
    current.push({ id: nextId++, starts_at: r.startsAt, ends_at: r.endsAt }); windows.set(user, current);
    return new HttpResponse(null, { status: 200 });
  }),
  http.delete(`${API}/referees/me/availability/:id`, ({ params }) => {
    if (!referee()) return fail('An active referee role is required.', 403);
    windows.set(currentUserId()!, (windows.get(currentUserId()!) ?? []).filter(w => w.id !== Number(params.id)));
    return new HttpResponse(null, { status: 200 });
  }),
  http.get(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/referees`, ({ params }) => {
    if (!currentUserId()) return fail('Sign in to view appointments.', 401);
    const t = getMockTournament(Number(params.tournamentId));
    if (t.visibility === 'PRIVATE' && !operator(t.id)) return fail('Private tournament.', 403);
    return HttpResponse.json(privateRows(t.id, Number(params.fixtureId)));
  }),
  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/referees`, async ({ params, request }) => {
    seed(); sync(); const t = getMockTournament(Number(params.tournamentId)), f = t.fixtures.find(item => item.id === Number(params.fixtureId));
    if (!operator(t.id)) return fail('Tournament operator permission required.', 403);
    if (!f?.scheduledAt || f.status !== 'SCHEDULED' || !['PLANNING', 'ACTIVE'].includes(t.status)) return fail('Set a future kickoff first.');
    const r = await request.json() as { refereeId: number; duty: string; volunteer: boolean; fee: number; currency: string; timezone: string; durationMinutes: number };
    const p = profiles.get(r.refereeId); if (!p) return fail('Referee not found.', 404);
    let start: number; try { start = wallInstant(f.scheduledAt, r.timezone); } catch { return fail('Choose a valid IANA time zone.', 400); }
    if (!(start > Date.now()) || !Number.isInteger(r.durationMinutes) || r.durationMinutes < 5 || r.durationMinutes > 480) return fail('Choose a future kickoff and valid duration.', 400);
    const end = start + r.durationMinutes * 60000;
    const crew = appointments.filter(a => a.fixture_id === f.id && a.tournament_id === t.id && live(a));
    if (crew.some(a => a.duty === r.duty || a.referee_id === r.refereeId)) return fail('This duty or referee already has a live invitation.');
    if (crew.some(a => a.timezone !== r.timezone || Date.parse(a.ends_at) !== end)) return fail('Use the same time zone and duration as the other appointments.');
    const a: TournamentRefereeAppointment = { id: nextId++, fixture_id: f.id, tournament_id: t.id, referee_id: r.refereeId,
      tournament_name: t.name, fixture_order: f.fixtureOrder ?? 0, home_name: f.homeLabel ?? 'Home', away_name: f.awayLabel ?? 'Away',
      full_name: p.full_name, duty: r.duty, status: 'INVITED', fixture_status: f.status, tournament_status: t.status,
      starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), timezone: r.timezone,
      volunteer: r.volunteer, fee: r.volunteer ? 0 : r.fee, currency: r.currency, report: null, report_submitted_at: null };
    appointments.push(a); snapshots.set(a.id, JSON.stringify([f.scheduledAt, f.locationId, f.linkedMatchId]));
    return new HttpResponse(null, { status: 200 });
  }),
  http.delete(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/referees/:id`, ({ params }) => {
    if (!operator(Number(params.tournamentId))) return fail('Tournament operator permission required.', 403);
    const a = appointments.find(a => a.id === Number(params.id) && a.tournament_id === Number(params.tournamentId) && a.fixture_id === Number(params.fixtureId));
    if (!a) return fail('Appointment not found.', 404);
    if (!live(a) || Date.parse(a.starts_at) <= Date.now()) return fail('This appointment can no longer be cancelled.');
    a.status = 'CANCELLED'; return new HttpResponse(null, { status: 200 });
  }),
  http.get(`${API}/referees/me/tournament-appointments`, () => {
    if (!referee()) return fail('An active referee role is required.', 403);
    sync(); return HttpResponse.json(appointments.filter(a => a.referee_id === currentUserId()));
  }),
  http.post(`${API}/referees/me/tournament-appointments/:id/decision`, async ({ params, request }) => {
    if (!referee()) return fail('An active referee role is required.', 403);
    sync(); const a = appointments.find(a => a.id === Number(params.id) && a.referee_id === currentUserId());
    if (!a) return fail('Appointment not found.', 404);
    const { action } = await request.json() as { action: string };
    if (Date.parse(a.starts_at) <= Date.now() || (action === 'WITHDRAW' ? a.status !== 'ACCEPTED' : a.status !== 'INVITED')) return fail('This appointment has already been answered.');
    if (action === 'ACCEPT') {
      if (!(windows.get(a.referee_id) ?? []).some(w => Date.parse(w.starts_at) <= Date.parse(a.starts_at) && Date.parse(w.ends_at) >= Date.parse(a.ends_at))) return fail('Add availability covering the whole appointment before accepting.');
      if (appointments.some(other => other.referee_id === a.referee_id && other.status === 'ACCEPTED' && Date.parse(other.starts_at) < Date.parse(a.ends_at) && Date.parse(other.ends_at) > Date.parse(a.starts_at))) return fail('You already have an overlapping appointment.');
    }
    const next = { ACCEPT: 'ACCEPTED', DECLINE: 'DECLINED', WITHDRAW: 'WITHDRAWN' }[action];
    if (!next) return fail('Choose accept, decline or withdraw.', 400);
    a.status = next; return new HttpResponse(null, { status: 200 });
  }),
  http.put(`${API}/referees/me/tournament-appointments/:id/report`, async ({ params, request }) => {
    if (!referee()) return fail('An active referee role is required.', 403);
    sync(); const a = appointments.find(a => a.id === Number(params.id) && a.referee_id === currentUserId());
    if (!a) return fail('Appointment not found.', 404);
    if (a.status !== 'ACCEPTED' || a.fixture_status === 'CANCELLED' || Date.parse(a.ends_at) > Date.now()) return fail('Reports become available after the appointment ends.');
    const { body } = await request.json() as { body: string };
    if (!body?.trim() || body.length > 4000) return fail('Enter a report of up to 4000 characters.', 400);
    a.report = body.trim(); a.report_submitted_at = new Date().toISOString(); return new HttpResponse(null, { status: 200 });
  }),
];
