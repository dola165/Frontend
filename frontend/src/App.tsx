import {useState, useEffect, type JSX} from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { ClubProfilePage } from './pages/ClubProfilePage';
import { UserProfilePage } from './pages/UserProfilePage';
import { MapPage } from './pages/MapPage';
import { FeedPage } from './pages/FeedPage';
import { LandingPage } from './pages/LandingPage';
import { BrowseClubsPage } from './pages/BrowseClubsPage';
import { MessagingPage } from './pages/MessagingPage';
import { StorePage } from './pages/StorePage';
import { CharityPage } from './pages/CharityPage';
import { MiniMap } from './components/MiniMap';
import { MyClubPage } from './pages/MyClubPage';
import { CalendarPage } from './pages/CalendarPage';
import { OAuth2RedirectHandler } from './pages/OAuth2RedirectHandler';
import { OnboardingPage } from './pages/OnboardingPage';
import { apiClient } from './api/axiosConfig';
import {
    Home, Map as MapIcon, Shield, MessageSquare, User,
    Search, Moon, Sun, Bot, ShoppingCart,
    HeartHandshake, Bell, Menu, Send, ExternalLink, X, Building2, CalendarDays,
    ChevronUp, ChevronDown // <-- NEW ICONS FOR THE ROOF
} from 'lucide-react';
import {LoginPage} from "./pages/LoginPage.tsx";
import {RegisterPage} from "./pages/RegisterPage.tsx";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        return <Navigate to="/" replace />;
    }
    return children;
};

function MainLayout() {
    const location = useLocation();
    const [user, setUser] = useState<{ id: number; username: string; role: string; fullName?: string } | null>(null);
    const [activeQuickChat, setActiveQuickChat] = useState<{id: number, name: string, role: string, online: boolean} | null>(null);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    // --- NEW: ROOF VISIBILITY STATE ---
    const [isRoofVisible, setIsRoofVisible] = useState(true);
    const navigate = useNavigate();

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
            apiClient.get('/users/me')
                .then(res => {
                    setUser(res.data);
                    const isProfileIncomplete = !res.data.fullName ||
                        res.data.fullName.trim() === '' ||
                        res.data.fullName === 'New User' ||
                        res.data.role === 'USER';

                    if (isProfileIncomplete && location.pathname !== '/onboarding') {
                        navigate('/onboarding', { replace: true });
                    }
                })
                .catch((error) => {
                    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                        localStorage.removeItem('accessToken');
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

    useEffect(() => {
        if (location.pathname === '/messages') setActiveQuickChat(null);
    }, [location.pathname]);

    const handleLogout = async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            localStorage.removeItem('accessToken');
            setUser(null);
            navigate('/login', { replace: true });
        }
    };

    const isLandingPage = location.pathname === '/';
    const isFeedPage = location.pathname === '/feed';
    const isClubProfilePage = /^\/clubs\/\d+$/.test(location.pathname);

    const isFullScreenPage =
        location.pathname === '/map' ||
        location.pathname === '/messages' ||
        location.pathname.startsWith('/profile') ||
        location.pathname === '/store' ||
        location.pathname === '/charity' ||
        location.pathname === '/my-club' ||
        location.pathname === '/calendar' ||
        location.pathname === '/onboarding' ||
        isClubProfilePage;

    // Expand the roof automatically when navigating to standard pages so it doesn't stay hidden forever
    useEffect(() => {
        if (!isFullScreenPage && !isRoofVisible) {
            setIsRoofVisible(true);
        }
    }, [location.pathname, isFullScreenPage]);

    return (
        <div className="min-h-screen bg-[#fdfaf5] dark:bg-[#0a0f13] transition-colors duration-200 relative font-sans text-slate-300">

            {/* --- THE COLLAPSIBLE ROOF --- */}
            {!isLandingPage && location.pathname !== '/login' && location.pathname !== '/signup' && location.pathname !== '/oauth2/callback' && (
                <>
                    {isRoofVisible ? (
                        <nav className="sticky top-0 h-24 bg-white dark:bg-[#121b22] border-b border-slate-300 dark:border-slate-800 flex flex-col justify-between z-50 transition-all duration-300 shadow-xl">

                            {/* TOP ROW */}
                            <div className="flex justify-between items-center px-4 md:px-6 h-14 w-full">
                                <div className="flex items-center gap-6 w-auto lg:w-1/3">
                                    <button className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                        <Menu className="w-5 h-5" />
                                    </button>
                                    <Link to="/feed" className="text-xl font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest transition-colors shrink-0">
                                        TALANTI
                                    </Link>
                                    <div className="hidden lg:flex items-center bg-slate-100 dark:bg-[#0a0f13] border border-transparent dark:border-slate-700 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 rounded-sm px-4 py-2 w-72 xl:w-96 transition-colors shadow-inner">
                                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                                        <input type="text" placeholder="Query database..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-900 dark:text-white placeholder-slate-500 font-medium" />
                                    </div>
                                </div>

                                {/* RIGHT ACTIONS */}
                                <div className="flex items-center justify-end gap-3 lg:w-1/3">
                                    <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors relative">
                                        <Bell className="w-5 h-5" />
                                        <span className="absolute top-1.5 right-2 w-2 h-2 bg-orange-500 rounded-full"></span>
                                    </button>

                                    {!isFeedPage && (
                                        <button onClick={() => alert("AI Assistant coming soon!")} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors text-xs font-bold rounded-sm border border-emerald-500/30">
                                            <Bot className="w-3.5 h-3.5" /> Ask AI
                                        </button>
                                    )}

                                    <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                    </button>

                                    <button
                                        onClick={handleLogout}
                                        className="bg-rose-600/10 text-rose-600 dark:text-rose-500 hover:bg-rose-600 hover:text-white px-4 py-1.5 rounded-sm transition-all font-bold text-xs border border-rose-600/20 hover:border-rose-600 active:translate-y-0.5"
                                    >
                                        Sign Out
                                    </button>

                                    <Link to={user ? `/profile/${user.id}` : "#"}>
                                        <div className="w-9 h-9 ml-2 bg-slate-200 dark:bg-slate-800 rounded-sm border border-slate-300 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 transition-colors flex items-center justify-center text-xs text-slate-900 dark:text-white font-bold">
                                            {user ? user.username.substring(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                                        </div>
                                    </Link>

                                    {/* HIDE ROOF BUTTON */}
                                    <button onClick={() => setIsRoofVisible(false)} title="Hide Roof" className="ml-2 p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded-md transition-colors">
                                        <ChevronUp className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* BOTTOM ROW: Facebook-Style Nav with RED ACCENT */}
                            <div className="flex justify-center h-10 w-full border-t border-slate-200 dark:border-slate-800/50">
                                <div className="flex items-end h-full">
                                    {[
                                        { path: "/feed", icon: Home, title: "Network Feed" },
                                        { path: "/map", icon: MapIcon, title: "Intel Map" },
                                        { path: "/clubs", icon: Shield, title: "Club Database" },
                                        { path: "/my-club", icon: Building2, title: "My Club" },
                                        { path: "/calendar", icon: CalendarDays, title: "Schedule" },
                                        { path: "/messages", icon: MessageSquare, title: "Communications" }
                                    ].map((item, idx) => {
                                        const isActive = location.pathname === item.path;
                                        return (
                                            <Link key={idx} to={item.path} title={item.title}
                                                // --- RED COLOR SWAP HAPPENS HERE ---
                                                  className={`relative flex items-center justify-center px-8 sm:px-10 h-full transition-all group ${
                                                      isActive
                                                          ? "text-rose-600 dark:text-rose-500"
                                                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                                  }`}>
                                                <item.icon className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
                                                {isActive && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-rose-500 rounded-t-full shadow-[0_-2px_8px_rgba(244,63,94,0.3)]" />
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </nav>
                    ) : (
                        // WHEN ROOF IS HIDDEN: A minimal floating tab that doesn't push map content down
                        <div className="sticky top-0 z-[60] w-full flex justify-center h-0">
                            <button
                                onClick={() => setIsRoofVisible(true)}
                                className="bg-[#121b22] border border-t-0 border-slate-800 text-slate-500 hover:text-white px-8 py-1 rounded-b-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-all flex items-center gap-2 group hover:pt-2"
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 hidden sm:block transition-all">Show Roof</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ROUTING REMAINS EXACTLY THE SAME */}
            {isLandingPage || location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/oauth2/callback' ? (
                <main>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<RegisterPage />} />
                        <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
                    </Routes>
                </main>
            ) : isFullScreenPage ? (
                // Notice the dynamic height check if the roof is hidden vs visible to maximize map space
                <main className={`w-full relative transition-all duration-300 overflow-y-auto ${isRoofVisible ? 'h-[calc(100vh-96px)]' : 'h-screen'}`}>
                    <Routes>
                        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                        <Route path="/messages" element={<ProtectedRoute><MessagingPage /></ProtectedRoute>} />
                        <Route path="/profile/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                        <Route path="/clubs/:id" element={<ProtectedRoute><ClubProfilePage /></ProtectedRoute>} />
                        <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
                        <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
                        <Route path="/charity" element={<ProtectedRoute><CharityPage /></ProtectedRoute>} />
                        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                    </Routes>
                </main>
            ) : (
                <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 px-4 md:px-6 pb-12">
                    <aside className="hidden lg:block lg:col-span-3 xl:col-span-3">
                        <div className="sticky top-32 flex flex-col gap-6">
                            <div className="flex flex-col gap-1.5">
                                {[
                                    { path: "/feed", icon: Home, label: "Network Feed" },
                                    { path: "/map", icon: MapIcon, label: "Intel Map" },
                                    { path: "/clubs", icon: Shield, label: "Club Database" },
                                    { path: "/my-club", icon: Building2, label: "My Club" },
                                    { path: "/messages", icon: MessageSquare, label: "Communications" },
                                    { path: user ? `/profile/${user.id}` : "#", icon: User, label: "My Profile" }
                                ].map((item, idx) => (
                                    <Link key={idx} to={item.path} onClick={() => !user && item.label === "My Profile" && alert('Please login')}
                                          className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-900 px-4 py-3 rounded-sm border-2 border-transparent hover:border-slate-900 hover:shadow-[4px_4px_0px_0px_#020617] transition-all">
                                        <item.icon className="w-5 h-5" /> {item.label}
                                    </Link>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4">
                                <Link to="/store" className="block bg-white dark:bg-[#151f28] p-4 rounded-sm border border-slate-300 dark:border-slate-800 shadow-lg hover:-translate-y-1 transition-all group">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShoppingCart className="w-5 h-5 text-orange-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-widest">Armory</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Acquire official gear and training equipment.</p>
                                    <button className="text-[10px] font-bold text-slate-900 bg-orange-500 hover:bg-orange-400 py-1.5 px-3 rounded-sm w-full uppercase tracking-widest transition-colors">Enter Store</button>
                                </Link>
                                <Link to="/charity" className="block bg-white dark:bg-[#151f28] p-4 rounded-sm border border-slate-300 dark:border-slate-800 shadow-lg hover:-translate-y-1 transition-all group">
                                    <div className="flex items-center gap-2 mb-2">
                                        <HeartHandshake className="w-5 h-5 text-emerald-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-widest">Support</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Fund local grassroots player campaigns.</p>
                                    <button className="text-[10px] font-bold text-slate-900 bg-emerald-500 hover:bg-emerald-400 py-1.5 px-3 rounded-sm w-full uppercase tracking-widest transition-colors">View Campaigns</button>
                                </Link>
                            </div>
                        </div>
                    </aside>

                    <main className="col-span-1 lg:col-span-6 xl:col-span-6">
                        <Routes>
                            <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
                            <Route path="/clubs" element={<ProtectedRoute><BrowseClubsPage /></ProtectedRoute>} />
                        </Routes>
                    </main>

                    <aside className="hidden lg:block lg:col-span-3 xl:col-span-3 relative">
                        <div className="sticky top-32 flex flex-col gap-6">

                            <div className="rounded-sm overflow-hidden border border-slate-300 dark:border-slate-800 shadow-lg">
                                <MiniMap />
                            </div>

                            <div className="bg-white dark:bg-[#151f28] p-4 rounded-sm border border-slate-300 dark:border-slate-800 shadow-lg">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                                    <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs flex items-center gap-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> Active Comms
                                    </h3>
                                    <Link to="/messages" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-emerald-500">See All</Link>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {mockContacts.map(contact => (
                                        <button key={contact.id} onClick={() => setActiveQuickChat(contact)}
                                                className={`flex items-center gap-3 p-2 rounded-sm transition-colors w-full text-left border-l-2 ${activeQuickChat?.id === contact.id ? 'bg-slate-100 dark:bg-[#0a0f13] border-emerald-500' : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#0a0f13] hover:border-slate-500'}`}>
                                            <div className="relative shrink-0">
                                                <div className="w-8 h-8 rounded-sm bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                                                    {contact.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                {contact.online && <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border border-white dark:border-[#151f28] rounded-full"></div>}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{contact.name}</p>
                                                <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider truncate">{contact.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#151f28] p-4 rounded-sm border border-slate-300 dark:border-slate-800 shadow-lg">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-widest text-xs pb-2 border-b border-slate-200 dark:border-slate-800">Database Wisdom</h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                                    {[
                                        { quote: "He who does not work, neither shall he eat.", author: "Vladimir Lenin" },
                                        { quote: "Better to die on your feet than to live on your knees.", author: "Emiliano Zapata" },
                                    ].map((q, idx) => (
                                        <div key={idx} className="border-l-2 border-emerald-500 pl-3">
                                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">"{q.quote}"</p>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">— {q.author}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* --- SHARP FLOATING QUICK CHAT --- */}
            {activeQuickChat && (
                <div className="fixed bottom-0 right-4 md:right-8 z-[9000] w-72 bg-white dark:bg-[#151f28] rounded-t-sm border border-b-0 border-slate-300 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    <div className="bg-slate-100 dark:bg-[#0a0f13] p-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-sm bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                                {activeQuickChat.name.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate w-32">{activeQuickChat.name}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-widest ${activeQuickChat.online ? 'text-emerald-500' : 'text-slate-500'}`}>
                                    {activeQuickChat.online ? 'Online' : 'Offline'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Link to="/messages" onClick={() => setActiveQuickChat(null)} className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></Link>
                            <button onClick={() => setActiveQuickChat(null)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="h-56 bg-white dark:bg-[#0f172a] p-3 overflow-y-auto flex flex-col gap-3">
                        <div className="bg-slate-100 dark:bg-[#1e293b] p-2.5 rounded-sm self-start max-w-[85%] border border-slate-200 dark:border-slate-800">
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Checking in regarding the tryouts.</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-sm self-end max-w-[85%] border border-emerald-200 dark:border-emerald-800/30">
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Affirmative.</p>
                        </div>
                    </div>

                    <div className="p-2 bg-white dark:bg-[#151f28] border-t border-slate-200 dark:border-slate-800">
                        <div className="flex gap-1">
                            <input type="text" placeholder="Type..." className="flex-1 bg-slate-100 dark:bg-[#0a0f13] text-xs text-slate-900 dark:text-white px-2 py-1.5 outline-none rounded-sm border border-slate-200 dark:border-slate-700" />
                            <button className="px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm transition-colors"><Send className="w-3 h-3" /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING AI CHATBOT BUTTON */}
            {isFeedPage && (
                <div className="fixed bottom-6 right-6 z-[8000]">
                    <button onClick={() => alert("Talanti AI coming soon!")} className="flex items-center justify-center w-12 h-12 rounded-sm bg-emerald-600 text-white shadow-lg border border-transparent dark:border-slate-800 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform">
                        <Bot className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default function App() {
    return <Router><MainLayout /></Router>;
}