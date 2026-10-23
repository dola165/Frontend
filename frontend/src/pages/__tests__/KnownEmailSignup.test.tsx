import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '../../i18n';
import { LoginPage } from '../LoginPage';
import { RegisterPage } from '../RegisterPage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { clearStoredAuth } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));
vi.mock('../../components/auth/AuthSplitShell', () => ({ AuthSplitShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/layout/GrasskickzLogo', () => ({ GrasskickzLogo: () => <span>GrassKickZ</span> }));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const change = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
const signUp = (dob: string) => {
    render(<MemoryRouter initialEntries={['/signup']}><Routes><Route path="/signup" element={<RegisterPage />} /><Route path="/login" element={<LoginPage />} /></Routes><Location /></MemoryRouter>);
    change('auth-name', 'Example Person'); change('auth-email', 'Known@Example.test');
    change('auth-password', 'SyntheticPassword1'); change('auth-dob', dob);
    fireEvent.submit(document.querySelector('form')!);
};

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); clearStoredAuth();
    vi.mocked(useAuth).mockReturnValue({ loginWithAccessToken: vi.fn(), isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 409, data: { code: 'ACCOUNT_EXISTS', detail: 'You already have an account. Sign in instead.' } } });
});

it('moves a known email to sign-in with the email filled in, instead of an error', async () => {
    signUp('1990-05-01');
    expect(await screen.findByText('You already have an account. Sign in with your password.')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(document.getElementById('auth-login-email')).toHaveValue('known@example.test');
    expect(document.getElementById('auth-login-password')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.post).mock.calls.map(([url]) => url)).toEqual(['/auth/register']);
});

it('tells someone under 18 to ask a parent, and stays on sign-up', async () => {
    signUp(`${new Date().getFullYear() - 15}-01-01`);
    expect(await screen.findByText('This email is already used. Ask a parent to add you.')).toBeInTheDocument();
    expect(document.getElementById('auth-email')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/signup'));
});
