import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n';

const auth = vi.hoisted(() => ({ signedIn: true, onboardingRequired: false, mustChangePassword: false }));
vi.mock('../../android/bridge', async importOriginal => ({
    ...await importOriginal<typeof import('../../android/bridge')>(),
    isAndroidApp: true, nativeCall: vi.fn().mockResolvedValue({ status: 204 }),
}));
vi.mock('../../context/AuthContext', () => ({
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({ status: auth.signedIn ? 'authenticated' : 'guest', isAuthenticated: auth.signedIn, isBootstrapping: false, sessionId: 'organization-route',
        user: auth.signedIn ? { id: 17, role: 'FAN', fullName: 'Test', onboardingRequired: auth.onboardingRequired, mustChangePassword: auth.mustChangePassword } : null, logout: vi.fn() }),
}));
vi.mock('../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue({ hasClubMembership: false }) }));
vi.mock('../../features/tournaments/api', () => ({ fetchMyOrganizations: vi.fn().mockResolvedValue([]), createOrganization: vi.fn() }));
vi.mock('../LoginPage', () => ({ LoginPage: () => <h1>Sign in first</h1> }));
vi.mock('../OnboardingPage', () => ({ OnboardingPage: () => <h1>Complete onboarding</h1> }));
vi.mock('../SetPasswordPage', () => ({ SetPasswordPage: () => <h1>Set password first</h1> }));
import App from '../../App';

afterEach(() => {
    cleanup();
    auth.signedIn = true; auth.onboardingRequired = false; auth.mustChangePassword = false;
    window.history.replaceState({}, '', '/');
});

const openOrganization = () => {
    window.history.replaceState({}, '', '/organizations/create');
    render(<App />);
};

it('opens organization creation for an authenticated non-organizer persona through the actual Android route', async () => {
    openOrganization();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/organizations/create');
});

it('keeps organization creation behind the existing sign-in gate', async () => {
    auth.signedIn = false;
    openOrganization();
    expect(await screen.findByRole('heading', { name: 'Sign in first' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/organizations/create');
});

it('retains required onboarding before organization creation', async () => {
    auth.onboardingRequired = true;
    openOrganization();
    expect(await screen.findByRole('heading', { name: 'Complete onboarding' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Organization' })).not.toBeInTheDocument();
});

it('retains the required password-change step before organization creation', async () => {
    auth.mustChangePassword = true;
    openOrganization();
    expect(await screen.findByRole('heading', { name: 'Set password first' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Organization' })).not.toBeInTheDocument();
});
