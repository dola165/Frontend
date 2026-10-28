import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refreshAccess } from '../../hooks/useCan';
import type { ClubManagementOverview } from '../clubs/domain';
import { OfficeSettings } from './OfficeSettings';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
const auth = vi.hoisted(() => ({ user: { id: 4, dob: '1985-01-01' }, refreshNavigationCapabilities: () => Promise.resolve() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const overview = { members: [{ userId: 1, role: 'OWNER', fullName: 'Nino Owner', username: 'nino' }] } as unknown as ClubManagementOverview;
const show = (ownership: unknown, access: unknown = null) => {
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) { if (access) return { data: access }; throw new Error('no rule-checker'); }
        if (path.endsWith('/ownership')) return { data: ownership };
        return { data: [] };
    });
    return render(<MemoryRouter initialEntries={['/clubs/7/office?tab=settings']}>
        <OfficeSettings clubId={7} clubName="FC Dinamo Tbilisi Academy" overview={overview} boot={null} onRefresh={async () => {}} />
    </MemoryRouter>);
};
const settled = { ownerId: 1, ownerName: 'Nino Owner', handover: null, reclaim: null };

beforeEach(() => { vi.clearAllMocks(); refreshAccess(); api.post.mockResolvedValue({ data: {} }); });
afterEach(cleanup);

it('lists the club’s settings, each opening its editor or its page', async () => {
    show(settled);
    expect(await screen.findByText('Owner: Nino Owner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit the page' })).toHaveAttribute('href', '/clubs/7?edit=1');
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/clubs/7?verify=1');
    expect(screen.getByText('New players: the squad’s coaches or any admin approve; the first answer counts')).toBeInTheDocument();
    // Only the Owner hands the club over, so an Admin's row has no button.
    expect(screen.queryByRole('button', { name: 'Hand over' })).not.toBeInTheDocument();
});

it('someone offered the club takes it over, and an Admin can ask GrassKickZ when the Owner vanished', async () => {
    const { unmount } = show({ ...settled, handover: { id: 3, toUserId: 4, toName: 'Mari Admin', status: 'PENDING', createdAt: '2026-10-26T10:00:00' } });
    api.post.mockResolvedValueOnce({ data: { outcome: 'TRANSFERRED' } });
    fireEvent.click(await screen.findByRole('button', { name: /Take over/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/ownership/handover/3/answer', { accept: true }));
    unmount();
    refreshAccess();
    show(settled, { clubId: 7, squadId: null, allowed: ['see_staff', 'invite_staff', 'ask_handover'], refused: [], admins: [] });
    api.post.mockResolvedValueOnce({ data: { reclaimId: 8, dueAt: '2026-11-26T10:00:00' } });
    fireEvent.click(await screen.findByRole('button', { name: /Ask GrassKickZ to hand it over/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/ownership/reclaim'));
    expect(await screen.findByText(/Nino Owner is told and can object until/)).toBeInTheDocument();
});
