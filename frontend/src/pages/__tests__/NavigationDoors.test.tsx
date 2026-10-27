import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { MainLayout } from '../../App';
import { LeftSidebar } from '../../components/layout/LeftSidebar';
import { AccountItems } from '../../components/layout/header/AccountMenu';
import { exploreDestinations, workDestinations, workspaceDestinations } from '../../components/layout/header/pins/pinCatalog';
import { workspaceLinks, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { readPins, readVisits } from '../../components/layout/header/pins/pinStore';
import { buildNotificationDestination } from '../../utils/notifications';
import cases from '../../utils/__tests__/notification-destinations.json';
import type { NotificationItem } from '../../types/notifications';
import type { AuthUser } from '../../context/AuthContext';
import '../../i18n';

// Leaf UI is irrelevant here; real route selection, nested World routes, auth
// boundaries and redirects must run, including App's full-screen partition.
vi.mock('react', async original => {
    const react = await original<typeof import('react')>();
    return { ...react, lazy: (loader: Parameters<typeof react.lazy>[0]) => {
        const source = loader.toString();
        if (/WorldRoutes|Redirect/.test(source)) return react.lazy(loader);
        return () => react.createElement('output', { 'data-testid': source.includes('RouteRecoveryPage') ? 'missing-route' : 'mounted-route' });
    } };
});
const auth = vi.hoisted(() => ({ user: null as AuthUser | null, signedIn: true }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, status: auth.signedIn ? 'authenticated' : 'anonymous', isAuthenticated: auth.signedIn, isBootstrapping: false, sessionId: 'route-guard', logout: vi.fn(), refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock('../../components/layout/header/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('../../components/auth/ParentApprovalBanner', () => ({ ParentApprovalBanner: () => null }));
vi.mock('../../features/pages/create/CreatePageHost', () => ({ CreatePageHost: () => null }));
vi.mock('../../features/actions/ActionHost', () => ({ ActionHost: () => null }));
vi.mock('../../hooks/useBuildWatch', () => ({ useBuildWatch: () => undefined }));
vi.mock('../../hooks/useCan', () => ({ useCan: () => ({ pending: false, decide: () => ({ allowed: true }), admin: null }) }));
vi.mock('../../features/world/compose/useArrangeableSquads', () => ({ useArrangeableSquads: () => [] }));
vi.mock('../../features/actions/useResultsWaiting', () => ({ useResultsWaiting: () => [] }));
vi.mock('../../features/world/useWorldData', () => ({ useWorldData: () => ({ data: undefined, loading: false, error: '', retry: vi.fn() }) }));
vi.mock('../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue(null) }));
vi.mock('../../features/world/WorldLayout', () => ({ WorldLayout: () => <Outlet /> }));
vi.mock('../../features/world/WorldSessionProvider', () => ({ WorldSessionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../LoginPage', () => ({ LoginPage: () => <output data-testid="mounted-route" /> }));

const caps: NavigationCapabilities = { version: 1, workspaces: [
    ...['club.workspace', 'club.operations', 'club.member', 'club.family', 'club.player', 'club.agent'].map(id => ({ id, context: { type: 'club', id: 1, label: 'Synthetic academy' } })),
    ...['club.work', 'parent.hub', 'referee.workspace', 'agent.hub', 'organization.create', 'admin.console', 'team.work'].map(id => ({ id, context: { type: 'user', id: 1, label: 'Synthetic user' } })),
    ...['organization.workspace', 'organization.settings', 'venue.workspace', 'tournament.create'].map(id => ({ id, context: { type: 'organization', id: 2, label: 'Synthetic organization' } })),
    { id: 'tournament.workspace', context: { type: 'tournament', id: 3, label: 'Synthetic tournament' } },
    { id: 'squad.workspace', context: { type: 'squad', id: 4, label: 'Synthetic squad' } },
] };
const user = (navigationCapabilities?: NavigationCapabilities): AuthUser => ({ id: 1, fullName: 'Synthetic user', dob: '1990-01-01', role: 'SYSTEM_ADMIN', profileComplete: true, emailVerified: true, onboardingRequired: false, mustChangePassword: false, navigationCapabilities });
afterEach(cleanup);

it('every menu, pin, shortcut, capability and notification destination has a mounted route', async () => {
    const destinations = new Set(exploreDestinations().map(item => item.path));
    for (const projection of [caps, { version: 1 as const, workspaces: [] }, undefined]) {
        auth.user = user(projection);
        const workspaces = workspaceDestinations(projection, null);
        for (const item of [...workDestinations(projection, null), ...workspaces, ...workspaceLinks(projection)]) destinations.add('path' in item ? item.path : '');
        const navigation = render(<MemoryRouter initialEntries={['/home']}><LeftSidebar user={auth.user} />{[true, false].map(menu => <AccountItems key={String(menu)} user={auth.user!} workspaces={workspaces} menu={menu} themePreference="light" setThemePreference={() => undefined} close={() => undefined} onLogout={() => undefined} />)}</MemoryRouter>);
        const switcher = screen.queryByRole('button', { name: 'Switch workspace' });
        if (switcher) fireEvent.click(switcher);
        navigation.container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => destinations.add(link.getAttribute('href')!));
        navigation.unmount();
    }
    const guest = render(<MemoryRouter><LeftSidebar user={null} /></MemoryRouter>);
    guest.container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => destinations.add(link.getAttribute('href')!));
    guest.unmount();
    for (const item of cases) destinations.add(buildNotificationDestination({ createdAt: '', title: '', body: '', isRead: false, ...item.notification } as NotificationItem));
    // Exercise the actual stored-pin and visit readers, not just today's catalogs.
    const savedPaths = ['/roles/704', '/people?tab=players', '/account/roles#professions', '/agents/7', '/agent/dashboard', '/clubs/following', '/club-operations?appointmentId=7', '/club-operations?permissionId=8', '/notifications?itemId=1', '/clubs/1/squads?squad=12', '/squads', '/roles?engagement=VOLUNTEER', '/world/opportunities?tab=jobs', '/workspaces', '/matches', '/tournaments/setup', '/join-squad', '/parent/enrollment', '/tournament-series/2', '/volunteering', '/event-venues'];
    savedPaths.forEach((path, index) => {
        const userId = 99000 + index;
        localStorage.setItem(`gk-prefs:v1:${userId}`, JSON.stringify({ doc: { pins: { pins: [{ path, label: 'Saved page', icon: 'bookmark' }] } }, pending: null }));
        localStorage.setItem(`gk-visits:v1:${userId}`, JSON.stringify({ [path]: { t: [Date.now()], label: 'Saved page' } }));
        readPins(userId).forEach(pin => destinations.add(pin.path));
        Object.keys(readVisits(userId)).forEach(destination => destinations.add(destination));
    });
    auth.user = user(caps);
    for (const path of [...destinations].filter(path => path.startsWith('/'))) {
        const view = render(<MemoryRouter initialEntries={[path]}><MainLayout /></MemoryRouter>);
        await waitFor(() => {
            const viewport = view.container.querySelector('.app-route-arrival');
            expect(viewport?.querySelector('[data-testid="missing-route"]') ?? null, path).not.toBeInTheDocument();
            expect(viewport?.querySelector('[data-testid="mounted-route"]') ?? null, path).toBeInTheDocument();
        }, { timeout: 5000 });
        view.unmount();
    }
    expect(destinations.size).toBeGreaterThan(30);
}, 30000);

it('the guard detects the real recovery route for an unknown address', async () => {
    auth.user = user(caps);
    const view = render(<MemoryRouter initialEntries={['/this-route-does-not-exist']}><MainLayout /></MemoryRouter>);
    await waitFor(() => expect(view.container.querySelector('.app-route-arrival [data-testid="missing-route"]')).toBeInTheDocument());
});
