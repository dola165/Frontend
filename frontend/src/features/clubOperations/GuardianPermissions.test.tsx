import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MyClubOperationsPage from '../../pages/MyClubOperationsPage';
import type { GuardianPermission } from './GuardianPermissions';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), refresh: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 2, navigationCapabilities: { workspaces: [{ id: 'parent.hub' }] } }, sessionId: 'test', refreshNavigationCapabilities: api.refresh }) }));
vi.mock('./FamilyClubWork', () => ({ FamilyClubWork: () => null }));
const permission: GuardianPermission = { id: 8, club_id: 3, child_name: 'Ana Dolidze', club_name: 'Riverside', module: 'GUARDIANS', kind: 'CONSENT', title: 'Team day', status: 'PENDING', revision: 4, squad_id: 4, subject_user_id: 5, assigned_user_id: 2, event_id: null, session_id: null, related_record_id: null, due_on: null, canEdit: false, created_at: '2026-10-01', updated_at: '2026-10-01', data: { purpose: 'TRAVEL', wording: 'Meet at the academy, return at noon. This is the exact permission wording.', version: 'journey-1' }, transitions: ['GRANTED', 'DECLINED'] };
beforeEach(() => { vi.clearAllMocks(); api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/club-operations/mine' ? { appointments: [], permissions: [permission], clubs: [] } : url === '/map/plans/family' ? [] : { connections: [] } })); api.post.mockResolvedValue({}); });
afterEach(cleanup);
it('opens the exact notification request without making a decision and records the explicit current revision', async () => {
    render(<MemoryRouter initialEntries={['/club-operations?permissionId=8']}><MyClubOperationsPage /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Give permission' });
    expect(screen.getByText(permission.data.wording)).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Give permission' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledExactlyOnceWith('/clubs/3/operations/records/8/transition', { revision: 4, status: 'GRANTED', note: null }));
});
it('keeps failed decisions readable and blocks repeated clicks while the request is in flight', async () => {
    let reject!: (error: Error) => void;
    api.post.mockImplementation(() => new Promise((_, no) => { reject = no; }));
    render(<MemoryRouter initialEntries={['/club-operations?permissionId=8']}><MyClubOperationsPage /></MemoryRouter>);
    const button = await screen.findByRole('button', { name: 'Give permission' });
    fireEvent.click(button); fireEvent.click(button);
    expect(api.post).toHaveBeenCalledTimes(1);
    reject(new Error('stale'));
    await screen.findByRole('alert');
    expect(screen.getByText(permission.data.wording)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Give permission' })).toBeEnabled();
    expect(screen.queryByText(/decision saved/)).not.toBeInTheDocument();
});
it('reports an inaccessible notification target without deciding for it', async () => {
    render(<MemoryRouter initialEntries={['/club-operations?permissionId=99']}><MyClubOperationsPage /></MemoryRouter>);
    await screen.findByText(/no longer available to your account/);
    expect(screen.queryByRole('button', { name: 'Give permission' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
});
