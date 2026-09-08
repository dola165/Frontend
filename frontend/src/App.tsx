import { useEffect, useState, type CSSProperties, type JSX } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { AppPageFrame } from './components/layout/AppPageShell';
import { ClubProfilePage } from './pages/ClubProfilePage';
import { UserProfilePage } from './pages/UserProfilePage';
import { MapPage } from './pages/MapPage';
import { FeedPage } from './pages/FeedPage';
import { LandingPage } from './pages/LandingPage';
import { BrowseClubsPage } from './pages/BrowseClubsPage';
import { MessagingPage } from './pages/MessagingPage';
import { MyClubPage } from './pages/MyClubPage';
import { CalendarPage } from './pages/CalendarPage';
import { ClubSquadsPage } from './pages/ClubSquadsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DobGatePage } from './pages/DobGatePage';
import { ConsentPage } from './pages/ConsentPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { OAuth2RedirectHandler } from './pages/OAuth2RedirectHandler';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { TournamentSetupPage } from './pages/TournamentSetupPage';
import { TournamentWorkspacePage } from './pages/TournamentWorkspacePage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { BrowseTournamentsPage } from './pages/BrowseTournamentsPage';
import { CreateOrganizationPage } from './pages/CreateOrganizationPage';
import { CreateClubPage } from './pages/CreateClubPage';
import ClubWorkspacePage from './pages/ClubWorkspacePage';
import { FollowedClubsPage } from './pages/FollowedClubsPage';
import { JobsDirectoryPage } from './pages/JobsDirectoryPage';
import { PeoplePage } from './pages/PeoplePage';
import { PostPage } from './pages/PostPage';
import { PublicWorldMapPage } from './pages/PublicWorldMapPage';
import { RouteRecoveryPage } from './pages/RouteRecoveryPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { buildLoginRedirectPath, requiredAccountStep, resolvePostAuthRedirect } from './utils/authRedirect';
import { fetchMyClubMembershipContext } from './features/clubs/api';
import { isThemePreference, type ThemePreference } from './theme';

const authRoutePaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/consent']);
const boundedCanvasPages = new Set(['/map', '/messages', '/calendar']);

const PageBootSpinner = ({ label }: { label: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#16a34a] border-t-transparent"></div>
            <p className="text-sm font-medium text-[#a1a1aa]">
                {label}
            </p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated } = useAuth();

    if (isBootstrapping) {
        return <PageBootSpinner label="Restoring Session" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    }

    return children;
};

const GuestOnlyRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated, user } = useAuth();
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/home');

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Access" />;
    }

    if (isAuthenticated) {
        return <Navigate to={requiredAccountStep(user) ?? nextPath} replace />;
    }

    return children;
};

const SystemAdminRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated, user } = useAuth();

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Admin Access" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    }

    if (user?.role !== 'SYSTEM_ADMIN') {
        return <Navigate to="/feed" replace />;
    }

    return children;
};

const OrganizerOnlyRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated, user } = useAuth();

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Access" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    }

    if (user?.role !== 'ORGANIZER') {
        return <Navigate to="/clubs" replace />;
    }

    return children;
};

// O14a — the backend also gates POST /clubs on the membership context
// (canCreateClub). Fail closed here so an existing club owner never walks the
// whole wizard just to hit a 400 on submit. Compose with OrganizerOnlyRoute so
// both the organizer-type and canCreateClub checks apply.
const ClubCreateRoute = ({ children }: { children: JSX.Element }) => {
    const [canCreateClub, setCanCreateClub] = useState<boolean | null>(null);

    useEffect(() => {
        let active = true;

        void fetchMyClubMembershipContext()
            .then((context) => {
                if (active) {
                    setCanCreateClub(context.canCreateClub === true);
                }
            })
            .catch(() => {
                if (active) {
                    setCanCreateClub(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    if (canCreateClub === null) {
        return <PageBootSpinner label="Checking Access" />;
    }

    if (!canCreateClub) {
        return <Navigate to="/clubs" replace />;
    }

    return children;
};

function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { status, user, logout } = useAuth();
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [collapsedNavLocationKey, setCollapsedNavLocationKey] = useState<string | null>(null);
    const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
        const savedPreference = localStorage.getItem('theme-preference');
        if (isThemePreference(savedPreference)) return savedPreference;

        // Migrate the former two-state setting. Existing dark users receive
        // the recommended dark-app/light-Map treatment; explicit light users
        // keep full light mode.
        const legacyTheme = localStorage.getItem('theme');
        return legacyTheme === 'light' ? 'light' : 'map-light';
    });

    useEffect(() => {
        if (status !== 'authenticated' || !user?.id) {
            return;
        }

        if (authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback') {
            return;
        }

        if (user.mustChangePassword && location.pathname !== '/set-password') {
            navigate('/set-password', { replace: true });
            return;
        }

        if (!user.mustChangePassword && user.onboardingRequired && location.pathname !== '/onboarding') {
            navigate('/onboarding', { replace: true });
        }
    }, [location.pathname, navigate, status, user]);

    const isMapRoute = location.pathname === '/map';
    const darkMode = themePreference !== 'light';
    const effectiveDarkMode = themePreference === 'dark' || (themePreference === 'map-light' && !isMapRoute);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', effectiveDarkMode);
        localStorage.setItem('theme-preference', themePreference);
        // Retain the legacy value for older clients that only understand the
        // original light/dark key.
        localStorage.setItem('theme', themePreference === 'light' ? 'light' : 'dark');
    }, [effectiveDarkMode, themePreference]);

    useEffect(() => {
        let active = true;

        if (status !== 'authenticated') {
            return () => {
                active = false;
            };
        }

        void fetchMyClubMembershipContext()
            .then((context) => {
                if (!active) {
                    return;
                }
                setMyClubId(context?.clubId ? Number(context.clubId) : null);
            })
            .catch(() => {
                if (active) {
                    setMyClubId(null);
                }
            });

        return () => {
            active = false;
        };
    }, [location.pathname, status]);

    const handleLogout = async () => {
        setMyClubId(null);
        await logout();
        navigate('/login', { replace: true });
    };

    const isLandingPage = location.pathname === '/';
    const isPublicWorldMap = location.pathname === '/world';
    const isAuthPage = authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback';
    const isHomeFeed = location.pathname === '/home' || location.pathname === '/feed';
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads|\/workspace|\/store)?$/.test(location.pathname);
    // Public destination pages with full-bleed heroes (banner + tab bars) render
    // edge-to-edge; everything else keeps the bounded wide frame.
    const isBleedDestinationPage =
        location.pathname === '/clubs' ||
        /^\/clubs\/\d+$/.test(location.pathname) ||
        /^\/profile\/\d+$/.test(location.pathname);
    const isFullScreenPage =
        ['/map', '/world', '/messages', '/clubs', '/clubs/following', '/clubs/create', '/my-club', '/calendar', '/notifications', '/onboarding', '/dob', '/set-password', '/account', '/admin', '/tournaments', '/tournaments/setup', '/marketplace', '/needs', '/store', '/jobs', '/campaigns', '/people'].includes(location.pathname) ||
        location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/posts/') ||
        location.pathname.startsWith('/organizations') ||
        location.pathname.startsWith('/tournaments/') ||
        location.pathname.startsWith('/agent') ||
        isClubSurfaceRoute;
    const isBoundedCanvasPage = boundedCanvasPages.has(location.pathname);
    // W6 — one shell: browse/list/destination pages share a single App-level
    // frame (app-page-shell + AppPageFrame, one max-width); the map, chat,
    // schedule and the management workspaces stay full-width canvases.
    const canvasWorkspacePages = new Set(['/map', '/world', '/calendar', '/messages', '/onboarding', '/dob', '/set-password']);
    const isImmersiveCanvasPage =
        canvasWorkspacePages.has(location.pathname) ||
        /^\/clubs\/\d+\/workspace$/.test(location.pathname) ||
        /^\/tournaments\/\d+\/workspace$/.test(location.pathname);
    const isCollapsibleNavWorkspace =
        ['/map', '/calendar', '/messages'].includes(location.pathname) ||
        /^\/clubs\/\d+\/workspace$/.test(location.pathname) ||
        /^\/tournaments\/\d+\/workspace$/.test(location.pathname);
    // React Router assigns a new key to every navigation entry. Binding the
    // collapsed state to that key makes it route-visit-local without an effect:
    // navigate away (or revisit later) and navigation is immediately visible.
    const isTopNavCollapsed = isCollapsibleNavWorkspace && collapsedNavLocationKey === location.key;
    const hasProductNavigation = !isLandingPage && !isAuthPage && !isPublicWorldMap;
    const activeHeaderHeight = hasProductNavigation && !isTopNavCollapsed
        ? 'var(--app-header-height)'
        : '0px';

    const fullScreenRoutes = (
        <Routes>
            <Route path="/map" element={<ProtectedRoute><MapPage darkMode={themePreference === 'dark'} /></ProtectedRoute>} />
            <Route path="/world" element={<PublicWorldMapPage />} />
            <Route path="/clubs" element={<BrowseClubsPage />} />
            <Route path="/clubs/following" element={<ProtectedRoute><FollowedClubsPage /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage user={user} darkMode={darkMode} setDarkMode={(value) => setThemePreference(value ? 'dark' : 'light')} /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagingPage /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/tournaments" element={<BrowseTournamentsPage />} />
            <Route path="/tournaments/setup" element={<ProtectedRoute><TournamentSetupPage /></ProtectedRoute>} />
            <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
            <Route path="/tournaments/:tournamentId/workspace" element={<ProtectedRoute><TournamentWorkspacePage /></ProtectedRoute>} />
            <Route path="/organizations/create" element={<OrganizerOnlyRoute><CreateOrganizationPage /></OrganizerOnlyRoute>} />
            <Route path="/admin" element={<SystemAdminRoute><AdminPage /></SystemAdminRoute>} />
            <Route path="/profile/:id" element={<UserProfilePage />} />
            <Route path="/posts/:postId" element={<PostPage />} />
            <Route path="/agent/*" element={<RouteRecoveryPage feature="Agent tools" />} />
            <Route path="/marketplace" element={<RouteRecoveryPage feature="The marketplace" />} />
            <Route path="/needs" element={<RouteRecoveryPage feature="Player needs" />} />
            <Route path="/store" element={<RouteRecoveryPage feature="The club store" />} />
            <Route path="/jobs" element={<JobsDirectoryPage />} />
            <Route path="/campaigns" element={<RouteRecoveryPage feature="Campaigns and fundraising" />} />
            <Route path="/people" element={<ProtectedRoute><PeoplePage /></ProtectedRoute>} />
            <Route path="/clubs/:id/store" element={<RouteRecoveryPage feature="The club store" />} />
            <Route path="/clubs/:id/squads" element={<ProtectedRoute><ClubSquadsPage /></ProtectedRoute>} />
            <Route path="/clubs/:id/workspace" element={<ProtectedRoute><ClubWorkspacePage darkMode={darkMode} /></ProtectedRoute>} />
            <Route path="/clubs/:id" element={<ClubProfilePage />} />
            <Route path="/clubs/create" element={<OrganizerOnlyRoute><ClubCreateRoute><CreateClubPage /></ClubCreateRoute></OrganizerOnlyRoute>} />
            <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            <Route path="/dob" element={<ProtectedRoute><DobGatePage /></ProtectedRoute>} />
            <Route path="/set-password" element={<ProtectedRoute><SetPasswordPage /></ProtectedRoute>} />
            <Route path="*" element={<RouteRecoveryPage />} />
        </Routes>
    );

    return (
        <div
            className={`${hasProductNavigation ? 'product-app-shell' : ''} min-h-screen bg-[color:var(--theme-page)] text-[color:var(--text-primary)] transition-colors duration-200`}
            style={{ '--app-active-header-height': activeHeaderHeight } as CSSProperties}
        >
            {hasProductNavigation && (
                <TopNav
                    user={user}
                    myClubId={myClubId}
                    themePreference={themePreference}
                    setThemePreference={setThemePreference}
                    handleLogout={handleLogout}
                    collapsible={isCollapsibleNavWorkspace}
                    collapsed={isTopNavCollapsed}
                    onCollapsedChange={(collapsed) => setCollapsedNavLocationKey(collapsed ? location.key : null)}
                />
            )}

            {isLandingPage || isAuthPage ? (
                <main>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
                        <Route path="/signup" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route path="/consent" element={<ConsentPage />} />
                        <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
                    </Routes>
                </main>
            ) : isFullScreenPage ? (
                isImmersiveCanvasPage ? (
                    <main
                        className={`relative w-full ${isBoundedCanvasPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
                        style={isTopNavCollapsed || isPublicWorldMap
                            ? { minHeight: '100dvh', height: '100dvh' }
                            : { minHeight: 'calc(100dvh - var(--app-header-height))', height: 'calc(100dvh - var(--app-header-height))' }}
                    >
                        {fullScreenRoutes}
                    </main>
                ) : (
                    <main className="app-page-shell min-h-[calc(100dvh-var(--app-header-height))]">
                        <AppPageFrame variant={isBleedDestinationPage ? 'bleed' : 'wide'} className={`app-route-frame ${isBleedDestinationPage ? '' : 'py-6'}`}>
                            {fullScreenRoutes}
                        </AppPageFrame>
                    </main>
                )
            ) : (
                <div className={isHomeFeed ? 'feed-home-shell min-h-[calc(100dvh-var(--app-header-height))]' : ''}>
                    <div className={`grid grid-cols-1 gap-6 pb-10 pt-6 ${isHomeFeed ? 'feed-home-grid mx-auto w-full max-w-[var(--app-page-max-width)] px-[var(--app-page-gutter)] lg:grid-cols-[240px_minmax(0,680px)] lg:justify-between xl:grid-cols-[220px_minmax(0,680px)_280px] 2xl:grid-cols-[300px_minmax(0,680px)_300px]' : 'mx-auto max-w-[1480px] px-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[220px_minmax(0,720px)_280px]'}`}>
                            <LeftSidebar user={user} />

                        <main className="min-w-0">
                            <Routes>
                                <Route path="/home" element={<ProtectedRoute><FeedPage user={user} /></ProtectedRoute>} />
                                <Route path="/feed" element={<Navigate to={`/home${location.search}`} replace />} />
                                <Route path="*" element={<RouteRecoveryPage />} />
                            </Routes>
                        </main>

                        <RightSidebar />
                    </div>
                </div>
            )}

        </div>
    );
}

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <MainLayout />
            </AuthProvider>
        </Router>
    );
}
