import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '../../i18n';
import { LoginPage } from '../LoginPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@react-oauth/google', () => ({ GoogleLogin: ({ onSuccess }: { onSuccess: (value: { credential: string }) => void }) => <button onClick={() => onSuccess({ credential: 'synthetic-google-proof' })}>Test Google sign-in</button> }));
vi.mock('../../components/auth/AuthSplitShell', () => ({ AuthSplitShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/layout/GrasskickzLogo', () => ({ GrasskickzLogo: () => <span>GrassKickZ</span> }));

const login = vi.fn();
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const change = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
const closing = { response: { status: 409, data: { code: 'ACCOUNT_CLOSING', detail: 'You closed this account.', keepUntil: '2026-12-02T10:00:00Z' } } };
const show = () => render(<MemoryRouter initialEntries={['/login']}><LoginPage /><Location /></MemoryRouter>);

beforeEach(async () => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); clearStoredAuth();
    await i18n.changeLanguage('en');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'synthetic.apps.googleusercontent.com');
    login.mockResolvedValue({ id: 7, profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true, dob: '2000-01-01' });
    vi.mocked(useAuth).mockReturnValue({ loginWithAccessToken: login, isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockImplementation(async (_url, body) => {
        if ((body as { keepAccount?: boolean }).keepAccount) return { data: { accessToken: 'kept-token', accountState: 'ACTIVE' } };
        throw closing;
    });
});
afterEach(() => { vi.unstubAllEnvs(); });

it('offers Keep my account, with the date it is erased, after the right password for a closing account', async () => {
    show();
    change('auth-login-email', 'person@example.test'); change('auth-login-password', 'SyntheticPassword1');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('You closed this account')).toBeVisible();
    expect(screen.getByText(/otherwise it is erased on 2 December 2026/)).toBeVisible();
    expect(login).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('kept-token'));
    expect(apiClient.post).toHaveBeenLastCalledWith('/auth/login', { email: 'person@example.test', password: 'SyntheticPassword1', keepAccount: true }, expect.anything());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/home'));
});

it('keeps a closing account through Google with the same proof', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Test Google sign-in' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep my account' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('kept-token'));
    expect(apiClient.post).toHaveBeenLastCalledWith('/auth/google', { token: 'synthetic-google-proof', keepAccount: true }, expect.anything());
});

it('says it in Georgian', async () => {
    await i18n.changeLanguage('ka');
    show();
    change('auth-login-email', 'person@example.test'); change('auth-login-password', 'SyntheticPassword1');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('თქვენ დახურეთ ეს ანგარიში')).toBeVisible();
    expect(screen.getByRole('button', { name: 'ანგარიშის შენარჩუნება' })).toBeVisible();
    await i18n.changeLanguage('en');
});
