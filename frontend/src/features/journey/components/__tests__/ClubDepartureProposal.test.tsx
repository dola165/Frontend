import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubRelationships } from '../ClubRelationships';
import { prepareStaffDeparture, leaveClubMembership } from '../../../clubs/api';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ refreshNavigationCapabilities: mocks.refresh }) }));
const row = { clubId: 1, clubName: 'Dinamo', staffRole: 'COACH', playerStatus: 'ACTIVE', departureSnapshots: { STAFF: 's'.repeat(64), PLAYER: 'p'.repeat(64), ALL: 'a'.repeat(64) } };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: [row] }); mocks.post.mockResolvedValue({}); mocks.refresh.mockResolvedValue(undefined); });
function mount() { render(<MemoryRouter><ClubRelationships /></MemoryRouter>); }
it('retains the original command after a lost response even when a replacement is loaded', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Connection closed'));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'End playing membership' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  await screen.findByRole('alert');
  const original = mocks.post.mock.calls[0][1];
  mocks.get.mockResolvedValue({ data: [{ ...row, departureSnapshots: { ...row.departureSnapshots, PLAYER: 'replacement' } }] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
  expect(mocks.post.mock.calls[1][1]).toEqual(original);
  expect(original.snapshot).toBe(row.departureSnapshots.PLAYER);
});
it('requires a fresh confirmation after the server rejects a changed relationship', async () => {
  mocks.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Your relationship changed.' } } });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Leave all club responsibilities' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm departure' })).not.toBeInTheDocument());
  const first = mocks.post.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Leave all club responsibilities' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
  expect(mocks.post.mock.calls[1][1].requestId).not.toBe(first.requestId);
});
it('workspace confirmation captures STAFF once and keeps the bound legacy command for retries', async () => {
  const command = await prepareStaffDeparture(1);
  mocks.post.mockRejectedValueOnce(new Error('Connection closed'));
  await expect(leaveClubMembership(1, command)).rejects.toThrow();
  await leaveClubMembership(1, command);
  expect(mocks.get).toHaveBeenCalledOnce();
  expect(mocks.post.mock.calls).toEqual([['/clubs/1/membership/leave', command], ['/clubs/1/membership/leave', command]]);
  expect(command.snapshot).toBe(row.departureSnapshots.STAFF);
});
