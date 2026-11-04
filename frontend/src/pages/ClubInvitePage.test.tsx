import { Fragment, StrictMode, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClubInvitePage } from './ClubInvitePage';
import { forgetClaimedLink } from '../features/clubOperations/people/inviteLinkApi';

const api = vi.hoisted(() => ({ post: vi.fn(), login: vi.fn(), isAuthenticated: false }));
vi.mock('../api/axiosConfig', () => ({ apiClient: { post: api.post }, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ loginWithAccessToken: api.login, isAuthenticated: api.isAuthenticated }) }));

const preview = {
    email: 'luka@example.test', invitedName: 'Luka Beridze', hasPassword: false,
    invites: [{ kind: 'APPOINTMENT', id: 9, revision: 3, clubId: 7, clubName: 'FC Dinamo Tbilisi Academy', clubLogoUrl: null, invitedBy: 'Nino', job: 'ASSISTANT_COACH', title: 'Assistant coach', clubWide: false, squads: ['U12'], unavailableReason: null }],
};
const routes = <Routes>
    <Route path="/club-invite" element={<ClubInvitePage />} />
    <Route path="/my-squads" element={<p>My squads page</p>} />
    <Route path="/requests" element={<p>Inbox page</p>} />
    <Route path="/login" element={<p>Sign-in page</p>} />
</Routes>;
const open = (link = '/club-invite?token=abc.def') => render(<MemoryRouter initialEntries={[link]}>{routes}</MemoryRouter>);
const fill = (birth: string) => {
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: birth } });
    fireEvent.change(screen.getByLabelText('Choose a password'), { target: { value: 'Secret123' } });
};

beforeEach(() => { vi.clearAllMocks(); localStorage.removeItem('gk-session-id'); api.isAuthenticated = false; api.login.mockResolvedValue({ id: 2 }); forgetClaimedLink(); });
afterEach(cleanup);

it('shows who invited them to which job, and accepting sets the account up and opens My squads', async () => {
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
    expect(api.post).toHaveBeenCalledWith('/clubs/7/operations/appointments/9/transition', { status: 'ACTIVE', revision: 3 }, { _authSessionId: null });
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

it('an expired link explains itself', async () => {
    api.post.mockRejectedValue({ isAxiosError: true, response: { status: 410, data: { code: 'expired_token', detail: 'This invitation link has expired. Ask the club for a new one.' } } });
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('This invitation link has expired');
});

const usedLink = { isAxiosError: true, response: { status: 410, data: { code: 'used_token', detail: 'This invitation link has already been used.' } } };
it('a used link may also be a declined or replaced one: signed out, it offers sign-in and a new link without promising an account', async () => {
    api.post.mockRejectedValue(usedLink);
    open();
    expect(await screen.findByRole('heading', { name: 'This link has been used' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Already set up your account? Sign in: your jobs are in your Inbox. If not, ask the club for a new link.');
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toContain('login');
});
it('opened a second time while signed in, a used link goes to the Inbox', async () => {
    api.isAuthenticated = true;
    api.post.mockRejectedValue(usedLink);
    open();
    expect(await screen.findByText('Inbox page')).toBeInTheDocument();
});

it('signing in remounts the app: the fresh page accepts the job once and never asks about the used link', async () => {
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: preview };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test', confirmationSent: false, emailConfirmed: true } };
        if (url === '/auth/login') return { data: { accessToken: 'jwt' } };
        return { data: {} };
    });
    const Session = () => { const [session, setSession] = useState(0); return <><button type="button" onClick={() => setSession(next => next + 1)}>New session</button><Fragment key={session}>{routes}</Fragment></>; };
    api.login.mockImplementation(async () => { api.isAuthenticated = true; fireEvent.click(screen.getByRole('button', { name: 'New session' })); });
    render(<MemoryRouter initialEntries={['/club-invite?token=abc.def&proof=mail.proof']}><Session /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Nino invited you' });
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('My squads page')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/club-invite/claim', { token: 'abc.def', name: 'Luka Beridze', dateOfBirth: '1990-01-01', password: 'Secret123', emailProof: 'mail.proof' });
    expect(api.post.mock.calls.filter(([url]) => url === '/auth/club-invite/preview')).toHaveLength(1);
    expect(api.post.mock.calls.filter(([url]) => url === '/clubs/7/operations/appointments/9/transition')).toHaveLength(1);
});

const signedInSession = () => {
    const claim = async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: preview };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test' } };
        return { data: { accessToken: 'jwt' } };
    };
    const Session = () => { const [session, setSession] = useState(0); return <><button type="button" onClick={() => setSession(next => next + 1)}>New session</button><Fragment key={session}>{routes}</Fragment></>; };
    api.login.mockImplementation(async () => { api.isAuthenticated = true; fireEvent.click(screen.getByRole('button', { name: 'New session' })); });
    return { claim, Session };
};
const refusedByEmail = { isAxiosError: true, response: { status: 403, data: { code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'JOB', jobTitle: 'Assistant coach', resendPath: '/auth/send-verification' } } };

it('reopened while the job is being accepted, the page on screen shows how it ended, with one acceptance sent', async () => {
    const { claim, Session } = signedInSession();
    let refuse!: (failure: unknown) => void;
    api.post.mockImplementation((url: string) => url.includes('/transition') ? new Promise((_, reject) => { refuse = reject; }) : claim(url));
    render(<StrictMode><MemoryRouter initialEntries={['/club-invite?token=abc.def']}><Session /></MemoryRouter></StrictMode>);
    await screen.findByRole('heading', { name: 'Nino invited you' });
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url.includes('/transition'))).toHaveLength(1));
    // Away and back: another fresh page, while the first answer is still on its way.
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(await screen.findByText('Setting up your job…')).toBeInTheDocument();
    refuse(refusedByEmail);
    expect(await screen.findByText('Confirm your email to start as Assistant coach · U12')).toBeInTheDocument();
    expect(api.post.mock.calls.filter(([url]) => url.includes('/transition'))).toHaveLength(1);
});

it('stops accepting when the session ends, so the next job is never sent under whoever signs in next', async () => {
    const { claim, Session } = signedInSession();
    const two = { ...preview, invites: [preview.invites[0], { ...preview.invites[0], id: 10, title: 'Team manager', job: 'TEAM_MANAGER' }] };
    let refuse!: (failure: unknown) => void;
    api.post.mockImplementation((url: string) => {
        if (url === '/auth/club-invite/preview') return Promise.resolve({ data: two });
        return url.includes('/transition') ? new Promise((_, reject) => { refuse = reject; }) : claim(url);
    });
    render(<MemoryRouter initialEntries={['/club-invite?token=abc.def']}><Session /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Nino invited you' });
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url.includes('/transition'))).toHaveLength(1));
    localStorage.setItem('gk-session-id', 'somebody-else');
    refuse({ code: 'AUTH_SESSION_CHANGED' });
    expect(await screen.findByText('Inbox page')).toBeInTheDocument();
    expect(api.post.mock.calls.filter(([url]) => url.includes('/transition'))).toHaveLength(1);
});

it('once the link is used, a failed sign-in goes to sign-in instead of trying the used link again', async () => {
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: preview };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test' } };
        throw new Error('network');
    });
    open();
    await screen.findByRole('heading', { name: 'Nino invited you' });
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('Sign-in page')).toBeInTheDocument();
    expect(api.post.mock.calls.filter(([url]) => url === '/auth/club-invite/claim')).toHaveLength(1);
});

it('after claiming, a job that waits on the email says "Confirm your email to start as …" with Resend', async () => {
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: preview };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test' } };
        if (url === '/auth/login') return { data: { accessToken: 'token' } };
        if (url === '/auth/send-verification') return { data: {} };
        throw { isAxiosError: true, response: { status: 403, data: { code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'JOB', jobTitle: 'Assistant coach', resendPath: '/auth/send-verification' } } };
    });
    open();
    await screen.findByRole('heading', { name: 'Nino invited you' });
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('Confirm your email to start as Assistant coach · U12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/send-verification', { continuationPath: '/requests?view=needs-you' }));
    expect(await screen.findByText(/Sent. Open the link/)).toBeInTheDocument();
});

it('after claiming a project helper’s link, says "Confirm your email to see …" with Resend, not an empty project', async () => {
    const helper = { ...preview, invites: [{ ...preview.invites[0], kind: 'PROJECT_HELPER', id: 12, revision: null, job: 'PROJECT_HELPER', title: 'New kit for U12', squads: [] }] };
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: helper };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test', confirmationSent: true } };
        if (url === '/auth/login') return { data: { accessToken: 'token' } };
        return { data: {} };
    });
    open();
    expect(await screen.findByText('On a project · New kit for U12')).toBeInTheDocument();
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('Confirm your email to see New kit for U12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    // The new email's link opens the project once confirmed.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/send-verification', { continuationPath: '/projects/12' }));
});

it('a helper whose emailed link proved the address sees the project at once, with no email to wait for', async () => {
    const helper = { ...preview, invites: [{ ...preview.invites[0], kind: 'PROJECT_HELPER', id: 12, revision: null, job: 'PROJECT_HELPER', title: 'New kit for U12', squads: [] }] };
    api.post.mockImplementation(async (url: string) => {
        if (url === '/auth/club-invite/preview') return { data: helper };
        if (url === '/auth/club-invite/claim') return { data: { email: 'luka@example.test', confirmationSent: false, emailConfirmed: true } };
        if (url === '/auth/login') return { data: { accessToken: 'token' } };
        return { data: {} };
    });
    render(<MemoryRouter initialEntries={['/club-invite?token=abc.def&proof=mail.proof']}><Routes>
        <Route path="/club-invite" element={<ClubInvitePage />} />
        <Route path="/projects/12" element={<p>The project</p>} />
    </Routes></MemoryRouter>);
    await screen.findByText('On a project · New kit for U12');
    fill('1990-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('The project')).toBeInTheDocument();
});
