import { useState, useEffect, type JSX } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
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
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { OAuth2RedirectHandler } from "./pages/OAuth2RedirectHandler";
import { apiClient } from './api/axiosConfig';
import { Send, ExternalLink, X, Bot } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return <Navigate to="/" replace />;
    return children;
};

function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();

    const [user, setUser] = useState<{ id?: number; username?: string; role?: string; fullName?: string; profileComplete?: boolean } | null>(null);
    const [activeQuickChat, setActiveQuickChat] = useState<{id: number, name: string, role: string, online: boolean} | null>(null);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const [isRoofVisible, setIsRoofVisible] = useState(true);

    const mockContacts = [
        { id: 101, name: 'Saba Gogichaishvili', role: 'Striker', online: true },
        { id: 102, name: 'Luka Maisuradze', role: 'Coach', online: true },
        { id: 103, name: 'Nika Kvaratskhelia', role: 'Midfielder', online: false },
        { id: 104, name: 'FC Dinamo Admin', role: 'Club Exec', online: true },
        { id: 105, name: 'Giorgi Mamardashvili', role: 'Goalkeeper', online: false },
        { id: 106, name: 'Elite Scout', role: 'Agent', online: true }
    ];

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            apiClient.get('/auth/csrf').catch(() => undefined);

            apiClient.get('/users/me')
                .then(res => {
                    const normalizedUser = {
                        id: res.data.id,
                        username: res.data.username,
                        role: res.data.role,
                        fullName: res.data.fullName ?? res.data.name,
                        profileComplete: !!res.data.profileComplete
                    };

                    setUser(normalizedUser);

                    if (normalizedUser.id != null) {
                        localStorage.setItem('userId', String(normalizedUser.id));
                    }
                    localStorage.setItem('user', JSON.stringify(normalizedUser));

                    if (!normalizedUser.profileComplete && location.pathname !== '/onboarding') {
                        navigate('/onboarding', { replace: true });
                    }
                })
                .catch((error) => {
                    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('userId');
                        localStorage.removeItem('user');
                        setUser(null);
                        navigate('/login', { replace: true });
                    }
                });
        } else {
            setUser(null);
        }
    }, [location.pathname, navigate]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => { if (location.pathname === '/messages') setActiveQuickChat(null); }, [location.pathname]);

    const handleLogout = async () => {
        try { await apiClient.post('/auth/logout'); } catch (error) { console.error("Logout failed:", error); }
        finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            setUser(null);
            navigate('/login', { replace: true });
        }
    };

    const isLandingPage = location.pathname === '/';
    const isFeedPage = location.pathname === '/feed';
    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/oauth2/callback';
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);
    const isFullScreenPage = ['/map', '/messages', '/store', '/charity', '/my-club', '/calendar', '/notifications', '/onboarding'].includes(location.pathname) || location.pathname.startsWith('/profile') || isClubSurfaceRoute;
    const isBoundedCanvasPage = ['/map', '/messages', '/calendar'].includes(location.pathname);

    // Adjust height logic for BOTH Club Profile and User Profile
    const isCompactMode = isClubSurfaceRoute || /^\/profile\/\d+$/.test(location.pathname);
    const headerHeight = isCompactMode ? '64px' : '96px';
    const fullScreenShellHeight = isRoofVisible ? `calc(100dvh - ${headerHeight})` : '100dvh';

    useEffect(() => { if (!isFullScreenPage && !isRoofVisible) setIsRoofVisible(true); }, [location.pathname, isFullScreenPage]);

    return (
        <div className="min-h-screen bg-[#fdfaf5] dark:bg-[#0a0f13] transition-colors duration-200 relative font-sans text-slate-300">

            {!isLandingPage && !isAuthPage && (
                <TopNav user={user} darkMode={darkMode} setDarkMode={setDarkMode} isRoofVisible={isRoofVisible} setIsRoofVisible={setIsRoofVisible} handleLogout={handleLogout} />
            )}

            {isLandingPage || isAuthPage ? (
                <main>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<RegisterPage />} />
                        <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
                    </Routes>
                </main>
            ) : isFullScreenPage ? (
                <main
                    className={`w-full relative min-h-0 ${isBoundedCanvasPage ? 'overflow-hidden' : 'overflow-y-auto transition-all duration-500 ease-in-out'}`}
                    style={{ height: fullScreenShellHeight }}
                >
                    <Routes>
                        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                        <Route path="/messages" element={<ProtectedRoute><MessagingPage /></ProtectedRoute>} />
                        <Route path="/profile/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                        <Route path="/clubs/:id/squads" element={<ProtectedRoute><ClubSquadsPage /></ProtectedRoute>} />
                        <Route path="/clubs/:id" element={<ProtectedRoute><ClubProfilePage /></ProtectedRoute>} />
                        <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
                        <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
                        <Route path="/charity" element={<ProtectedRoute><CharityPage /></ProtectedRoute>} />
                        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                    </Routes>
                </main>
            ) : (
                <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 px-4 md:px-6 pb-12">
                    <LeftSidebar user={user} />

                    <main className="col-span-1 lg:col-span-6 xl:col-span-6">
                        <Routes>
                            <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
                            <Route path="/clubs" element={<ProtectedRoute><BrowseClubsPage /></ProtectedRoute>} />
                        </Routes>
                    </main>

                    <RightSidebar mockContacts={mockContacts} activeQuickChat={activeQuickChat} setActiveQuickChat={setActiveQuickChat} />
                </div>
            )}

            {/* QUICK CHAT OVERLAY */}
            {activeQuickChat && (
                <div className="fixed bottom-0 right-4 md:right-8 z-[9000] w-72 bg-white dark:bg-[#151f28] rounded-t-sm border border-b-0 border-slate-300 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    <div className="bg-slate-100 dark:bg-[#0a0f13] p-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-sm bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">{activeQuickChat.name.substring(0,2).toUpperCase()}</div>
                            <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate w-32">{activeQuickChat.name}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-widest ${activeQuickChat.online ? 'text-emerald-500' : 'text-slate-500'}`}>{activeQuickChat.online ? 'Online' : 'Offline'}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Link to="/messages" onClick={() => setActiveQuickChat(null)} className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></Link>
                            <button onClick={() => setActiveQuickChat(null)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="h-56 bg-white dark:bg-[#0f172a] p-3 overflow-y-auto flex flex-col gap-3">
                        <div className="bg-slate-100 dark:bg-[#1e293b] p-2.5 rounded-sm self-start max-w-[85%] border border-slate-200 dark:border-slate-800"><p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Checking in regarding the tryouts.</p></div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-sm self-end max-w-[85%] border border-emerald-200 dark:border-emerald-800/30"><p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Affirmative.</p></div>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#151f28] border-t border-slate-200 dark:border-slate-800">
                        <div className="flex gap-1">
                            <input type="text" placeholder="Type..." className="flex-1 bg-slate-100 dark:bg-[#0a0f13] text-xs text-slate-900 dark:text-white px-2 py-1.5 outline-none rounded-sm border border-slate-200 dark:border-slate-700" />
                            <button className="px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm transition-colors"><Send className="w-3 h-3" /></button>
                        </div>
                    </div>
                </div>
            )}

            {isFeedPage && (
                <div className="fixed bottom-6 right-6 z-[8000]">
                    <button onClick={() => alert("Talanti AI coming soon!")} className="flex items-center justify-center w-12 h-12 rounded-sm bg-emerald-600 text-white shadow-lg border border-transparent dark:border-slate-800 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform"><Bot className="w-5 h-5" /></button>
                </div>
            )}
        </div>
    );
}

export default function App() { return <Router><MainLayout /></Router>; }
