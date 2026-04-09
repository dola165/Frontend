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
import { AuthProvider, useAuth } from './context/AuthContext';
import { buildLoginRedirectPath, resolvePostAuthRedirect } from './utils/authRedirect';
import { fetchMyClubMembershipContext } from './features/clubs/api';

const authRoutePaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']);
const boundedCanvasPages = new Set(['/map', '/messages', '/calendar']);

const PageBootSpinner = ({ label }: { label: string }) => (
    <div className="bg-base flex min-h-screen items-center justify-center text-primary">
        <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-primary border-t-transparent"></div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary">
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
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);
    const isFullScreenPage =
        ['/map', '/messages', '/store', '/charity', '/clubs', '/my-club', '/calendar', '/notifications', '/onboarding', '/account', '/admin'].includes(location.pathname) ||
        location.pathname.startsWith('/profile') ||
        isClubSurfaceRoute;
    const isBoundedCanvasPage = boundedCanvasPages.has(location.pathname);

    return (
        <div className="min-h-screen bg-base text-primary transition-colors duration-200">
            {!isLandingPage && !isAuthPage && !isCalendarWorkspace && (
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
                    style={isCalendarWorkspace
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
                <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-6 px-4 pb-10 pt-6 lg:grid-cols-[220px_minmax(0,1fr)_280px] lg:px-6 xl:grid-cols-[220px_minmax(0,720px)_280px] xl:justify-center">
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
            )}

            {activeQuickChat && (
                <div className="fixed bottom-0 right-4 z-[9000] flex w-80 flex-col overflow-hidden border border-subtle bg-elevated text-primary shadow-float md:right-8">
                    <div className="flex items-center justify-between border-b border-subtle bg-surface px-3 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center border border-accent-primary bg-accent-primary-soft text-xs font-black uppercase accent-primary">
                                {activeQuickChat.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p className="w-36 truncate text-xs font-black uppercase tracking-[0.16em] text-primary">
                                    {activeQuickChat.name}
                                </p>
                                <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.18em] ${activeQuickChat.online ? 'accent-primary' : 'text-secondary'}`}>
                                    {activeQuickChat.online ? 'Online' : 'Offline'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Link to="/messages" onClick={() => setActiveQuickChat(null)} className="p-1.5 text-secondary transition-colors hover:text-primary">
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                            <button type="button" onClick={() => setActiveQuickChat(null)} className="p-1.5 text-secondary transition-colors hover:text-primary">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex h-56 flex-col gap-3 overflow-y-auto bg-base p-3">
                        <div className="max-w-[85%] self-start border border-subtle bg-surface px-3 py-2.5">
                            <p className="text-xs font-medium text-primary">Checking in regarding the tryouts.</p>
                        </div>
                        <div className="max-w-[85%] self-end border border-accent-primary bg-accent-primary-soft px-3 py-2.5">
                            <p className="text-xs font-medium accent-primary">Affirmative.</p>
                        </div>
                    </div>
                    <div className="border-t border-subtle bg-surface px-3 py-2.5">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Type update"
                                className="flex-1 border border-subtle bg-base px-3 py-2 text-xs text-primary outline-none placeholder:text-muted"
                            />
                            <button type="button" className="inline-flex h-9 w-9 items-center justify-center bg-accent-primary-soft accent-primary transition-colors hover:text-primary">
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
                        className="flex h-11 w-11 cursor-not-allowed items-center justify-center border border-subtle bg-accent-primary-soft accent-primary opacity-70"
                    >
                        <Bot className="h-5 w-5" />
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
