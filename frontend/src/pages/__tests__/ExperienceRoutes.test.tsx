import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '../../i18n';
import { clearAuthFlow, getAuthFlow } from '../../utils/authRedirect';

const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ status: auth.signedIn ? 'authenticated' : 'anonymous', isAuthenticated: auth.signedIn,
    isBootstrapping: false, sessionId: auth.signedIn ? 'experience-member' : 'experience-guest',
    user: auth.signedIn ? { id: 1, profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true } : null,
    logout: vi.fn(),
  }),
}));
vi.mock('../../components/layout/TopNav', () => ({ TopNav: () => null }));
vi.mock('../../features/dola/DolaProvider', () => ({ DolaProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../features/dola/AgentDolaPage', () => ({ AgentDolaPage: () => null, DolaDock: () => null }));
vi.mock('../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue(null) }));
vi.mock('../../features/tryouts/TryoutBrowsePage', () => ({ default: () => <h1>Public tryout directory</h1> }));
vi.mock('../../features/tryouts/TryoutDetailPage', () => ({ default: () => <h1>Public tryout details</h1> }));
vi.mock('../../features/requests/EventDiscoveryPage', () => ({ EventDiscoveryPage: () => <h1>Public event discovery</h1> }));
vi.mock('../../features/requests/RequestsCentre', () => ({ RequestsCentre: () => <h1>Private Requests centre</h1> }));
vi.mock('../../features/moderation/ReportReceipts', () => ({ ReportReceipts: () => <h1>Private report receipts</h1> }));
vi.mock('../LoginPage', () => ({ LoginPage: () => <h1>Sign in first</h1> }));
import App from '../../App';

beforeEach(() => { auth.signedIn = false; clearAuthFlow(); });
afterEach(() => { cleanup(); clearAuthFlow(); window.history.replaceState({}, '', '/'); });
const open = (path: string) => { window.history.replaceState({}, '', path); render(<App />); };
it.each([
  ['/tryouts', 'Public tryout directory', 'Tryouts'],
  ['/tryouts/51', 'Public tryout details', 'Tryouts'],
  ['/events', 'Public event discovery', 'Events'],
])('keeps %s public inside the destination shell', async (path, heading, title) => {
  open(path); const result = await screen.findByRole('heading', { name: heading });
  expect(result.closest('.app-route-frame')).toBeInTheDocument();
  expect(window.location.pathname).toBe(path); expect(document.title).toBe(`${title} | GrassKickZ`);
  expect(getAuthFlow().nextPath).toBeUndefined();
});
it.each(['/requests', '/reports'])('preserves authentication and continuation for %s', async path => {
  open(path); expect(await screen.findByRole('heading', { name: 'Sign in first' })).toBeVisible();
  expect(window.location.pathname).toBe('/login'); expect(getAuthFlow().nextPath).toBe(path);
});
it.each([['/requests', 'Private Requests centre'], ['/reports', 'Private report receipts']])('preserves the existing authenticated %s integration', async (path, heading) => {
  auth.signedIn = true; open(path); expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  expect(window.location.pathname).toBe(path);
});
