import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TournamentFixtureReferees } from '../TournamentFixtureReferees';
import { TournamentRefereeInbox } from '../TournamentRefereeInbox';
import { get, post, remove, put } from '../../../matchExchange/api';
import type { TournamentRefereeAppointment } from '../../refereeApi';

vi.mock('../../../matchExchange/api', () => ({ get: vi.fn(), post: vi.fn(), remove: vi.fn(), put: vi.fn() }));
const appointment: TournamentRefereeAppointment = {
  id: 51, fixture_id: 2, tournament_id: 1, referee_id: 8, tournament_name: 'Academy Cup', fixture_order: 1,
  home_name: 'Home', away_name: 'Away', full_name: 'Alex Official', duty: 'REFEREE', status: 'INVITED', fixture_status: 'SCHEDULED', tournament_status: 'ACTIVE',
  starts_at: '2099-05-12T09:00:00Z', ends_at: '2099-05-12T10:30:00Z', timezone: 'Europe/London', volunteer: false, fee: 30, currency: 'EUR', report: null, report_submitted_at: null,
};
let appointments: TournamentRefereeAppointment[];
beforeEach(() => {
  vi.clearAllMocks(); appointments = [];
  vi.mocked(get).mockImplementation(async path => path.startsWith('/referees?q=') ? { items: [{ user_id: 8, full_name: 'Alex Official', service_area: 'Cardiff', fee: 30, currency: 'EUR', accepts_paid: true, accepts_volunteer: true }] } : appointments);
});
const show = (manage = true, kickoff: string | null = '2099-05-12T10:00:00') => render(<MemoryRouter><TournamentFixtureReferees tournamentId={1} fixtureId={2} canManage={manage} scheduledAt={kickoff} open /></MemoryRouter>);

it('sends explicit time zone, duration and agreed fee, then shows the pending invitation', async () => {
  const user = userEvent.setup();
  vi.mocked(post).mockImplementation(async () => { appointments = [appointment]; });
  show();
  await screen.findByText('No referee appointments yet.');
  await user.click(screen.getByText('Invite a referee'));
  await user.selectOptions(screen.getByLabelText('Referee', { exact: true }), '8');
  await user.clear(screen.getByLabelText('Kickoff time zone'));
  await user.type(screen.getByLabelText('Kickoff time zone'), 'Europe/London');
  await user.click(screen.getByRole('button', { name: 'Send invitation' }));
  expect(post).toHaveBeenCalledWith('/tournaments/1/fixtures/2/referees', { refereeId: 8, duty: 'REFEREE', volunteer: false, fee: 30, currency: 'EUR', timezone: 'Europe/London', durationMinutes: 90 });
  expect(await screen.findByRole('link', { name: 'Alex Official' })).toBeVisible();
  expect(screen.getByLabelText('Kickoff time zone')).toBeDisabled();
});
it('retains a failed invitation and does not invent a confirmed appointment', async () => {
  vi.mocked(post).mockRejectedValue({ response: { status: 409, data: { error: 'This duty already has a live invitation.' } } });
  show(); await userEvent.click(screen.getByText('Invite a referee'));
  await userEvent.selectOptions(await screen.findByLabelText('Referee', { exact: true }), '8');
  await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This duty already has a live invitation.');
  expect(screen.getByLabelText('Referee', { exact: true })).toHaveValue('8');
  expect(screen.queryByRole('link', { name: 'Alex Official' })).not.toBeInTheDocument();
});
it('shows assignments without management controls to viewers and needs kickoff before inviting', async () => {
  appointments = [appointment];const view = show(false);
  await screen.findByRole('link', { name: 'Alex Official' });
  expect(screen.queryByText('Invite a referee')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument();
  view.unmount();show(true, null);
  expect(screen.getByText('Set the kickoff to invite a referee.')).toBeVisible();
});
it('cancels an appointment and refreshes its status', async () => {
  appointments = [appointment];
  vi.mocked(remove).mockImplementation(async () => { appointments = [{ ...appointment, status: 'CANCELLED' }]; });
  show();await userEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
  expect(remove).toHaveBeenCalledWith('/tournaments/1/fixtures/2/referees/51');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument());
});
it('lets a referee accept and withdraw, with failures kept actionable', async () => {
  appointments = [appointment];
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 409, data: { error: 'Add an availability window covering this entire match before accepting.' } } })
    .mockImplementationOnce(async () => { appointments = [{ ...appointment, status: 'ACCEPTED' }]; })
    .mockImplementationOnce(async () => { appointments = [{ ...appointment, status: 'WITHDRAWN' }]; });
  render(<MemoryRouter><TournamentRefereeInbox /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'Accept' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Add an availability window');
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
  expect(await screen.findByRole('link', { name: 'My schedule' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument());
  expect(post).toHaveBeenLastCalledWith('/referees/me/tournament-appointments/51/decision', { action: 'WITHDRAW' });
});
it('submits a post-match report and never offers report editing before the appointment ends', async () => {
  appointments = [{ ...appointment, status: 'ACCEPTED', starts_at: '2020-01-01T10:00:00Z', ends_at: '2020-01-01T11:30:00Z' }];
  vi.mocked(put).mockResolvedValue(undefined);
  render(<MemoryRouter><TournamentRefereeInbox /></MemoryRouter>);
  await userEvent.click(await screen.findByText('Submit match report'));
  await userEvent.type(screen.getByLabelText('Report'), 'Match completed.');
  await userEvent.click(screen.getByRole('button', { name: 'Save report' }));
  expect(put).toHaveBeenCalledWith('/referees/me/tournament-appointments/51/report', { body: 'Match completed.' });
});
