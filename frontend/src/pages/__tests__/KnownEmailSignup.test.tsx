import { fireEvent, render, screen } from '@testing-library/react';
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

it('offers sign-in for a known email, and moves there with the email filled in', async () => {
    signUp('1990-05-01');
    expect(await screen.findByText('You already have an account. Sign in?')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/signup');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(document.getElementById('auth-login-email')).toHaveValue('known@example.test');
    expect(document.getElementById('auth-login-password')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.post).mock.calls.map(([url]) => url)).toEqual(['/auth/register']);
});

it('offers to create an account for an unknown email on sign-in, keeping what was typed', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 401, data: { code: 'ACCOUNT_NOT_FOUND' } } });
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route path="/signup" element={<RegisterPage />} /><Route path="/login" element={<LoginPage />} /></Routes><Location /></MemoryRouter>);
    change('auth-login-email', 'New@Example.test'); change('auth-login-password', 'SyntheticPassword1');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('No account with this email. Create one?')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Create account' })[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/signup');
    expect(document.getElementById('auth-email')).toHaveValue('new@example.test');
});

it('offers sign-in for a known email whatever the age', async () => {
    signUp(`${new Date().getFullYear() - 17}-01-01`);
    expect(await screen.findByText('You already have an account. Sign in?')).toBeInTheDocument();
    expect(document.getElementById('auth-email')).not.toHaveAttribute('aria-invalid', 'true');
});

it('offers sign-in, not an error, when the account was made but the automatic sign-in failed', async () => {
    vi.mocked(apiClient.post).mockImplementation(async url => {
        if (url === '/auth/register') return { data: { accountState: 'AWAITING_PARENT' } };
        throw { response: { status: 503, data: { detail: 'Service unavailable' } } };
    });
    render(<MemoryRouter initialEntries={['/signup']}><Routes><Route path="/signup" element={<RegisterPage />} /><Route path="/login" element={<LoginPage />} /></Routes><Location /></MemoryRouter>);
    change('auth-name', 'Example Teen'); change('auth-email', 'teen@example.test');
    change('auth-password', 'SyntheticPassword1'); change('auth-dob', `${new Date().getFullYear() - 14}-01-01`);
    fireEvent.submit(document.querySelector('form')!);
    change('auth-parent-email', 'parent@example.test'); fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('Your account is ready. Sign in to continue.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(document.getElementById('auth-login-email')).toHaveValue('teen@example.test');
});
