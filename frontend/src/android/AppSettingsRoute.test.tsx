import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('./bridge', async importOriginal => ({ ...await importOriginal<typeof import('./bridge')>(), isAndroidApp: true, nativeCall: vi.fn().mockResolvedValue({ status: 204 }) }));
vi.mock('../context/AuthContext', () => ({
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({ status: auth.signedIn ? 'authenticated' : 'guest', isAuthenticated: auth.signedIn, isBootstrapping: false, sessionId: 'test',
        user: auth.signedIn ? { id: 1, role: 'FAN', fullName: 'Test', onboardingRequired: false } : null, logout: vi.fn() }),
}));
vi.mock('../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue({ hasClubMembership: false }) }));
import App from '../App';
afterEach(() => { cleanup(); auth.signedIn = true; window.history.replaceState({}, '', '/'); });

it('opens app settings through the actual Android route layout', async () => {
    window.history.replaceState({}, '', '/app-settings');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'App settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.queryByText('We could not find that page')).not.toBeInTheDocument();
});
it('allows device preferences before sign-in without opening private account settings', async () => {
    auth.signedIn = false;
    window.history.replaceState({}, '', '/app-settings');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'App settings' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app-settings');
});
