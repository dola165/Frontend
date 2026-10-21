import '../../../i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationTeam } from './OrganizationTeam';
import { apiClient } from '../../../api/axiosConfig';

const auth = vi.hoisted(() => ({ sessionId: 'owner-a', user: { id: 1 } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const team = { members: [{ id: 1, userId: 1, name: 'Owner', role: 'OWNER', canRemove: false }], invitations: [], canInviteAdmin: true };
const tree = () => <MemoryRouter><OrganizationTeam id={7} /></MemoryRouter>;
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); auth.sessionId = 'owner-a'; localStorage.setItem('gk-session-id', auth.sessionId); vi.mocked(apiClient.get).mockResolvedValue({ data: team }); });
it('retains the original invitation command after an uncertain response and remount, then clears it on success', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Response interrupted'));
  const view = render(tree()); fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'recipient@example.test' } }); fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));
  await screen.findByRole('alert'); const original = vi.mocked(apiClient.post).mock.calls[0][1]; expect(original).toEqual({ email: 'recipient@example.test', role: 'STAFF', requestId: expect.any(String) });
  expect(screen.queryByRole('button', { name: 'Invite team member' })).not.toBeInTheDocument(); view.unmount();
  vi.mocked(apiClient.post).mockResolvedValue({ data: team }); render(tree());
  expect(await screen.findByLabelText('Email')).toHaveValue('recipient@example.test'); fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2)); expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual(original);
  await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('')); expect(sessionStorage.length).toBe(0);
});
it('does not expose a former sender draft to a new session or accept an old privileged response', async () => {
  let resolve!: (value: { data: typeof team }) => void; vi.mocked(apiClient.post).mockReturnValue(new Promise(r => { resolve = r; }));
  const view = render(tree()); fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'recipient@example.test' } }); fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));
  auth.sessionId = 'owner-b'; localStorage.setItem('gk-session-id', auth.sessionId); view.rerender(tree()); expect(await screen.findByLabelText('Email')).toHaveValue('');
  await act(async () => resolve({ data: team })); expect(screen.queryByText('Invitation sent. They can respond in My organizations.')).not.toBeInTheDocument(); expect(screen.getByLabelText('Email')).toHaveValue('');
});
