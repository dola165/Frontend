import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { WorkspaceGuide as OperationalGuide } from './WorkspaceGuide';
import type { ComponentProps } from 'react';
import type { Bootstrap, OperationRecord } from '../clubOperations/api';
import { useWorkspaceRoles, type RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import { setStoredAccessToken } from '../../utils/authStorage';
import { coachTrainingContext } from './coachHub/coachData';
import { upcoming } from './coachHub/useCoachData';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
vi.mock('../pages/guide/useGuidePlacement', () => ({ useGuidePlacement: () => ({ host: document.body, inline: false, left: 0, top: 0, maxHeight: 900 }) }));
const boot: Bootstrap = { clubId: 400, clubName: 'New academy', actorId: 9500, leadership: true,
  definitions: [], specialisations: [], permissions: [], settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['STAFF', 'ATTENDANCE'], revision: 0 },
  modules: [{ id: 'STAFF', writable: true, globalWrite: true, writeSquads: [401] }, { id: 'ATTENDANCE', writable: true, globalWrite: true, writeSquads: [401] }],
  squads: [{ id: 401, name: 'U12' }], people: [{ id: 8, name: 'Saba' }], staff: [{ id: 9500, name: 'Club owner' }], guardians: [], events: [], sessions: [{ id: 71, title: 'Training', starts_at: '2026-10-18T13:00:00Z', squad_id: 401, squad_name: 'U12' }], venues: [], links: [] };
const roles: RolesWorkspace = { leadership: true, actorId: 9500, catalog: [{ key: 'HEAD_COACH', title: 'Head coach', description: '', permissions: [] }],
  views: [{ id: 'coaching', label: 'Squad coach', modules: ['STAFF', 'ATTENDANCE'], squadIds: [401], clubWide: false, appointmentId: 1, revision: 1 }],
  current: { id: 'all', label: 'All work', modules: ['STAFF'], squadIds: [401], clubWide: true, appointmentId: null, revision: null },
  squads: [{ id: 401, name: 'U12', player_count: 1 }], requestSquads: [{ id: 401, name: 'U12' }], people: [{ id: 8, name: 'Saba', squad_id: 401, squad_name: 'U12' }], sessions: [], requests: [], invitations: [] };
const attendance: OperationRecord = { id: 81, club_id: 400, module: 'ATTENDANCE', kind: 'ATTENDANCE', title: 'Saba · Training', status: 'EXPECTED', revision: 0, data: {}, squad_id: 401, subject_user_id: 8, assigned_user_id: null, event_id: null, session_id: 71, related_record_id: null, due_on: null, canEdit: false, transitions: ['ARRIVED', 'ABSENT'], created_at: '2026-10-17', updated_at: '2026-10-17' };
// Existing create/recovery cases explicitly start from a confirmed empty coach schedule.
function WorkspaceGuide(props: ComponentProps<typeof OperationalGuide>) {
  return <OperationalGuide training={{ clubId: props.boot.clubId, actorId: props.boot.actorId, state: 'ready', next: null }} {...props} />;
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); api.get.mockResolvedValue({ data: [] }); api.post.mockResolvedValue({ data: { ...attendance, title: 'Training cover' } }); });
afterEach(cleanup);
it('completes a staff task only after a successful create and retains its receipt when refresh fails', async () => {
  const refresh = vi.fn().mockRejectedValueOnce(new Error('Refresh offline')).mockResolvedValue(undefined);
  render(<WorkspaceGuide boot={boot} roles={roles} mode="club" onRefresh={refresh} />);
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Saved: Training cover · #81');
  expect(screen.getByRole('alert')).toHaveTextContent('Saved. The page could not refresh.');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh page' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('stays on a rejected staff save with editable answers and no receipt', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Save rejected' } } });
  render(<WorkspaceGuide boot={boot} roles={roles} mode="club" onRefresh={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), { target: { value: 'Kit for Saturday' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox', { name: 'Task' })).toHaveValue('Kit for Saturday');
  expect(screen.getByRole('textbox', { name: 'Task' })).toBeEnabled();
  expect(screen.queryByText(/^Saved:/)).not.toBeInTheDocument();
});
it('retries an uncertain training request with the exact same identity and payload', async () => {
  api.post.mockRejectedValueOnce(new Error('Response lost'));
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Starts')).toBeDisabled();
  const first = api.post.mock.calls[0];
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Training saved.');
  expect(api.post.mock.calls[1]).toEqual(first);
  expect(first[0]).toBe('/squad-communication/401/sessions');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Give a staff member a task');
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('keeps an uncertain training identity through a denied retry', async () => {
  api.post.mockRejectedValueOnce(new Error('Response lost')).mockRejectedValueOnce({ response: { status: 403 } });
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByRole('alert');
  const first = api.post.mock.calls[0];
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2)); await screen.findByRole('alert');
  expect(screen.getByLabelText('Starts')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.');
  expect(api.post.mock.calls[1]).toEqual(first); expect(api.post.mock.calls[2]).toEqual(first);
});
it('reuses a created attendance identity after its transition fails', async () => {
  api.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/records/81') ? attendance : [] }));
  api.post.mockResolvedValueOnce({ data: attendance }).mockRejectedValueOnce(new Error('Transition offline')).mockResolvedValueOnce({ data: { ...attendance, status: 'ARRIVED', revision: 1 } });
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.change(screen.getByLabelText('Player'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Attendance saved.');
  expect(api.post.mock.calls.map(c => c[0])).toEqual(['/clubs/400/operations/records', '/clubs/400/operations/records/81/transition', '/clubs/400/operations/records/81/transition']);
});
it('reconciles a lost attendance transition response without repeating the decision', async () => {
  api.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/records/81') ? { ...attendance, status: 'ARRIVED', revision: 1 } : [] }));
  api.post.mockResolvedValueOnce({ data: attendance }).mockRejectedValueOnce(new Error('Response lost'));
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip' })); fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.change(screen.getByLabelText('Player'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Attendance saved.');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.get).toHaveBeenCalledWith('/clubs/400/operations/records/81', { signal: undefined });
});
it('changing the account resets all receipts and uses the new account scope', async () => {
  const { rerender } = render(<WorkspaceGuide boot={boot} roles={roles} mode="club" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Saved: Training cover · #81');
  rerender(<WorkspaceGuide boot={{ ...boot, actorId: 9501 }} roles={{ ...roles, actorId: 9501 }} mode="club" onRefresh={vi.fn()} />);
  expect(screen.queryByText('Saved: Training cover · #81')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Task' })).toBeEnabled();
});
it('does not offer an impossible attendance task for a session without selectable players', () => {
  render(<WorkspaceGuide boot={boot} roles={{ ...roles, people: [], squads: roles.squads.map(squad => ({ ...squad, player_count: 0 })) }} mode="coach" onRefresh={vi.fn()} />);
  expect(screen.getByText('Attendance is available once players are added to your squad.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.queryByText('Record attendance, if you use it')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Player')).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it('chooses a session with current roster options when another squad has no players', () => {
  const otherSquad = { id: 402, name: 'U16', player_count: 1 };
  const eligibleRoles = { ...roles, views: roles.views.map(view => ({ ...view, squadIds: [401, 402] })), requestSquads: [...roles.requestSquads, otherSquad], squads: [...roles.squads, otherSquad], people: [{ id: 9, name: 'Giorgi', squad_id: 402, squad_name: 'U16' }] };
  const eligibleBoot = { ...boot, sessions: [...boot.sessions, { id: 72, title: 'Training', starts_at: '2026-10-19T13:00:00Z', squad_id: 402, squad_name: 'U16' }] };
  render(<WorkspaceGuide boot={eligibleBoot} roles={eligibleRoles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip' })); fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.getByLabelText('Session')).toHaveValue('72');
  expect(screen.getByRole('option', { name: 'Giorgi' })).toBeVisible();
  expect(screen.queryByRole('option', { name: 'U12 · Training · 2026-10-18' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it.each(['unmount', 'account change'] as const)('does not make a delayed attendance decision after %s', async change => {
  let resolve!: (value: { data: OperationRecord[] }) => void;
  api.get.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  const view = render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip' })); fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.change(screen.getByLabelText('Player'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(resolve).toBeTypeOf('function'));
  if (change === 'unmount') view.unmount();
  else act(() => setStoredAccessToken('synthetic-next-account-token'));
  await act(async () => { resolve({ data: [attendance] }); });
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByText('Attendance saved.')).not.toBeInTheDocument();
});

function RefreshingGuide() {
  const workspace = useWorkspaceRoles(400, 'all', 9500);
  if (workspace.loading && !workspace.data) return <p>Loading roles</p>;
  return workspace.data && <WorkspaceGuide boot={boot} roles={workspace.data} mode="club" onRefresh={workspace.refresh} />;
}
it('keeps the saved guide mounted while its real role hook refreshes', async () => {
  let resolve!: (value: {data:RolesWorkspace}) => void;
  api.get.mockResolvedValueOnce({ data: roles }).mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  render(<RefreshingGuide />);
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
  await screen.findByText('Saved: Training cover · #81');
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Loading roles')).not.toBeInTheDocument();
  await act(async () => { resolve({ data: roles }); });
  expect(screen.getByText('Saved: Training cover · #81')).toBeVisible();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('retains a confirmed role view through an outage but clears it on denied access', async () => {
  api.get.mockResolvedValueOnce({ data: roles }).mockRejectedValueOnce(new Error('Offline')).mockRejectedValueOnce({ response: { status: 403 } });
  const { result } = renderHook(() => useWorkspaceRoles(400, 'all', 9500));
  await waitFor(() => expect(result.current.data).toEqual(roles));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.error).not.toBe(''));
  expect(result.current.data).toEqual(roles);
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.data).toBeNull());
});
it('never shows the previous account’s roles while the new account loads', async () => {
  api.get.mockResolvedValueOnce({ data: roles }).mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(({ actor }) => useWorkspaceRoles(400, 'all', actor), { initialProps: { actor: 9500 } });
  await waitFor(() => expect(result.current.data).toEqual(roles));
  rerender({ actor: 9501 });
  expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(true);
});
it('does not offer write tasks to a view-only squad assignment', () => {
  const readBoot = { ...boot, leadership: false, modules: boot.modules.map(module => ({ ...module, writable: false, globalWrite: false, writeSquads: [] })) };
  const readRoles = { ...roles, leadership: false, catalog: [], views: roles.views.map(view => ({ ...view, id: 'appointment-readonly' })) };
  render(<WorkspaceGuide boot={readBoot} roles={readRoles} mode="coach" onRefresh={vi.fn()} />);
  expect(screen.queryByText('Plan one training session')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Task')).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it('offers only the writable training squad when another assignment is view-only', async () => {
  const other = { id: 402, name: 'U16' };
  const writeBoot = { ...boot, leadership: false, squads: [...boot.squads, other], modules: [{ id: 'ATTENDANCE', writable: true, globalWrite: false, writeSquads: [402] }] };
  const writeRoles = { ...roles, leadership: false, catalog: [], requestSquads: [...roles.requestSquads, other], views: roles.views.map(view => ({ ...view, id: 'appointment', squadIds: [401, 402] })) };
  render(<WorkspaceGuide boot={writeBoot} roles={writeRoles} mode="coach" onRefresh={vi.fn()} />);
  expect(screen.getByLabelText('Squad')).toHaveValue('402');
  expect(screen.queryByRole('option', { name: 'U12' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.');
  expect(api.post.mock.calls[0][0]).toBe('/squad-communication/402/sessions');
});
it('keeps a confirmed coach training action when optional attendance tracking is off', async () => {
  const noTracking = { ...boot, leadership: false, settings: { ...boot.settings, enabled_modules: [] }, modules: boot.modules.map(module => ({ ...module, writable: false, globalWrite: false, writeSquads: [] })) };
  render(<WorkspaceGuide boot={noTracking} roles={{ ...roles, leadership: false, catalog: [] }} mode="coach" onRefresh={vi.fn()} />);
  expect(screen.getByLabelText('Starts')).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.');
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('does not offer a staff record when its club tool is disabled', () => {
  render(<WorkspaceGuide boot={{ ...boot, settings: { ...boot.settings, enabled_modules: [] } }} roles={roles} mode="club" onRefresh={vi.fn()} />);
  expect(screen.queryByLabelText('Task')).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it('chooses a permitted staff scope without offering a view-only squad', async () => {
  const other = { id: 402, name: 'U16' };
  const dutyBoot = { ...boot, leadership: false, squads: [...boot.squads, other], modules: [{ id: 'STAFF', writable: true, globalWrite: false, writeSquads: [402] }] };
  const dutyRoles = { ...roles, leadership: false, catalog: [], requestSquads: [...roles.requestSquads, other], views: roles.views.map(view => ({ ...view, id: 'appointment', squadIds: [401, 402] })) };
  render(<WorkspaceGuide boot={dutyBoot} roles={dutyRoles} mode="coach" onRefresh={vi.fn()} />);
  expect(screen.getByLabelText('Squad')).toHaveValue('402'); expect(screen.queryByRole('option', { name: 'U12' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Saved: Training cover · #81');
  expect(api.post.mock.calls[0][1]).toMatchObject({ kind: 'DUTY', squadId: 402 });
});
it('retains only an opaque training marker and blocks a fresh request after unknown-save reload', async () => {
  api.post.mockRejectedValueOnce(new Error('Response lost'));
  const view = render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Ground or meeting place'), { target: { value: 'Private school entrance' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByRole('alert');
  const key = sessionStorage.getItem('gk-training-create:9500:400'); expect(key).toBe(api.post.mock.calls[0][1].requestId);
  expect(JSON.stringify(sessionStorage)).not.toContain('Private school entrance');
  view.unmount(); render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  expect(screen.getByText(/A previous training save was not confirmed/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled(); expect(api.post).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('gk-training-create:9500:400')).toBe(key);
});
it('clears a known training marker even when the following refresh fails', async () => {
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn().mockRejectedValue(new Error('Read offline'))} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.');
  expect(sessionStorage.getItem('gk-training-create:9500:400')).toBeNull(); expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Saved. The page could not refresh.');
});
it('clears a definite training rejection and permits corrected details with a new identity', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Training rejected' } } });
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByRole('alert');
  const first = api.post.mock.calls[0][1].requestId;
  expect(sessionStorage.getItem('gk-training-create:9500:400')).toBeNull(); expect(screen.getByLabelText('Starts')).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Ground or meeting place'), { target: { value: 'Corrected field' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.');
  expect(api.post.mock.calls[1][1].requestId).not.toBe(first); expect(api.post.mock.calls[1][1].location).toBe('Corrected field');
  expect(sessionStorage.getItem('gk-training-create:9500:400')).toBeNull();
});

const nextTraining = { squadId: 401, squadName: 'U12', session: { id: 72, title: 'Finishing under pressure', starts_at: '2100-10-19T14:00:00Z', ends_at: '2100-10-19T15:30:00Z', location: 'Saved pitch 2', status: 'SCHEDULED' as const, cancellation_reason: null, revision: 3, attendance: [] } };
const confirmedTraining = { clubId: 400, actorId: 9500, state: 'ready' as const, next: nextTraining };
it('opens the actual upcoming assigned training without creating another session', async () => {
  const open = vi.fn();
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={confirmedTraining} onOpenSchedule={open} onRefresh={vi.fn()} />);
  expect(screen.getByText('Your upcoming training')).toBeVisible(); expect(screen.getByText('Finishing under pressure')).toBeVisible();
  expect(screen.getByText('Saved pitch 2')).toBeVisible(); expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Open session' }));
  await waitFor(() => expect(open.mock.calls).toStrictEqual([[nextTraining]])); expect(api.post).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
});
it('plans an additional session only after that explicit choice', async () => {
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={confirmedTraining} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Plan another session' }));
  expect(screen.getByLabelText('Squad')).toHaveValue('401'); expect(screen.getByLabelText('Starts')).toBeEnabled(); expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Ground or meeting place'), { target: { value: 'An extra pitch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.');
  expect(api.post).toHaveBeenCalledOnce(); expect(api.post.mock.calls[0][0]).toBe('/squad-communication/401/sessions');
  expect(api.post.mock.calls[0][1]).toMatchObject({ location: 'An extra pitch', requestId: expect.any(String) });
});
it.each(['loading', 'unavailable'] as const)('does not turn a %s schedule into empty setup', async state => {
  const open = vi.fn();
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={{ ...confirmedTraining, state, next: null }} onOpenSchedule={open} onRefresh={vi.fn()} />);
  expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent(state === 'loading' ? 'Checking your training' : 'Training could not be checked');
  if (state === 'loading') expect(screen.getByRole('button', { name: 'Open calendar' })).toBeDisabled();
  else { fireEvent.click(screen.getByRole('button', { name: 'Open calendar' })); await waitFor(() => expect(open.mock.calls).toStrictEqual([[undefined]])); }
  expect(api.post).not.toHaveBeenCalled();
});
it('starts setup only once the actual schedule is confirmed empty', () => {
  const view = render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={undefined} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument();
  view.rerender(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByLabelText('Starts')).toBeEnabled(); expect(api.post).not.toHaveBeenCalled();
});
it.each(['club', 'actor', 'squad'] as const)('never opens an existing session from another %s scope', scope => {
  const training = { ...confirmedTraining, ...(scope === 'club' ? { clubId: 999 } : scope === 'actor' ? { actorId: 999 } : { next: { ...nextTraining, squadId: 999 } }) };
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={training} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.queryByText('Finishing under pressure')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Open session' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it('allows a confirmed read-only handoff without offering new training', async () => {
  const readBoot = { ...boot, leadership: false, modules: [] };
  const readRoles = { ...roles, leadership: false, catalog: [], views: roles.views.map(view => ({ ...view, id: 'read-only' })) };
  const open = vi.fn(); render(<WorkspaceGuide boot={readBoot} roles={readRoles} mode="coach" training={confirmedTraining} onOpenSchedule={open} onRefresh={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Plan another session' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open session' })); await waitFor(() => expect(open).toHaveBeenCalledWith(nextTraining)); expect(api.post).not.toHaveBeenCalled();
});
it('keeps an unresolved training body and UUID when existing training arrives during recovery', async () => {
  api.post.mockRejectedValueOnce(new Error('Lost response'));
  const view = render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Ground or meeting place'), { target: { value: 'Original recovery pitch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByRole('alert'); const first = api.post.mock.calls[0];
  view.rerender(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={confirmedTraining} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByLabelText('Ground or meeting place')).toHaveValue('Original recovery pitch'); expect(screen.getByLabelText('Starts')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.'); expect(api.post.mock.calls).toStrictEqual([first, first]);
});
it('does not hide an unresolved reload marker behind an existing-session handoff', () => {
  sessionStorage.setItem('gk-training-create:9500:400', 'opaque-original-request');
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={confirmedTraining} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByText(/A previous training save was not confirmed/)).toBeVisible(); expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Open session' })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
it('review boundary R1 keeps current training as existing work after its start time', async () => {
  const now = Date.parse('2026-10-19T14:05:00Z');
  const ongoing = { ...nextTraining.session, starts_at: '2026-10-19T14:00:00Z', ends_at: '2026-10-19T15:30:00Z' };
  const loaded = { id: 401, sessions: [ongoing], overview: null, updates: [], failed: [], error: '' };
  expect(upcoming(loaded, now)[0]).toBe(ongoing);
  const training = coachTrainingContext(400, 9500, roles.squads, [loaded], now), open = vi.fn();
  render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={training} onOpenSchedule={open} onRefresh={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Open session' })).toBeVisible(); expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open session' })); await waitFor(() => expect(open.mock.calls).toStrictEqual([[training.next]])); expect(api.post).not.toHaveBeenCalled();
});
it('review boundary R2 retains prior uncertainty during a read-only session handoff', async () => {
  const key = 'gk-training-create:9500:400', opaque = '359acda5-73e2-4463-bd97-4dcd38410318';
  sessionStorage.setItem(key, opaque);
  const readBoot = { ...boot, leadership: false, modules: [] };
  const readRoles = { ...roles, leadership: false, catalog: [], views: roles.views.map(view => ({ ...view, id: 'read-only' })) };
  const open = vi.fn();
  const view = render(<WorkspaceGuide boot={readBoot} roles={readRoles} mode="coach" training={confirmedTraining} onOpenSchedule={open} onRefresh={vi.fn()} />);
  expect(screen.getByText(/A previous training save was not confirmed/)).toBeVisible();
  expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Plan another|Plan new/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open session' })); await waitFor(() => expect(open.mock.calls).toStrictEqual([[nextTraining]]));
  expect(sessionStorage.getItem(key)).toBe(opaque); expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText(/A previous training save was not confirmed/)).toBeVisible();
  view.rerender(<WorkspaceGuide boot={{ ...readBoot, actorId: 9501 }} roles={{ ...readRoles, actorId: 9501 }} mode="coach" training={confirmedTraining} onOpenSchedule={open} onRefresh={vi.fn()} />);
  expect(screen.queryByText(/A previous training save was not confirmed/)).not.toBeInTheDocument(); expect(sessionStorage.getItem(key)).toBe(opaque);
});
it('keeps the prior uncertainty visible even when no training task can be offered', () => {
  const key = 'gk-training-create:9500:400', opaque = '359acda5-73e2-4463-bd97-4dcd38410318'; sessionStorage.setItem(key, opaque);
  const readBoot = { ...boot, leadership: false, modules: [] }, readRoles = { ...roles, leadership: false, catalog: [], views: [], squads: [], requestSquads: [] };
  render(<WorkspaceGuide boot={readBoot} roles={readRoles} mode="coach" training={{ ...confirmedTraining, next: null }} onRefresh={vi.fn()} />);
  expect(screen.getByText(/A previous training save was not confirmed/)).toBeVisible(); expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  expect(sessionStorage.getItem(key)).toBe(opaque); expect(api.post).not.toHaveBeenCalled();
});
it('keeps the exact in-memory uncertain request when create access disappears and returns', async () => {
  api.post.mockRejectedValueOnce(new Error('Lost response'));
  const view = render(<WorkspaceGuide boot={boot} roles={roles} mode="coach" onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Ground or meeting place'), { target: { value: 'Original private pitch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByRole('alert'); const first = api.post.mock.calls[0];
  const readBoot = { ...boot, leadership: false, modules: [] }, readRoles = { ...roles, leadership: false, catalog: [], views: roles.views.map(view => ({ ...view, id: 'read-only' })) };
  view.rerender(<WorkspaceGuide boot={readBoot} roles={readRoles} mode="coach" training={confirmedTraining} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByText(/Training may already be saved. Keep this page open and review/)).toBeVisible(); expect(screen.queryByLabelText('Starts')).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem('gk-training-create:9500:400')).toBe(first[1].requestId);
  view.rerender(<WorkspaceGuide boot={boot} roles={roles} mode="coach" training={confirmedTraining} onOpenSchedule={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByLabelText('Ground or meeting place')).toHaveValue('Original private pitch'); expect(screen.getByLabelText('Starts')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Training saved.'); expect(api.post.mock.calls).toStrictEqual([first, first]);
});
