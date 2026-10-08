import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubRelationships } from '../ClubRelationships';
import { OrganizationInvitationInbox } from '../../../organizations/setup/OrganizationInvitationInbox';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ refreshNavigationCapabilities: mocks.refresh }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: [] }); mocks.post.mockResolvedValue({}); mocks.refresh.mockResolvedValue(undefined); });
const mount = (element: React.ReactNode, path = '/account') => render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

it('requires confirmation and names the exact relationship being ended', async () => {
  mocks.get.mockResolvedValue({ data: [{ clubId: 1, clubName: 'Dinamo', staffRole: 'COACH', playerStatus: 'ACTIVE', departureSnapshots: { STAFF: 'staff', PLAYER: 'player', ALL: 'all' } }] });
  mount(<ClubRelationships />);
  fireEvent.click(await screen.findByRole('button', { name: 'End playing membership' }));
  expect(screen.getByText(/Your staff responsibilities will remain/)).toBeVisible();
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm departure' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/clubs/1/relationships/PLAYER/leave', { requestId: expect.any(String), snapshot: 'player' }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
});

it('allows an owner to end playing membership but requires transfer for staff departure', async () => {
  mocks.get.mockResolvedValue({ data: [{ clubId: 1, clubName: 'Dinamo', staffRole: 'OWNER', playerStatus: 'ACTIVE' }] });
  mount(<ClubRelationships />);
  expect(await screen.findByRole('button', { name: 'End playing membership' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'End staff membership' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Leave all club responsibilities' })).not.toBeInTheDocument();
});

it('accepts a venue invitation through its own endpoint and refreshes workspace navigation', async () => {
  mocks.get.mockImplementation(async (path: string) => ({ data: path === '/organizations/invitations/mine' ? [{ id: 9, organizationId: 8, organizationName: 'Sports Park', status: 'PENDING', canRespond: true }] : [] }));
  const accepted = vi.fn(); mount(<OrganizationInvitationInbox onAccepted={accepted} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Accept responsibility' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/organizations/invitations/9/response', { action: 'ACCEPT' }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(accepted).toHaveBeenCalledOnce();
});

it('opens an expired notification as a receipt without offering stale acceptance', async () => {
  mocks.get.mockImplementation(async (path: string) => ({ data: path.includes('/invitation-notices/') ? { id: 9, organizationName: 'Sports Park', role: 'STAFF', status: 'EXPIRED', recipient: true } : [] }));
  mount(<OrganizationInvitationInbox />, '/account?tab=profile&itemId=9');
  expect(await screen.findByText(/Invitation expired/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Accept responsibility' })).not.toBeInTheDocument();
});

it('shows actionable invitations even if the other invitation source fails', async () => {
  mocks.get.mockImplementation(async (path: string) => {
    if (path === '/organizations/invitations/mine') throw new Error('offline');
    return { data: [{ id: 9, organizationId: 8, organizationName: 'Sports Park', role: 'STAFF', status: 'PENDING', canRespond: true }] };
  });
  mount(<OrganizationInvitationInbox />);
  expect(await screen.findByRole('button', { name: 'Accept responsibility' })).toBeEnabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Some invitations could not be loaded');
});
