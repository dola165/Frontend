import { useEffect, useState, type JSX } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Bot, ExternalLink, Send, X } from 'lucide-react';
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
import { StorePage } from './pages/StorePage';
import { CharityPage } from './pages/CharityPage';
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
import { BrowseTournamentsPage } from './pages/BrowseTournamentsPage';
import { CreateOrganizationPage } from './pages/CreateOrganizationPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { buildLoginRedirectPath, resolvePostAuthRedirect } from './utils/authRedirect';
import { fetchMyClubMembershipContext } from './features/clubs/api';

const authRoutePaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']);
const boundedCanvasPages = new Set(['/map', '/messages', '/calendar']);

const PageBootSpinner = ({ label }: { label: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f4f7] dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1f6feb] border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
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

function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { status, user, logout } = useAuth();
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [activeQuickChat, setActiveQuickChat] = useState<{ id: number; name: string; role: string; online: boolean } | null>(null);
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

    const mockContacts = [
        { id: 101, name: 'Saba Gogichaishvili', role: 'Striker', online: true },
        { id: 102, name: 'Luka Maisuradze', role: 'Coach', online: true },
        { id: 103, name: 'Nika Kvaratskhelia', role: 'Midfielder', online: false },
        { id: 104, name: 'FC Dinamo Admin', role: 'Club Exec', online: true },
        { id: 105, name: 'Giorgi Mamardashvili', role: 'Goalkeeper', online: false },
        { id: 106, name: 'Elite Scout', role: 'Agent', online: true }
    ];

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
        if (location.pathname === '/messages') {
            setActiveQuickChat(null);
        }
    }, [location.pathname]);

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
        setActiveQuickChat(null);
        navigate('/login', { replace: true });
    };

    const isLandingPage = location.pathname === '/';
    const isAuthPage = authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback';
    const isCalendarWorkspace = location.pathname === '/calendar';
    const isMapWorkspace = location.pathname === '/map';
    const isHomeFeed = location.pathname === '/feed';
    const isChromeFreeWorkspace = isCalendarWorkspace || isMapWorkspace;
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);
    const isFullScreenPage =
        ['/map', '/messages', '/store', '/charity', '/clubs', '/my-club', '/calendar', '/notifications', '/onboarding', '/account', '/admin', '/tournaments', '/tournaments/setup'].includes(location.pathname) ||
        location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/organizations') ||
        /^\/tournaments\/\d+\/workspace$/.test(location.pathname) ||
        isClubSurfaceRoute;
    const isBoundedCanvasPage = boundedCanvasPages.has(location.pathname);

    return (
        <div className="min-h-screen bg-base text-primary transition-colors duration-200">
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
                        <Route path="/tournaments/:tournamentId/workspace" element={<ProtectedRoute><TournamentWorkspacePage /></ProtectedRoute>} />
                        <Route path="/organizations/create" element={<ProtectedRoute><CreateOrganizationPage /></ProtectedRoute>} />
                        <Route path="/admin" element={<SystemAdminRoute><AdminPage /></SystemAdminRoute>} />
                        <Route path="/profile/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                        <Route path="/clubs/:id/squads" element={<ProtectedRoute><ClubSquadsPage /></ProtectedRoute>} />
                        <Route path="/clubs/:id" element={<ClubProfilePage />} />
                        <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
                        <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
                        <Route path="/charity" element={<ProtectedRoute><CharityPage /></ProtectedRoute>} />
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

                        <RightSidebar
                            mockContacts={mockContacts}
                            activeQuickChat={activeQuickChat}
                            setActiveQuickChat={setActiveQuickChat}
                        />
                    </div>
                </div>
            )}

            {activeQuickChat && (
                <div className="fixed bottom-0 right-4 z-[9000] flex w-80 flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:right-8">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f4f7] text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {activeQuickChat.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p className="w-36 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {activeQuickChat.name}
                                </p>
                                <p className={`mt-0.5 text-xs font-medium ${activeQuickChat.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {activeQuickChat.online ? 'Online' : 'Offline'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Link to="/messages" onClick={() => setActiveQuickChat(null)} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                            <button type="button" onClick={() => setActiveQuickChat(null)} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex h-56 flex-col gap-3 overflow-y-auto bg-[#f2f4f7] p-3 dark:bg-slate-950">
                        <div className="max-w-[85%] self-start rounded-2xl bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800">
                            <p className="text-sm text-slate-700 dark:text-slate-300">Checking in regarding the tryouts.</p>
                        </div>
                        <div className="max-w-[85%] self-end rounded-2xl bg-[#1f6feb] px-3 py-2.5 dark:bg-[#4c8dff]">
                            <p className="text-sm text-white">Affirmative.</p>
                        </div>
                    </div>
                    <div className="border-t border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Type update"
                                className="flex-1 rounded-full border border-slate-200 bg-[#f2f4f7] px-4 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1f6feb] text-white transition-colors hover:bg-[#1957bb] dark:bg-[#4c8dff] dark:hover:bg-[#3a7be0]">
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {location.pathname === '/feed' && (
                <div className="fixed bottom-6 right-6 z-[8000]">
                    <button
                        type="button"
                        disabled
                        title="Talanti AI stays intentionally deferred for a later phase."
                        className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-white opacity-60 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                        <Bot className="h-5 w-5 text-slate-400" />
                    </button>
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
