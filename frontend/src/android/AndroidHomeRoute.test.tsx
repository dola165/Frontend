import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';

const sidebars = vi.hoisted(() => ({ imports: vi.fn(), mount: vi.fn() }));
vi.mock('./bridge', async importOriginal => ({
    ...await importOriginal<typeof import('./bridge')>(),
    isAndroidApp: true,
    nativeCall: vi.fn().mockResolvedValue({ status: 204 }),
}));
vi.mock('../context/AuthContext', () => ({
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({ status: 'authenticated', isAuthenticated: true, isBootstrapping: false, sessionId: 'test',
        user: { id: 1, role: 'FAN', fullName: 'Test', onboardingRequired: false }, logout: vi.fn() }),
}));
vi.mock('../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../components/layout/TopNav', () => ({ TopNav: () => null }));
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => null }));
vi.mock('../pages/FeedPage', () => ({ FeedPage: () => <h1>Home feed</h1> }));
vi.mock('../components/layout/LeftSidebar', () => {
    sidebars.imports('left');
    return { LeftSidebar: () => { sidebars.mount('left'); return <aside>Web shortcuts</aside>; } };
});
vi.mock('../components/layout/RightSidebar', () => {
    sidebars.imports('right');
    return { RightSidebar: () => { sidebars.mount('right'); return <aside>Web quick chat</aside>; } };
});
import App from '../App';

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });

it('opens the actual Android home route without importing or mounting browser sidebar side effects', async () => {
    window.history.replaceState({}, '', '/home');
    const view = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Home feed' })).toBeInTheDocument();
    view.rerender(<App />);
    expect(sidebars.imports).not.toHaveBeenCalled();
    expect(sidebars.mount).not.toHaveBeenCalled();
    expect(screen.queryByText('Web quick chat')).not.toBeInTheDocument();
});
