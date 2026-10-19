import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import './i18n';

vi.mock('./context/AuthContext', () => ({
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({ status: 'authenticated', isAuthenticated: true, isBootstrapping: false, sessionId: 'rails-member',
        user: { id: 1, profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true }, logout: vi.fn() }),
}));
vi.mock('./components/layout/header/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('./features/dola/DolaProvider', () => ({ DolaProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('./features/dola/AgentDolaPage', () => ({ AgentDolaPage: () => null, DolaDock: () => null }));
vi.mock('./features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue(null) }));
vi.mock('./pages/FeedPage', () => ({ FeedPage: () => <h1>Home feed</h1> }));
vi.mock('./components/layout/LeftSidebar', () => ({ LeftSidebar: () => <aside aria-label="Left rail" /> }));
vi.mock('./components/layout/RightSidebar', () => ({ RightSidebar: () => <aside aria-label="Right rail" /> }));
import App from './App';

// The window width, as the Home rails' media query sees it.
const screenSize = vi.hoisted(() => ({ wide: false, listeners: new Set<() => void>() }));
const matchMedia = (query: string) => ({
    matches: query === '(min-width: 1000px)' && screenSize.wide, media: query, onchange: null,
    addEventListener: (_: string, listener: () => void) => screenSize.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => screenSize.listeners.delete(listener),
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
});
const resize = (wide: boolean) => act(() => { screenSize.wide = wide; screenSize.listeners.forEach(listener => listener()); });

beforeEach(() => { screenSize.wide = false; screenSize.listeners.clear(); vi.stubGlobal('matchMedia', vi.fn(matchMedia)); window.history.replaceState({}, '', '/home'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('Home side rails', () => {
    it('are not loaded on a phone, where no rule shows them', async () => {
        render(<App />);
        expect(await screen.findByRole('heading', { name: 'Home feed' })).toBeInTheDocument();
        expect(screen.queryByRole('complementary', { name: 'Left rail' })).not.toBeInTheDocument();
        expect(screen.queryByRole('complementary', { name: 'Right rail' })).not.toBeInTheDocument();
    });

    it('load once the window is wide enough and stay when it narrows again', async () => {
        render(<App />);
        await screen.findByRole('heading', { name: 'Home feed' });
        resize(true);
        expect(await screen.findByRole('complementary', { name: 'Left rail' })).toBeInTheDocument();
        expect(await screen.findByRole('complementary', { name: 'Right rail' })).toBeInTheDocument();
        resize(false);
        expect(screen.getByRole('complementary', { name: 'Right rail' })).toBeInTheDocument();
    });
});
