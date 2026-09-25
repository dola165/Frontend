import { setupServer } from 'msw/node';
import { currentUserId, users } from '../../data/store';
import { createUser } from '../../data/factories';
import { getMockTournament } from '../tournaments';
import { tournamentRefereeHandlers, resetMockTournamentReferees, mockTournamentRefereeCalendar } from '../tournamentReferees';

const server = setupServer(...tournamentRefereeHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  resetMockTournamentReferees();
  users().set(2, createUser({ id: 2, email: 'organizer@test.dev', password: 'mock', role: 'ORGANIZER', fullName: 'Sarah Chen' }));
  currentUserId(2);
  const t = getMockTournament(1);t.status = 'ACTIVE';t.fixtures[0].status = 'SCHEDULED';t.fixtures[0].scheduledAt = '2099-05-12T10:00:00';
});
const request = (path: string, method = 'GET', body?: unknown) => fetch(`http://localhost/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) });
const fixturePath = '/tournaments/1/fixtures/1/referees';
async function invite() {
  expect((await request('/referees')).status).toBe(200);
  expect((await request(fixturePath, 'POST', { refereeId: 9001, duty: 'REFEREE', timezone: 'Europe/London', durationMinutes: 90, volunteer: true, fee: 0, currency: 'GBP' })).status).toBe(200);
  return (await (await request(fixturePath)).json())[0].id as number;
}
it('runs invite, availability, acceptance, calendar projection and fixture-change invalidation in the local demo', async () => {
  const id = await invite(); currentUserId(9001);
  const decision = `/referees/me/tournament-appointments/${id}/decision`;
  expect((await request(decision, 'POST', { action: 'ACCEPT' })).status).toBe(409);
  await request('/referees/me/availability', 'POST', { startsAt: '2099-05-12T08:00:00Z', endsAt: '2099-05-12T12:00:00Z' });
  expect((await request(decision, 'POST', { action: 'ACCEPT' })).status).toBe(200);
  const calendar = mockTournamentRefereeCalendar(9001);
  expect(calendar[0].startsAt).toBe('2099-05-12T10:00:00');
  expect(calendar[0].occurrenceId).toContain('tournament-referee:');
  getMockTournament(1).fixtures[0].scheduledAt = '2099-05-12T12:00:00';
  const inbox = await (await request('/referees/me/tournament-appointments')).json();
  expect(inbox[0].status).toBe('CANCELLED');
  expect(mockTournamentRefereeCalendar(9001)).toHaveLength(0);
});
it('restricts invitation management to the tournament operator in the local demo', async () => {
  const id = await invite();currentUserId(9001);
  expect((await request(`${fixturePath}/${id}`, 'DELETE')).status).toBe(403);
  expect((await request(fixturePath, 'POST', {})).status).toBe(403);
  currentUserId(2);expect((await request(`${fixturePath}/${id}`, 'DELETE')).status).toBe(200);
});
