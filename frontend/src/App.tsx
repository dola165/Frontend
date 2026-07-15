import { useEffect, useState, type JSX } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
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
import { AgentDashboardPage } from './pages/AgentDashboardPage';
import { AgentProfilePage } from './pages/AgentProfilePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { NeedsBoardPage } from './pages/NeedsBoardPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { buildLoginRedirectPath, resolvePostAuthRedirect } from './utils/authRedirect';
import { fetchMyClubMembershipContext } from './features/clubs/api';

const authRoutePaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']);
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
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Access" />;
    }

    if (isAuthenticated) {
        return <Navigate to={user?.profileComplete ? nextPath : '/onboarding'} replace />;
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

const AgentOnlyRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated, user } = useAuth();

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Access" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    }

    if (user?.role !== 'AGENT') {
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

function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { status, user, logout } = useAuth();
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            return true;
        }
        if (saved === 'light') {
            return false;
        }
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    });

    useEffect(() => {
        if (status !== 'authenticated' || !user?.id) {
            return;
        }

        if (!user.profileComplete && location.pathname !== '/onboarding' && location.pathname !== '/oauth2/callback') {
            navigate('/onboarding', { replace: true });
        }
    }, [location.pathname, navigate, status, user]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        let active = true;

        if (status !== 'authenticated') {
            setMyClubId(null);
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
        await logout();
        navigate('/login', { replace: true });
    };

    const isLandingPage = location.pathname === '/';
    const isAuthPage = authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback';
    const isCalendarWorkspace = location.pathname === '/calendar';
    const isMapWorkspace = location.pathname === '/map';
    const isHomeFeed = location.pathname === '/feed';
    const isChromeFreeWorkspace = isCalendarWorkspace || isMapWorkspace;
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads|\/workspace)?$/.test(location.pathname);
    const isFullScreenPage =
        ['/map', '/messages', '/clubs', '/clubs/create', '/my-club', '/calendar', '/notifications', '/onboarding', '/account', '/admin', '/tournaments', '/tournaments/setup', '/marketplace', '/needs'].includes(location.pathname) ||
        location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/organizations') ||
        location.pathname.startsWith('/tournaments/') ||
        location.pathname.startsWith('/agent') ||
        isClubSurfaceRoute;
    const isBoundedCanvasPage = boundedCanvasPages.has(location.pathname);

    return (
        <div className="min-h-screen bg-[#0f1117] text-[#f4f4f5] transition-colors duration-200">
            {!isLandingPage && !isAuthPage && !isChromeFreeWorkspace && (
                <TopNav
                    user={user}
                    myClubId={myClubId}
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}
                    handleLogout={handleLogout}
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
                        <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
                    </Routes>
                </main>
            ) : isFullScreenPage ? (
                <main
                    className={`relative w-full ${isBoundedCanvasPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
                    style={isChromeFreeWorkspace
                        ? { minHeight: '100dvh', height: '100dvh' }
                        : { minHeight: 'calc(100dvh - var(--app-header-height))', height: 'calc(100dvh - var(--app-header-height))' }}
                >
                    <Routes>
                        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                        <Route path="/clubs" element={<BrowseClubsPage />} />
                        <Route path="/calendar" element={<ProtectedRoute><CalendarPage user={user} darkMode={darkMode} setDarkMode={setDarkMode} /></ProtectedRoute>} />
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
                        <Route path="/agent/dashboard" element={<AgentOnlyRoute><AgentDashboardPage /></AgentOnlyRoute>} />
                        <Route path="/agent/:id" element={<AgentProfilePage />} />
                        <Route path="/marketplace" element={<MarketplacePage />} />
                        <Route path="/needs" element={<NeedsBoardPage />} />
                        <Route path="/clubs/:id/squads" element={<ProtectedRoute><ClubSquadsPage /></ProtectedRoute>} />
                        <Route path="/clubs/:id/workspace" element={<ProtectedRoute><ClubWorkspacePage darkMode={darkMode} /></ProtectedRoute>} />
                        <Route path="/clubs/:id" element={<ClubProfilePage />} />
                        <Route path="/clubs/create" element={<OrganizerOnlyRoute><CreateClubPage /></OrganizerOnlyRoute>} />
                        <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
                        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                    </Routes>
                </main>
            ) : (
                <div className={isHomeFeed ? 'feed-home-shell min-h-[calc(100dvh-var(--app-header-height))]' : ''}>
                    <div className={`grid grid-cols-1 gap-6 px-6 pb-10 pt-6 ${isHomeFeed ? 'feed-home-grid w-full lg:grid-cols-[280px_1fr_320px]' : 'mx-auto max-w-[1480px] lg:grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[220px_minmax(0,720px)_280px]'}`}>
                        <LeftSidebar user={user} myClubId={myClubId} />

                        <main className="min-w-0">
                            <Routes>
                                <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
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
