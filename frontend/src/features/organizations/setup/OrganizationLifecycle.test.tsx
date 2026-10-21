import '../../../i18n';
import i18n from 'i18next';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { OrganizationLifecycle } from './OrganizationLifecycle';
import { OrganizationTeam } from './OrganizationTeam';
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const auth = vi.hoisted(() => ({ actorId: 41, sessionId: 'org-session-a', refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: auth.actorId }, sessionId: auth.sessionId, refreshNavigationCapabilities: auth.refreshNavigationCapabilities }) }));
const owner = { role: 'OWNER', canLeave: false, canTransfer: true, departureSnapshot: 'a'.repeat(64), recipients: [{ id: 2, name: 'Coach Nika' }], transfers: [] };
const staff = { ...owner, role: 'STAFF', canLeave: true, canTransfer: false };
beforeEach(async () => { auth.actorId = 41; auth.sessionId = 'org-session-a'; localStorage.setItem('gk-session-id', auth.sessionId); auth.refreshNavigationCapabilities.mockResolvedValue(undefined); await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); });
it('proposes to a selected current member without granting ownership immediately', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: owner }); vi.mocked(apiClient.post).mockResolvedValue({ data: owner });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('New owner'), { target: { value: '2' } });
  expect(apiClient.post).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Propose ownership transfer' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/7/ownership-transfers', { recipientId: 2 }));
  expect(screen.queryByRole('button', { name: 'Leave organization' })).not.toBeInTheDocument();
});
it('sends the reviewed generation and keeps the same command after uncertain failure and remount', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: staff });
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Response interrupted'));
  const first = render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave organization' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
  const command = vi.mocked(apiClient.post).mock.calls[0][1];
  expect(command).toEqual({ requestId: expect.any(String), snapshot: staff.departureSnapshot });
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update your membership.'); first.unmount();
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...staff, departureSnapshot: 'b'.repeat(64), role: 'ADMIN' } });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Retry earlier departure' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Leave organization' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry earlier departure' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual(['/organizations/7/leave', command]);
});
it('requires review and confirmation to deliberately leave the replacement generation', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: staff }); vi.mocked(apiClient.post).mockRejectedValue(new Error('Response interrupted'));
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave organization' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update your membership.');
  const earlier = vi.mocked(apiClient.post).mock.calls[0][1];
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...staff, departureSnapshot: 'b'.repeat(64) } });
  fireEvent.click(screen.getByRole('button', { name: 'Review current membership' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave organization' })); expect(apiClient.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' })); await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual({ requestId: expect.any(String), snapshot: 'b'.repeat(64) });
  expect(vi.mocked(apiClient.post).mock.calls[1][1]).not.toEqual(earlier);
});
it('keeps an earlier command available even when current membership cannot load after departure', async () => {
  sessionStorage.setItem('organization-departure:41:7', JSON.stringify({ actorId: 41, organizationId: 7, command: { requestId: '11111111-2222-3333-4444-555555555555', snapshot: 'a'.repeat(64) } }));
  vi.mocked(apiClient.get).mockRejectedValue(new Error('Membership ended')); vi.mocked(apiClient.post).mockResolvedValue({ data: undefined });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry earlier departure' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/7/leave', { requestId: '11111111-2222-3333-4444-555555555555', snapshot: 'a'.repeat(64) }));
  await waitFor(() => expect(sessionStorage.getItem('organization-departure:41:7')).toBeNull());
});
it('does not recover another account or organization command', async () => {
  sessionStorage.setItem('organization-departure:41:7', JSON.stringify({ actorId: 41, organizationId: 7, command: { requestId: '11111111-2222-3333-4444-555555555555', snapshot: 'a'.repeat(64) } }));
  vi.mocked(apiClient.get).mockResolvedValue({ data: staff }); auth.actorId = 42;
  const view = render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Leave organization' }); expect(screen.queryByRole('button', { name: 'Retry earlier departure' })).not.toBeInTheDocument();
  auth.actorId = 41; view.rerender(<MemoryRouter><OrganizationLifecycle id={8} onChanged={vi.fn()} /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Leave organization' }); expect(screen.queryByRole('button', { name: 'Retry earlier departure' })).not.toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('shows departure to staff and requires an explicit departure review', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...owner, role: 'STAFF', canLeave: true, canTransfer: false } });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave organization' })); expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep membership' })); expect(screen.queryByRole('button', { name: 'Confirm departure' })).not.toBeInTheDocument();
});
it('lets the intended recipient accept a handover from their workspace', async () => {
  const data = { ...owner, canTransfer: false, role: 'ADMIN', canLeave: true, transfers: [{ id: 9, recipient_name: 'Coach Nika', status: 'PENDING', expires_at: '2026-10-10T12:00:00Z', can_respond: true }] };
  vi.mocked(apiClient.get).mockResolvedValue({ data }); vi.mocked(apiClient.post).mockResolvedValue({ data: owner });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Accept ownership' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/organizations/7/ownership-transfers/9/response', { action: 'ACCEPT' }));
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

it('clears the selected removed member immediately after Team succeeds and reloads handover choices without a page reload', async () => {
  const refresh = deferred<{ data: typeof owner }>(); let reads = 0;
  const team = { members: [{ id: 91, userId: 41, name: 'Owner', role: 'OWNER', canRemove: false }, { id: 98, userId: 2, name: 'Coach Nika', role: 'STAFF', canRemove: true }], invitations: [], canInviteAdmin: true };
  vi.mocked(apiClient.get).mockImplementation(url => url === '/organizations/7/lifecycle' ? ++reads === 1 ? Promise.resolve({ data: owner }) : refresh.promise : Promise.resolve({ data: team }));
  vi.mocked(apiClient.post).mockResolvedValue({ data: { ...team, members: [team.members[0]] } });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /><OrganizationTeam id={7} /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('New owner'), { target: { value: '2' } });
  expect(screen.getByRole('button', { name: 'Propose ownership transfer' })).toBeEnabled();
  fireEvent.click(await screen.findByRole('button', { name: 'Remove access' }));
  fireEvent.click(within(screen.getByRole('region', { name: 'Confirm removal' })).getByRole('button', { name: 'Remove access' }));
  await waitFor(() => expect(reads).toBe(2));
  expect(screen.queryByLabelText('New owner')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Propose ownership transfer' })).not.toBeInTheDocument();
  await act(async () => refresh.resolve({ data: { ...owner, recipients: [] } }));
  expect(await screen.findByLabelText('New owner')).toHaveValue('');
  expect(screen.queryByRole('option', { name: 'Coach Nika' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Propose ownership transfer' })).toBeDisabled();
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(apiClient.post).toHaveBeenCalledWith('/organizations/7/team/members/98/remove', undefined);
});

it('ignores a read from before the membership mutation event', async () => {
  const old = deferred<{ data: typeof owner }>();
  vi.mocked(apiClient.get).mockReturnValueOnce(old.promise).mockResolvedValue({ data: { ...owner, recipients: [] } });
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent(window, new Event('requests-updated'));
  expect(await screen.findByLabelText('New owner')).toHaveValue('');
  await act(async () => old.resolve({ data: owner }));
  expect(screen.queryByRole('option', { name: 'Coach Nika' })).not.toBeInTheDocument(); expect(apiClient.post).not.toHaveBeenCalled();
});

it('rejects retired-session refreshes before React receives the new login', async () => {
  const refresh = deferred<{ data: typeof owner }>();
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: owner }).mockReturnValue(refresh.promise);
  render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={vi.fn()} /></MemoryRouter>);
  await screen.findByLabelText('New owner'); fireEvent(window, new Event('requests-updated'));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  localStorage.setItem('gk-session-id', 'org-session-b');
  await act(async () => refresh.resolve({ data: owner }));
  fireEvent(window, new Event('requests-updated'));
  expect(screen.queryByLabelText('New owner')).not.toBeInTheDocument(); expect(apiClient.get).toHaveBeenCalledTimes(2);
});

it('does not apply an old ownership response to the same actor in a new session', async () => {
  const response = deferred<{ data: typeof owner }>(), changed = vi.fn();
  vi.mocked(apiClient.get).mockResolvedValue({ data: owner }); vi.mocked(apiClient.post).mockReturnValue(response.promise);
  const view = render(<MemoryRouter><OrganizationLifecycle id={7} onChanged={changed} /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('New owner'), { target: { value: '2' } }); fireEvent.click(screen.getByRole('button', { name: 'Propose ownership transfer' }));
  auth.sessionId = 'org-session-b'; localStorage.setItem('gk-session-id', auth.sessionId);
  view.rerender(<MemoryRouter><OrganizationLifecycle id={7} onChanged={changed} /></MemoryRouter>);
  await act(async () => response.resolve({ data: owner }));
  expect(changed).not.toHaveBeenCalled(); expect(auth.refreshNavigationCapabilities).not.toHaveBeenCalled();
  expect(screen.queryByText('Ownership decision recorded. Access follows current responsibilities.')).not.toBeInTheDocument();
});
