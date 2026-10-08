import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '../../i18n';
import { getAuthFlow } from '../../utils/authRedirect';

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('../../android/bridge', async importOriginal => ({
  ...await importOriginal<typeof import('../../android/bridge')>(),
  isAndroidApp: true, nativeCall: vi.fn().mockResolvedValue({ status: 204 }),
}));
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    status: auth.signedIn ? 'authenticated' : 'guest', isAuthenticated: auth.signedIn, isBootstrapping: false,
    sessionId: auth.signedIn ? 'football-workflow-route' : null,
    user: auth.signedIn ? { id: 17, role: 'PARENT', fullName: 'Test Parent', onboardingRequired: false, mustChangePassword: false } : null,
    logout: vi.fn(),
  }),
}));
vi.mock('../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue({ hasClubMembership: false }) }));
vi.mock('../../features/squadEnrollment/SquadEnrollment', () => ({
  SquadJoinPage: () => <h1>Squad invitation route</h1>,
  FamilyEnrollmentPage: () => <h1>Family enrollment route</h1>,
}));
vi.mock('../../features/tournamentSeries/TournamentSeriesPage', () => ({ TournamentSeriesPage: () => <h1>Tournament series route</h1> }));
vi.mock('../VolunteerPage', () => ({ VolunteerPage: () => <h1>Volunteer shifts route</h1> }));
vi.mock('../EventVenuePage', () => ({ EventVenuePage: () => <h1>Event stadium reservation route</h1> }));
vi.mock('../LoginPage', () => ({ LoginPage: () => <h1>Sign in first</h1> }));
import App from '../../App';

const unavailableRoutes = [
  ['/join-squad', 'Squad enrollment is not available yet', 'Squad invitation route'],
  ['/parent/enrollment', 'Squad enrollment is not available yet', 'Family enrollment route'],
  ['/volunteering', 'Volunteer shifts is not available yet', 'Volunteer shifts route'],
  ['/event-venues', 'Event stadium reservations is not available yet', 'Event stadium reservation route'],
  ['/tournament-series/1', 'Tournament series is not available yet', 'Tournament series route'],
] as const;

beforeEach(() => { auth.signedIn = true; window.sessionStorage.clear(); });
afterEach(() => {
  cleanup(); auth.signedIn = true;
  window.sessionStorage.clear(); window.history.replaceState({}, '', '/');
});
const openRoute = (path: string) => {
  window.history.replaceState({}, '', path);
  return render(<App />);
};

it.each(unavailableRoutes)(
  'shows the truthful capability boundary at %s without mounting unfinished UI', async (path, boundaryHeading, featureHeading) => {
    openRoute(path);
    expect(await screen.findByRole('heading', { name: boundaryHeading })).toBeVisible();
    expect(screen.queryByRole('heading', { name: featureHeading })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  },
);

it.each(unavailableRoutes)('does not ask a guest to sign in for unavailable route %s', async (path, boundaryHeading) => {
  auth.signedIn = false; openRoute(path);
  expect(await screen.findByRole('heading', { name: boundaryHeading })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Sign in first' })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
  expect(getAuthFlow().nextPath).toBeUndefined();
});

it('does not begin a sign-in continuation for an unavailable squad invitation', async () => {
  auth.signedIn = false;
  const token = 'a'.repeat(43), destination = `/join-squad#${token}`;
  openRoute(destination);
  expect(await screen.findByRole('heading', { name: 'Squad enrollment is not available yet' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Sign in first' })).not.toBeInTheDocument();
  expect(getAuthFlow().nextPath).toBeUndefined();
  expect(window.sessionStorage.length).toBe(0);
});
