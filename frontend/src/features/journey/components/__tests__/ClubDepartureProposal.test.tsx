import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubRelationships } from '../ClubRelationships';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 5 }, refreshNavigationCapabilities: mocks.refresh }) }));
const row = { clubId: 1, clubName: 'Dinamo', staffRole: 'COACH', playerStatus: 'ACTIVE', departureSnapshots: { STAFF: 's'.repeat(64), PLAYER: 'p'.repeat(64) } };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: [row] }); mocks.post.mockResolvedValue({}); mocks.refresh.mockResolvedValue(undefined); });
function mount() { render(<MemoryRouter><ClubRelationships /></MemoryRouter>); }

it('keeps the same request for a plain retry after a lost answer', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Connection closed'));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Leave the squad' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
  await screen.findByRole('alert');
  const original = mocks.post.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
  expect(mocks.post.mock.calls[1][1]).toEqual(original);
  expect(original.snapshot).toBe(row.departureSnapshots.PLAYER);
});

it('asks again with a fresh request after the server says the relationship changed', async () => {
  mocks.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Your relationship changed.' } } });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Leave the squad' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Yes, leave' })).not.toBeInTheDocument());
  const first = mocks.post.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Leave the squad' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
  expect(mocks.post.mock.calls[1][1].requestId).not.toBe(first.requestId);
});

it('leaves the staff through the one leave flow, and the Owner hands the club over', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Leave the staff' }));
  expect(await screen.findByRole('dialog', { name: 'Leave Dinamo?' })).toBeInTheDocument();
});
