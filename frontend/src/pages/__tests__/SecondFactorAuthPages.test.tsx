import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '../../i18n';
import { LoginPage } from '../LoginPage';
import { RegisterPage } from '../RegisterPage';
import { VerifyEmailPage } from '../VerifyEmailPage';
import { LandingPage } from '../LandingPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth } from '../../utils/authStorage';
import { getAuthFlow, rememberAuthFlow } from '../../utils/authRedirect';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@react-oauth/google', () => ({ GoogleLogin: ({ onSuccess }: { onSuccess: (value: { credential: string }) => void }) => <button onClick={() => onSuccess({ credential: 'synthetic-google-proof' })}>Test Google sign-in</button> }));
vi.mock('../../components/auth/AuthSplitShell', () => ({ AuthSplitShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/layout/GrasskickzLogo', () => ({ GrasskickzLogo: () => <span>GrassKickZ</span> }));
vi.mock('../../features/world/map/WorldMapView', () => ({ WorldMapView: () => <div>Map</div> }));
vi.mock('../../components/landing/LandingStory', () => ({ LandingStory: () => <div /> }));

const login = vi.fn();
const Location = () => <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>;
const change = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
const verify = async () => {
    await screen.findByRole('heading', { name: 'Verify your sign-in' });
    expect(login).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Authenticator or recovery code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('verified-token'));
};
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); clearStoredAuth();
    login.mockResolvedValue({ id: 7, profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true, dob: '2000-01-01' });
    vi.mocked(useAuth).mockReturnValue({ loginWithAccessToken: login, isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockImplementation(async (url, body) => {
        if (url === '/auth/register') return { data: { emailVerificationRequired: false } };
        return { data: (body as { oneTimeCode?: string } | undefined)?.oneTimeCode ? { accessToken: 'verified-token' } : { twoFactorRequired: true } };
    });
});

it('requires the second factor on the password Login page and retries only the submitted primary proof', async () => {
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /><Location /></MemoryRouter>);
    change('auth-login-email', 'person@example.test'); change('auth-login-password', 'SyntheticPassword1');
    fireEvent.submit(document.querySelector('form')!);
    await verify();
    expect(apiClient.post).toHaveBeenLastCalledWith('/auth/login', { email: 'person@example.test', password: 'SyntheticPassword1', oneTimeCode: '123456' }, expect.anything());
    expect(login).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/home'));
});

it.each([LoginPage, RegisterPage])('requires the second factor for Google in the %s page', async Page => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Test Google sign-in' }));
    await verify();
    expect(apiClient.post).toHaveBeenLastCalledWith('/auth/google', { token: 'synthetic-google-proof', oneTimeCode: '123456' }, expect.anything());
});

it.each([LoginPage, RegisterPage])('explains the explicit account-linking requirement on the %s page without accepting credentials', async Page => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 409, data: { code: 'provider_link_required' } } });
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Test Google sign-in' }));
    expect(await screen.findByText('Sign in using your existing method, then open Account → Linked Accounts to connect Google.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
});

it('handles the existing-account challenge after registration auto-login without repeating registration', async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    change('auth-name', 'Example Player'); change('auth-email', 'person@example.test');
    change('auth-password', 'SyntheticPassword1'); change('auth-dob', '2000-01-01');
    fireEvent.submit(document.querySelector('form')!);
    await verify();
    expect(vi.mocked(apiClient.post).mock.calls.filter(([url]) => url === '/auth/register')).toHaveLength(1);
    expect(vi.mocked(apiClient.post).mock.calls.filter(([url]) => url === '/auth/login')).toHaveLength(2);
});

it('registers without a role, keeps the town for the first run and preserves the email verification step', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { emailVerificationRequired: true } });
    render(<MemoryRouter initialEntries={['/signup']}><RegisterPage /><Location /></MemoryRouter>);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    change('auth-name', 'Example Parent'); change('auth-email', 'PARENT@example.test');
    change('auth-password', 'SyntheticPassword1');
    fireEvent.change(document.getElementById('auth-town')!, { target: { value: 'Rustavi' } });
    change('auth-dob', '2020-01-01'); fireEvent.submit(document.querySelector('form')!);
    expect(apiClient.post).not.toHaveBeenCalled();
    change('auth-dob', '1990-01-01'); fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/verify-email'));
    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
        fullName: 'Example Parent', email: 'parent@example.test', role: 'FAN', dateOfBirth: '1990-01-01',
    }), expect.anything());
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).not.toHaveProperty('town');
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
    expect(getAuthFlow()).toMatchObject({ email: 'parent@example.test', newAccount: true, awaitingVerification: true, town: 'Rustavi' });
    expect(getAuthFlow().nextPath).toBeUndefined();
});

it('signs up with email only: a phone number is not accepted', async () => {
    render(<MemoryRouter initialEntries={['/signup']}><RegisterPage /></MemoryRouter>);
    change('auth-name', 'Example Player'); change('auth-email', '+995 555 12 34 56');
    change('auth-password', 'SyntheticPassword1'); change('auth-dob', '1990-01-01');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
});

it.each([
    { nextPath: undefined, expected: '/start', token: 'synthetic-parent-default' },
    { nextPath: '/consent?token=synthetic-consent', expected: '/consent?token=synthetic-consent', token: 'synthetic-parent-consent' },
])('keeps a new account’s destination through email verification and login: $expected', async ({ nextPath, expected, token }) => {
    rememberAuthFlow({ email: 'parent@example.test', newAccount: true, awaitingVerification: true, nextPath });
    vi.mocked(apiClient.post).mockImplementation(async (url) => url === '/auth/verify-email'
        ? { data: { email: 'parent@example.test' } }
        : { data: { accessToken: 'verified-token' } });
    login.mockResolvedValue({ id: 7, role: 'PARENT', profileComplete: true, onboardingRequired: false, emailVerified: true, dob: '1990-01-01' });
    render(<MemoryRouter initialEntries={[`/verify-email?token=${token}`]}>
        <Routes>
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/parent" element={<p>Parent Hub</p>} />
            <Route path="/start" element={<p>Your first run</p>} />
            <Route path="/consent" element={<p>Club consent</p>} />
        </Routes>
        <Location />
    </MemoryRouter>);
    const continueLink = await screen.findByRole('link', { name: 'Continue to sign in' });
    expect(continueLink).toHaveAttribute('href', '/login');
    fireEvent.click(continueLink);
    expect(document.getElementById('auth-login-email')).toHaveValue('parent@example.test');
    change('auth-login-password', 'SyntheticPassword1');
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(expected));
    // App consumes this state once the final route renders. Login must retain it
    // through the account-boundary remount (covered in AuthContinuation.test).
    expect(getAuthFlow()).toMatchObject({ newAccount: true, awaitingVerification: false });
    expect(getAuthFlow().nextPath).toBe(nextPath);
});

it('asks the same five things whoever opens signup, a club consent link included', () => {
    rememberAuthFlow({ nextPath: '/consent?token=synthetic-consent' });
    render(<MemoryRouter initialEntries={['/signup']}><RegisterPage /></MemoryRouter>);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(['auth-name', 'auth-email', 'auth-password', 'auth-dob', 'auth-town'].every(id => document.getElementById(id))).toBe(true);
    fireEvent.submit(document.querySelector('form')!);
    expect(apiClient.post).not.toHaveBeenCalled();
});

it('requires the second factor in the Landing page sign-in', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    change('landing-email', 'person@example.test'); change('landing-password', 'SyntheticPassword1');
    fireEvent.submit(screen.getByRole('form', { name: 'Log in to GrassKickZ' }));
    await verify();
    expect(login).toHaveBeenCalledTimes(1);
});

it('cancels password sign-in without accepting a token and clears the password field', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    change('auth-login-email', 'person@example.test'); change('auth-login-password', 'SyntheticPassword1');
    fireEvent.submit(document.querySelector('form')!);
    await screen.findByRole('heading', { name: 'Verify your sign-in' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel sign-in' }));
    await waitFor(() => expect(document.getElementById('auth-login-password')).toHaveValue(''));
    expect(login).not.toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
});

it('aborts registration on unmount and never starts a late auto-login', async () => {
    let finish!: (value: { data: { emailVerificationRequired: boolean } }) => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    change('auth-name', 'Example Player'); change('auth-email', 'person@example.test');
    change('auth-password', 'SyntheticPassword1'); change('auth-dob', '2000-01-01');
    fireEvent.submit(document.querySelector('form')!);
    const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => finish({ data: { emailVerificationRequired: false } }));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
});
