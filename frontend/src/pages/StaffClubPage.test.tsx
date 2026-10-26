import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffClubPage } from './StaffClubPage';
import { StaffClubCard } from '../features/clubOperations/leaving/StaffClubCard';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 5, dob: '1985-01-01' }, refreshNavigationCapabilities: () => Promise.resolve() }) }));

const choice = {
    needed: true, deadline: '2026-11-26T00:00:00', suggestedClubId: 1, chosenClubId: null,
    clubs: [
        { clubId: 1, name: 'FC Dinamo Tbilisi Academy', logoUrl: null, jobs: ['Head coach'], activity: '12 sessions this month', suggested: true },
        { clubId: 2, name: 'Saburtalo', logoUrl: null, jobs: ['Assistant coach', 'Fees'], activity: '1 session this month', suggested: false },
    ],
};
function Address() { return <output data-testid="address">{useLocation().search}</output>; }
const show = () => render(<MemoryRouter initialEntries={['/me/staff-club']}><Routes>
    <Route path="/me/staff-club" element={<><StaffClubPage /><Address /></>} />
</Routes></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: choice }); });
afterEach(cleanup);

it('suggests the most active club, names what ends elsewhere and the deadline, and keeps the chosen one', async () => {
    show();
    const dinamo = await screen.findByRole('button', { name: /FC Dinamo Tbilisi Academy.*Most active/ });
    expect(dinamo).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ends: Assistant coach, Fees')).toBeInTheDocument();
    expect(screen.getByText(/If you don’t choose by .*, we keep FC Dinamo Tbilisi Academy\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Saburtalo/ }));
    expect(screen.getByTestId('address')).toHaveTextContent('?club=2');
    api.post.mockResolvedValueOnce({ data: { chosenClubId: 2, ended: [{ clubId: 1, name: 'FC Dinamo Tbilisi Academy' }] } });
    fireEvent.click(screen.getByRole('button', { name: 'Keep Saburtalo' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/me/staff-club', { clubId: 2 }));
    expect(await screen.findByText('You’re staff at Saburtalo.')).toBeInTheDocument();
    expect(screen.getByText(/Your jobs at FC Dinamo Tbilisi Academy ended and stay in your career/)).toBeInTheDocument();
});

it('owning another club asks to hand it over first', async () => {
    show();
    await screen.findByRole('button', { name: /Saburtalo/ });
    api.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'OWNER_ELSEWHERE', otherClubId: 2, otherClubName: 'Saburtalo' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Keep FC Dinamo Tbilisi Academy' }));
    expect(await screen.findByText('You’re staff at Saburtalo. Leave Saburtalo first.')).toBeInTheDocument();
});

it('Home shows the card only while a club is to be chosen', async () => {
    const { unmount } = render(<MemoryRouter><StaffClubCard /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Choose your club' })).toHaveAttribute('href', '/me/staff-club');
    unmount();
    api.get.mockResolvedValue({ data: { needed: false, deadline: null, suggestedClubId: null, chosenClubId: null, clubs: [] } });
    const { container } = render(<MemoryRouter><StaffClubCard /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
});
