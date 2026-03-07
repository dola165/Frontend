import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
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
import { apiClient } from './api/axiosConfig';
import {
    Home, Map as MapIcon, Shield, MessageSquare, User,
    Search, Moon, Sun, Bot, ShoppingCart,
    HeartHandshake, Bell, Menu, Send, ExternalLink, X
} from 'lucide-react';

function MainLayout() {
    const location = useLocation();
    const [user, setUser] = useState<{ id: number; username: string } | null>(null);
    const [activeQuickChat, setActiveQuickChat] = useState<{id: number, name: string, role: string, online: boolean} | null>(null);

    const mockContacts = [
        { id: 101, name: 'Saba Gogichaishvili', role: 'Striker', online: true },
        { id: 102, name: 'Luka Maisuradze', role: 'Coach', online: true },
        { id: 103, name: 'Nika Kvaratskhelia', role: 'Midfielder', online: false },
        { id: 104, name: 'FC Dinamo Admin', role: 'Club Exec', online: true },
        { id: 105, name: 'Giorgi Mamardashvili', role: 'Goalkeeper', online: false },
        { id: 106, name: 'Elite Scout', role: 'Agent', online: true }
    ];

    useEffect(() => {
        apiClient.get('/users/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

    const isLandingPage = location.pathname === '/';
    const isFeedPage = location.pathname === '/feed';
    const isClubProfilePage = /^\/clubs\/\d+$/.test(location.pathname);

    const isFullScreenPage =
        location.pathname === '/map' ||
        location.pathname === '/messages' ||
        location.pathname.startsWith('/profile') ||
        location.pathname === '/store' ||
        location.pathname === '/charity' ||
        isClubProfilePage;

    // --- NEW LOGIC: Only show condensed top nav on full screen pages, EXCEPT the map ---
    const showCondensedNav = isFullScreenPage && location.pathname !== '/map';

    useEffect(() => {
        if (location.pathname === '/messages') setActiveQuickChat(null);
    }, [location.pathname]);

    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    const handleDevLogin = async () => {
        try {
            const res = await apiClient.post('/auth/dev-login?email=react_dev@demo.com');
            alert(`Success! ${res.data.message}`);
            const userRes = await apiClient.get('/users/me');
            setUser(userRes.data);
        } catch (error) {
            alert("Login failed! Is Spring Boot running?");
        }
    };

    return (
        <div className="min-h-screen bg-[#fdfaf5] dark:bg-[#0f172a] transition-colors duration-200 relative font-sans text-slate-300">

            {/* --- SHARP TOP HEADER --- */}
            {!isLandingPage && (
                <nav className="sticky top-0 h-14 bg-white dark:bg-[#1e293b] border-b-2 border-slate-300 dark:border-slate-800 flex justify-between items-center px-4 md:px-6 z-50 transition-colors">
                    <div className="flex items-center gap-4 w-1/4 md:w-1/3">
                        <button className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
                            <Menu className="w-5 h-5" />
                        </button>
                        <Link to="/feed" className="text-xl font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest transition-colors">
                            TALANTI
                        </Link>
                        <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus-within:border-emerald-500 dark:focus-within:border-emerald-500 rounded-sm px-3 py-1 w-64 transition-colors">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input type="text" placeholder="Query database..." className="bg-transparent border-none outline-none text-xs ml-2 w-full text-slate-900 dark:text-white placeholder-slate-400 font-medium" />
                        </div>
                    </div>

                    {/* --- DYNAMIC CONDENSED NAVIGATION --- */}
                    <div className="flex-1 flex justify-center">
                        {showCondensedNav && (
                            <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-[#0f172a] px-2 py-1 rounded-sm border border-slate-200 dark:border-slate-800 shadow-inner">
                                {[
                                    { path: "/feed", icon: Home, title: "Network Feed" },
                                    { path: "/map", icon: MapIcon, title: "Intel Map" },
                                    { path: "/clubs", icon: Shield, title: "Club Database" },
                                    { path: "/messages", icon: MessageSquare, title: "Communications" }
                                ].map((item, idx) => (
                                    <Link key={idx} to={item.path} title={item.title}
                                          className={`p-2 rounded-sm transition-all border ${
                                              location.pathname === item.path
                                                  ? "text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#1e293b] border-slate-300 dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617]"
                                                  : "text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:bg-slate-200 dark:hover:bg-slate-800"
                                          }`}>
                                        <item.icon className="w-4 h-4" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 w-1/4 md:w-1/3">
                        <button className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1.5 w-2 h-2 bg-orange-500 rounded-full"></span>
                        </button>

                        {!isFeedPage && (
                            <button onClick={() => alert("AI Assistant coming soon!")} className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors text-xs font-bold rounded-sm border border-emerald-500/30">
                                <Bot className="w-3.5 h-3.5" /> Ask AI
                            </button>
                        )}

                        <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <button onClick={handleDevLogin} className="bg-emerald-600 text-white px-3 py-1.5 rounded-sm hover:bg-emerald-500 transition-colors font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[2px_2px_0px_0px_#020617] border border-transparent active:translate-y-0.5 active:shadow-none">
                            Dev Login
                        </button>

                        <Link to={user ? `/profile/${user.id}` : "#"}>
                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-sm border-2 border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors flex items-center justify-center text-[10px] text-slate-900 dark:text-white font-bold">
                                {user ? user.username.substring(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                            </div>
                        </Link>
                    </div>
                </nav>
            )}

            {isLandingPage ? (
                <main><Routes><Route path="/" element={<LandingPage />} /></Routes></main>
            ) : isFullScreenPage ? (
                <main className="w-full relative min-h-[calc(100vh-56px)]">
                    <Routes>
                        <Route path="/map" element={<MapPage />} />
                        <Route path="/messages" element={<MessagingPage />} />
                        <Route path="/profile/:id" element={<UserProfilePage />} />
                        <Route path="/clubs/:id" element={<ClubProfilePage />} />
                        <Route path="/store" element={<StorePage />} />
                        <Route path="/charity" element={<CharityPage />} />
                    </Routes>
                </main>
            ) : (
                // --- CENTERED 12-COLUMN GRID ---
                <div className="max-w-[90rem] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 px-4 md:px-6 pb-12">

                    {/* 1. LEFT NAV (3 Columns) */}
                    <aside className="hidden lg:block lg:col-span-3 xl:col-span-3">
                        <div className="sticky top-20 flex flex-col gap-6">
                            <div className="flex flex-col gap-1.5">
                                {[
                                    { path: "/feed", icon: Home, label: "Network Feed" },
                                    { path: "/map", icon: MapIcon, label: "Intel Map" },
                                    { path: "/clubs", icon: Shield, label: "Club Database" },
                                    { path: "/messages", icon: MessageSquare, label: "Communications" },
                                    { path: user ? `/profile/${user.id}` : "#", icon: User, label: "My Profile" }
                                ].map((item, idx) => (
                                    <Link key={idx} to={item.path} onClick={() => !user && item.label === "My Profile" && alert('Please login')}
                                          className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-900 px-4 py-3 rounded-sm border-2 border-transparent hover:border-slate-900 hover:shadow-[4px_4px_0px_0px_#020617] transition-all">
                                        <item.icon className="w-5 h-5" /> {item.label}
                                    </Link>
                                ))}
                            </div>

                            {/* Sharp Widgets */}
                            <div className="flex flex-col gap-4">
                                <Link to="/store" className="block bg-white dark:bg-[#1e293b] p-4 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] dark:hover:shadow-[6px_6px_0px_0px_#020617] transition-all group">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShoppingCart className="w-5 h-5 text-orange-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-widest">Armory</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Acquire official gear and training equipment.</p>
                                    <button className="text-[10px] font-bold text-slate-900 bg-orange-500 py-1.5 px-3 rounded-sm w-full uppercase tracking-widest">Enter Store</button>
                                </Link>
                                <Link to="/charity" className="block bg-white dark:bg-[#1e293b] p-4 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] dark:hover:shadow-[6px_6px_0px_0px_#020617] transition-all group">
                                    <div className="flex items-center gap-2 mb-2">
                                        <HeartHandshake className="w-5 h-5 text-emerald-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-widest">Support</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Fund local grassroots player campaigns.</p>
                                    <button className="text-[10px] font-bold text-slate-900 bg-emerald-500 py-1.5 px-3 rounded-sm w-full uppercase tracking-widest">View Campaigns</button>
                                </Link>
                            </div>
                        </div>
                    </aside>

                    {/* 2. CENTER FEED (6 Columns) */}
                    <main className="col-span-1 lg:col-span-6 xl:col-span-6">
                        <Routes>
                            <Route path="/feed" element={<FeedPage />} />
                            <Route path="/clubs" element={<BrowseClubsPage />} />
                        </Routes>
                    </main>

                    {/* 3. RIGHT SIDEBAR (3 Columns - Map, Network, Quotes stacked) */}
                    <aside className="hidden lg:block lg:col-span-3 xl:col-span-3 relative">
                        <div className="sticky top-20 flex flex-col gap-6">

                            {/* Sharp MiniMap */}
                            <div className="rounded-sm overflow-hidden border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                <MiniMap />
                            </div>

                            {/* Compact Network Widget */}
                            <div className="bg-white dark:bg-[#1e293b] p-4 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                                    <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs flex items-center gap-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> Active Comms
                                    </h3>
                                    <Link to="/messages" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-emerald-500">See All</Link>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {mockContacts.map(contact => (
                                        <button key={contact.id} onClick={() => setActiveQuickChat(contact)}
                                                className={`flex items-center gap-3 p-2 rounded-sm transition-colors w-full text-left border-l-2 ${activeQuickChat?.id === contact.id ? 'bg-slate-100 dark:bg-slate-800 border-emerald-500' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-400'}`}>
                                            <div className="relative shrink-0">
                                                <div className="w-8 h-8 rounded-sm bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                                                    {contact.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                {contact.online && <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border border-white dark:border-[#1e293b] rounded-full"></div>}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{contact.name}</p>
                                                <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider truncate">{contact.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sharp Quotes */}
                            <div className="bg-white dark:bg-[#1e293b] p-4 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-widest text-xs pb-2 border-b border-slate-200 dark:border-slate-700">Database Wisdom</h3>
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
                <div className="fixed bottom-0 right-4 md:right-8 z-[9000] w-72 bg-white dark:bg-[#1e293b] rounded-t-sm border-2 border-b-0 border-slate-300 dark:border-slate-700 shadow-[-4px_-4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[-4px_-4px_0px_0px_#020617] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    <div className="bg-slate-100 dark:bg-slate-900 p-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
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

                    <div className="p-2 bg-white dark:bg-[#1e293b] border-t border-slate-200 dark:border-slate-800">
                        <div className="flex gap-1">
                            <input type="text" placeholder="Type..." className="flex-1 bg-slate-100 dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-2 py-1.5 outline-none rounded-sm border border-slate-200 dark:border-slate-700" />
                            <button className="px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm transition-colors"><Send className="w-3 h-3" /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING AI CHATBOT BUTTON */}
            {isFeedPage && (
                <div className="fixed bottom-6 right-6 z-[8000]">
                    <button onClick={() => alert("Talanti AI coming soon!")} className="flex items-center justify-center w-12 h-12 rounded-sm bg-emerald-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-transparent dark:border-slate-800 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform">
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