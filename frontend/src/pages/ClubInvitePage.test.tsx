import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClubInvitePage } from './ClubInvitePage';

const api = vi.hoisted(() => ({ post: vi.fn(), login: vi.fn() }));
vi.mock('../api/axiosConfig', () => ({ apiClient: { post: api.post }, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ loginWithAccessToken: api.login }) }));

const preview = {
    email: 'luka@example.test', invitedName: 'Luka Beridze', hasPassword: false,
    invites: [{ kind: 'APPOINTMENT', id: 9, revision: 3, clubId: 7, clubName: 'FC Dinamo Tbilisi Academy', clubLogoUrl: null, invitedBy: 'Nino', job: 'ASSISTANT_COACH', title: 'Assistant coach', clubWide: false, squads: ['U12'], unavailableReason: null }],
};
const open = () => render(<MemoryRouter initialEntries={['/club-invite?token=abc.def']}><Routes>
    <Route path="/club-invite" element={<ClubInvitePage />} />
    <Route path="/my-squads" element={<p>My squads page</p>} />
</Routes></MemoryRouter>);
const fill = (birth: string) => {
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: birth } });
    fireEvent.change(screen.getByLabelText('Choose a password'), { target: { value: 'Secret123' } });
    fireEvent.change(screen.getByLabelText('Password again'), { target: { value: 'Secret123' } });
};

beforeEach(() => { vi.clearAllMocks(); api.login.mockResolvedValue({ id: 2 }); });
afterEach(cleanup);

it('shows who invited them to which job, and accepting sets the account up and lands in My squads', async () => {
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: preview };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test' } };
        if (url === '/auth/login') return { data: { accessToken: 'jwt' } };
        return { data: {} };
    });
    open();
    expect(await screen.findByRole('heading', { name: 'Nino invited you' })).toBeInTheDocument();
    expect(screen.getByText('Assistant coach · U12')).toBeInTheDocument();
    expect(screen.getByText('FC Dinamo Tbilisi Academy')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toHaveValue('Luka Beridze');

    fill('1994-04-04');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('My squads page')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/club-invite/claim', { token: 'abc.def', name: 'Luka Beridze', dateOfBirth: '1994-04-04', password: 'Secret123' });
    expect(api.login).toHaveBeenCalledWith('jwt');
    expect(api.post).toHaveBeenCalledWith('/clubs/7/operations/appointments/9/transition', { status: 'ACTIVE', revision: 3 });
});

it('refuses an under-18 before any account is made: club jobs are for adults', async () => {
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: preview };
        throw { isAxiosError: true, response: { status: 409, data: { detail: 'Club jobs are for adults (18 or older), so you can’t take this one yet. Let Nino know; nothing has been set up.' } } };
    });
    open();
    await screen.findByRole('heading', { name: 'Nino invited you' });
    fill('2010-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Club jobs are for adults (18+).');
    expect(api.post).not.toHaveBeenCalledWith('/auth/club-invite/claim', expect.anything());
    expect(api.login).not.toHaveBeenCalled();
});

it('declining asks once and tells the club', async () => {
    api.post.mockImplementation(async (url: string) => url === '/auth/club-invite/preview' ? { data: preview } : { data: { declined: 1 } });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, decline' }));
    expect(await screen.findByRole('heading', { name: 'You declined' })).toBeInTheDocument();
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/club-invite/decline', { token: 'abc.def' }));
});

it('a used or expired link explains itself', async () => {
    api.post.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { detail: 'This invitation link has expired. Ask the club for a new one.' } } });
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('This invitation link has expired');
});
