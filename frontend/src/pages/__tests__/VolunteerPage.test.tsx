import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { VolunteerPage } from '../VolunteerPage';
import * as api from '../../features/volunteers/api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'volunteer-test' }) }));
vi.mock('../../features/volunteers/api', () => ({ listShifts: vi.fn(), getShift: vi.fn(), getSources: vi.fn(), saveShift: vi.fn(), joinShift: vi.fn(), withdrawShift: vi.fn(), cancelShift: vi.fn(), setTaskComplete: vi.fn() }));
const shift: api.VolunteerShift = {
  id: 20, eventId: 7, tournamentId: null, sourceTitle: 'Academy open day', title: 'Welcome desk', description: 'Welcome the arriving families.', meetingPoint: 'Main entrance',
  startsAt: '2099-08-10T10:00:00Z', endsAt: '2099-08-10T12:00:00Z', capacity: 2, signupCount: 1, status: 'OPEN', cancellationReason: null,
  signedUp: false, canManage: false, canJoin: true, tasks: [{ id: 30, label: 'Set up signs', completed: false, canToggle: false }], volunteers: [],
};
const coordinator = { ...shift, canManage: true, volunteers: [{ id: 40, userId: 5, name: 'Mariam', signedUpAt: '2026-09-18T00:00:00Z' }] };
const open = (path = '/volunteering') => render(<MemoryRouter initialEntries={[path]}><VolunteerPage /></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listShifts).mockResolvedValue({ items: [shift], hasMore: false });
  vi.mocked(api.getShift).mockResolvedValue(shift);
  vi.mocked(api.getSources).mockResolvedValue([]);
});
it('opens a discoverable shift and reserves a place without exposing a roster', async () => {
  vi.mocked(api.joinShift).mockResolvedValue({ ...shift, signupCount: 2, signedUp: true, canJoin: false });
  const user = userEvent.setup(); open();
  await user.click(await screen.findByRole('button', { name: 'View shift →' }));
  await user.click(await screen.findByRole('button', { name: 'Reserve my place' }));
  expect(api.joinShift).toHaveBeenCalledWith(20);
  expect(await screen.findByRole('button', { name: 'Withdraw from shift' })).toBeVisible();
  expect(screen.queryByText(/Confirmed volunteers \(/)).not.toBeInTheDocument();
});
it('shows a capacity race error without pretending the signup succeeded', async () => {
  vi.mocked(api.joinShift).mockRejectedValue({ response: { data: { error: 'This shift is full.' } } });
  const user = userEvent.setup(); open('/volunteering?shift=20');
  await user.click(await screen.findByRole('button', { name: 'Reserve my place' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This shift is full.');
  expect(screen.queryByRole('button', { name: 'Withdraw from shift' })).not.toBeInTheDocument();
});
it('withdraws only the current user through the self-service endpoint', async () => {
  vi.mocked(api.getShift).mockResolvedValue({ ...shift, signedUp: true, canJoin: false });
  vi.mocked(api.withdrawShift).mockResolvedValue(shift);
  const user = userEvent.setup(); open('/volunteering?shift=20');
  await user.click(await screen.findByRole('button', { name: 'Withdraw from shift' }));
  expect(api.withdrawShift).toHaveBeenCalledWith(20);
  expect(await screen.findByRole('button', { name: 'Reserve my place' })).toBeVisible();
});
it('creates a persisted event-linked shift with explicit instants and separate task labels', async () => {
  vi.mocked(api.getSources).mockResolvedValue([{ id: 7, kind: 'EVENT', title: 'Academy open day', visibility: 'PUBLIC' }]);
  vi.mocked(api.saveShift).mockResolvedValue(coordinator);
  const user = userEvent.setup(); open('/volunteering?eventId=7');
  await user.click(await screen.findByRole('button', { name: 'Create a shift' }));
  await user.type(screen.getByLabelText('Shift title'), 'Pitch setup');
  fireEvent.change(screen.getByLabelText('Starts at'), { target: { value: '2099-08-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Ends at'), { target: { value: '2099-08-10T12:00' } });
  await user.type(screen.getByLabelText('Meeting point'), 'Pitch 2');
  fireEvent.change(screen.getByLabelText('Shared tasks — one per line'), { target: { value: 'Put out cones\n Set up goals ' } });
  await user.click(screen.getByRole('button', { name: 'Publish shift' }));
  expect(api.saveShift).toHaveBeenCalledWith(expect.objectContaining({ eventId: 7, tournamentId: null, title: 'Pitch setup', meetingPoint: 'Pitch 2', startsAt: new Date('2099-08-10T10:00').toISOString(), tasks: ['Put out cones', 'Set up goals'] }), undefined);
  expect(await screen.findByText('Your volunteer shift is ready.')).toBeVisible();
});
it('preserves coordinator edits when the server rejects a capacity reduction', async () => {
  vi.mocked(api.getShift).mockResolvedValue(coordinator);
  vi.mocked(api.saveShift).mockRejectedValue({ response: { data: { error: 'Capacity cannot be lower than the confirmed volunteers.' } } });
  const user = userEvent.setup(); open('/volunteering?shift=20');
  await user.click(await screen.findByRole('button', { name: 'Edit shift' }));
  await user.clear(screen.getByLabelText('Shift title')); await user.type(screen.getByLabelText('Shift title'), 'Updated welcome desk');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Capacity cannot be lower');
  expect(screen.getByLabelText('Shift title')).toHaveValue('Updated welcome desk');
});
it('lets coordinators cancel with a reason and shows the resulting cancellation', async () => {
  vi.mocked(api.getShift).mockResolvedValue(coordinator);
  vi.mocked(api.cancelShift).mockResolvedValue({ ...coordinator, status: 'CANCELLED', cancellationReason: 'Heavy rain', canJoin: false });
  const user = userEvent.setup(); open('/volunteering?shift=20');
  expect(await screen.findByText('Mariam')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel shift' }));
  await user.type(screen.getByLabelText('Reason for cancellation'), 'Heavy rain');
  await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  expect(api.cancelShift).toHaveBeenCalledWith(20, 'Heavy rain');
  expect(await screen.findByText('This shift is cancelled.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Edit shift' })).not.toBeInTheDocument();
});
it('updates shared tasks only when the server grants task permission', async () => {
  const signed = { ...shift, signedUp: true, canJoin: false, tasks: [{ ...shift.tasks[0], canToggle: true }] };
  vi.mocked(api.getShift).mockResolvedValue(signed);
  vi.mocked(api.setTaskComplete).mockResolvedValue({ ...signed, tasks: [{ ...signed.tasks[0], completed: true }] });
  const user = userEvent.setup(); open('/volunteering?shift=20');
  await user.click(await screen.findByRole('checkbox', { name: 'Set up signs' }));
  expect(api.setTaskComplete).toHaveBeenCalledWith(20, 30, true);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Set up signs' })).toBeChecked());
});
it('retains event context when switching to personal commitments', async () => {
  const user = userEvent.setup(); open('/volunteering?eventId=7');
  await user.click(screen.getByRole('button', { name: 'My commitments' }));
  await waitFor(() => expect(api.listShifts).toHaveBeenCalledWith('mine', 0, 7, undefined, expect.any(AbortSignal)));
});
