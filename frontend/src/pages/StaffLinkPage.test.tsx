import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffLinkPage } from './StaffLinkPage';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const auth = vi.hoisted(() => ({ isAuthenticated: true, isBootstrapping: false, user: { id: 5, dob: '1990-01-01' as string | null }, refreshNavigationCapabilities: vi.fn(() => Promise.resolve()) }));
vi.mock('../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const preview = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', clubLogoUrl: null, job: 'ASSISTANT_COACH', title: 'Assistant coach', clubWide: false, squads: ['U12'], invitedBy: 'Luka', status: 'ACTIVE', expiresAt: '2026-11-02T12:00:00' };
const show = () => render(<MemoryRouter initialEntries={['/staff-invite/abc']}><Routes>
    <Route path="/staff-invite/:code" element={<StaffLinkPage />} /><Route path="/my-squads" element={<p>My squads</p>} />
</Routes></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); auth.isAuthenticated = true; auth.user = { id: 5, dob: '1990-01-01' }; api.get.mockResolvedValue({ data: preview }); });
afterEach(cleanup);

it('shows the job from the link and joins at once, landing in My squads', async () => {
    api.post.mockResolvedValue({ data: { appointmentId: 9, clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', title: 'Assistant coach', squads: ['U12'], alreadyJoined: false } });
    show();
    expect(await screen.findByText('Luka invited you: Assistant coach')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/staff-invite/abc', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Join as Assistant coach' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/staff-invite/abc'));
    expect(await screen.findByText('My squads')).toBeInTheDocument();
});

it('tells an account under 18 that club jobs are for adults, with no Join', async () => {
    auth.user = { id: 5, dob: '2011-03-14' };
    show();
    expect(await screen.findByText('Club jobs are for adults (18+).')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Join/ })).not.toBeInTheDocument();
});

it('says plainly when the link has expired', async () => {
    api.get.mockResolvedValue({ data: { ...preview, status: 'EXPIRED' } });
    show();
    expect(await screen.findByText(/This link has expired/)).toBeInTheDocument();
});
