import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ClubProfilePage } from './pages/ClubProfilePage';
import { MapPage } from './pages/MapPage';
import { FeedPage } from './pages/FeedPage';
import { BrowseClubsPage } from './pages/BrowseClubsPage';
import { MessagingPage } from './pages/MessagingPage';
import { MiniMap } from './components/MiniMap';
import { apiClient } from './api/axiosConfig';
import { Home, Map as MapIcon, Shield, MessageSquare, User, Search, Moon, Sun, Bot, Sparkles, ShoppingCart, HeartHandshake } from 'lucide-react';

function MainLayout() {
    const location = useLocation();

    // Page checks
    const isFullScreenPage = location.pathname === '/map' || location.pathname === '/messages';
    const isHomePage = location.pathname === '/'; // Check if we are on the feed

    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    const handleDevLogin = async () => {
        try {
            const res = await apiClient.post('/auth/dev-login?email=react_dev@demo.com');
            alert(`Success! ${res.data.message}`);
        } catch (error) {
            alert("Login failed! Is Spring Boot running?");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
            {/* TOP HEADER */}
            <nav className="sticky top-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center px-6 shadow-sm z-50 transition-colors">
                <div className="flex items-center gap-8 w-1/3">
                    <Link to="/" className="text-2xl font-black text-blue-600 hover:text-blue-700 tracking-tighter transition-colors">
                        TALANTI
                    </Link>
                    <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1.5 w-64 transition-colors">
                        <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <input type="text" placeholder="Search clubs or players..." className="bg-transparent border-none outline-none text-sm ml-2 w-full text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400" />
                    </div>
                </div>

                <div className="flex items-center gap-4">

                    {/* NEW: Mini AI Button in Header (Only shows when the big floating button is hidden) */}
                    {!isHomePage && (
                        <button
                            onClick={() => alert("Talanti AI Assistant is coming soon!")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-bold shadow-sm"
                            title="Ask Talanti AI"
                        >
                            <Bot className="w-4 h-4" />
                            <span className="hidden sm:inline">Ask AI</span>
                        </button>
                    )}

                    {/* Dark Mode Toggle */}
                    <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" aria-label="Toggle Dark Mode">
                        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <button onClick={handleDevLogin} className="bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-colors font-bold text-sm shadow-sm">
                        Dev Login
                    </button>
                    <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full border-2 border-white dark:border-gray-800 cursor-pointer shadow-sm"></div>
                </div>
            </nav>

            {/* MAIN CONTENT AREA */}
            {isFullScreenPage ? (
                <main className="h-[calc(100vh-64px)] w-full relative">
                    <Routes>
                        <Route path="/map" element={<MapPage />} />
                        <Route path="/messages" element={<MessagingPage />} />
                    </Routes>
                </main>
            ) : (
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pt-6 px-4 pb-12">
                    {/* LEFT SIDEBAR */}
                    <aside className="hidden md:block col-span-1">
                        <div className="sticky top-24 flex flex-col gap-8">
                            <div className="flex flex-col gap-2">
                                <Link to="/" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 px-4 py-3 rounded-xl transition-colors">
                                    <Home className="w-6 h-6" /> Feed
                                </Link>
                                <Link to="/map" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 px-4 py-3 rounded-xl transition-colors">
                                    <MapIcon className="w-6 h-6" /> Explore Map
                                </Link>
                                <Link to="/clubs" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 px-4 py-3 rounded-xl transition-colors w-full text-left">
                                    <Shield className="w-6 h-6" /> Browse Clubs
                                </Link>
                                <Link to="/messages" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 px-4 py-3 rounded-xl transition-colors w-full text-left">
                                    <MessageSquare className="w-6 h-6" /> Messaging
                                </Link>
                                <button onClick={() => alert('Profile coming soon')} className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 px-4 py-3 rounded-xl transition-colors w-full text-left">
                                    <User className="w-6 h-6" /> Profile
                                </button>
                            </div>

                            {/* Promotional Widgets Area */}
                            <div className="flex flex-col gap-5 pr-2">
                                <div onClick={() => alert('Talanti Store opening soon!')} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 p-5 rounded-2xl border border-blue-100 dark:border-gray-700 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md">
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                                    <ShoppingCart className="w-7 h-7 text-blue-600 dark:text-blue-400 mb-3 relative z-10" />
                                    <h3 className="font-bold text-gray-900 dark:text-white text-base relative z-10">Talanti Store</h3>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-4 relative z-10 leading-relaxed">Instantly buy official gear, boots, and training equipment.</p>
                                    <button className="text-sm font-bold text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-900 py-1.5 px-4 rounded-lg shadow-sm border border-blue-100 dark:border-gray-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-colors w-full relative z-10">Shop Now</button>
                                </div>
                                <div onClick={() => alert('Grassroots Funding Campaigns coming soon!')} className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md">
                                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                                    <HeartHandshake className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mb-3 relative z-10" />
                                    <h3 className="font-bold text-gray-900 dark:text-white text-base relative z-10">Support Grassroots</h3>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-4 relative z-10 leading-relaxed">Help fund local clubs and grassroots player campaigns.</p>
                                    <button className="text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-900 py-1.5 px-4 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-900/50 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-transparent transition-colors w-full relative z-10">View Campaigns</button>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* CENTER FEED */}
                    <main className="col-span-1 md:col-span-2">
                        <Routes>
                            <Route path="/" element={<FeedPage />} />
                            <Route path="/clubs" element={<BrowseClubsPage />} />
                            <Route path="/clubs/:id" element={<ClubProfilePage />} />
                        </Routes>
                    </main>

                    {/* RIGHT SIDEBAR (Mini Map & Widgets) */}
                    <aside className="hidden md:block col-span-1 relative">
                        <MiniMap />
                        <div className="mt-8 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Trending Roles</h3>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800">Goalkeeper</span>
                                <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">Striker</span>
                                <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">Center Back</span>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* CONDITIONAL FLOATING AI CHATBOT BUTTON (Only on Home Page) */}
            {isHomePage && (
                <div className="fixed bottom-8 right-8 z-[9999] group">
                    <div className="absolute bottom-full right-0 pb-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 origin-bottom-right">
                        <div className="w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 border-b border-gray-100 dark:border-gray-700">
                                <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    Talanti AI
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 font-medium leading-relaxed">Hi there! I'm your AI assistant. How can I help you today?</p>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                                {["How do I register?", "How do I use the map?", "How do I edit my profile?", "How do I use the store?"].map((question) => (
                                    <button key={question} onClick={() => alert(`AI Chatbot coming soon! (You clicked: "${question}")`)} className="text-left text-sm text-gray-700 dark:text-gray-200 bg-gray-50 hover:bg-indigo-50 dark:bg-gray-700/50 dark:hover:bg-indigo-900/40 py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all font-medium shadow-sm hover:shadow">
                                        {question}
                                    </button>
                                ))}
                            </div>
                            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white dark:bg-gray-800 border-b border-r border-gray-100 dark:border-gray-700 transform rotate-45 hidden group-hover:block"></div>
                        </div>
                    </div>
                    <button onClick={() => alert("Talanti AI Assistant (Powered by Spring AI) is coming soon!")} className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300" aria-label="Ask Talanti AI">
                        <Bot className="w-7 h-7" />
                        <Sparkles className="w-4 h-4 absolute top-2 right-2 text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <MainLayout />
        </Router>
    );
}