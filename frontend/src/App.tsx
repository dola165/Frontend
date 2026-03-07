import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ClubProfilePage } from './pages/ClubProfilePage';
import { UserProfilePage } from './pages/UserProfilePage';
import { MapPage } from './pages/MapPage';
import { FeedPage } from './pages/FeedPage';
import { LandingPage } from './pages/LandingPage';
import { BrowseClubsPage } from './pages/BrowseClubsPage';
import { MessagingPage } from './pages/MessagingPage';
import { MiniMap } from './components/MiniMap';
import { StorePage } from './pages/StorePage';
import { CharityPage } from './pages/CharityPage';
import { apiClient } from './api/axiosConfig';
import { Home, Map as MapIcon, Shield, MessageSquare, User, Search, Moon, Sun, Bot, Sparkles, ShoppingCart, HeartHandshake, Bell, Menu } from 'lucide-react';

function MainLayout() {
    const location = useLocation();

    const [user, setUser] = useState<{ id: number; username: string } | null>(null);

    useEffect(() => {
        apiClient.get('/users/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

    // --- PAGE LAYOUT CHECKS ---
    const isLandingPage = location.pathname === '/';
    const isFeedPage = location.pathname === '/feed';
    const isHomePage = isFeedPage;

    // Regex matches exactly /clubs/ followed by numbers (e.g., /clubs/1)
    // This ensures the main /clubs directory still gets sidebars, but the specific profile gets full screen!
    const isClubProfilePage = /^\/clubs\/\d+$/.test(location.pathname);

    // We accurately flag all pages that need the immersive full-screen view
    const isFullScreenPage =
        location.pathname === '/map' ||
        location.pathname === '/messages' ||
        location.pathname.startsWith('/profile') ||
        location.pathname === '/store' ||
        location.pathname === '/charity' ||
        isClubProfilePage;

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
            // Refresh user data after login
            const userRes = await apiClient.get('/users/me');
            setUser(userRes.data);
        } catch (error) {
            alert("Login failed! Is Spring Boot running?");
        }
    };

    return (
        <div className="min-h-screen bg-[#fdfaf5] dark:bg-gray-900 transition-colors duration-200 relative">
            {/* TOP HEADER */}
            {!isLandingPage && (
                <nav className="sticky top-0 h-16 bg-white dark:bg-gray-800 border-b-2 border-black dark:border-gray-700 flex justify-between items-center px-4 md:px-6 shadow-sm z-50 transition-colors">
                    <div className="flex items-center gap-3 md:gap-8 w-1/3">
                        <button className="md:hidden p-2 -ml-2 text-gray-900 dark:text-gray-300">
                            <Menu className="w-6 h-6" />
                        </button>
                        <Link to="/feed" className="text-xl md:text-2xl font-black text-emerald-600 hover:text-emerald-700 tracking-tighter transition-colors">
                            TALANTI
                        </Link>
                        <div className="hidden lg:flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1.5 w-64 transition-colors border border-transparent focus-within:border-black dark:focus-within:border-emerald-500">
                            <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <input type="text" placeholder="Search clubs or players..." className="bg-transparent border-none outline-none text-sm ml-2 w-full text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 transition-colors relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-400 rounded-full border-2 border-white dark:border-gray-800"></span>
                        </button>

                        {!isHomePage && (
                            <button
                                onClick={() => alert("Talanti AI Assistant is coming soon!")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-sm font-bold shadow-sm"
                                title="Ask Talanti AI"
                            >
                                <Bot className="w-4 h-4" />
                                <span className="hidden sm:inline">Ask AI</span>
                            </button>
                        )}

                        <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" aria-label="Toggle Dark Mode">
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <button onClick={handleDevLogin} className="bg-emerald-600 text-white px-4 py-1.5 rounded-full hover:bg-emerald-700 transition-colors font-bold text-sm shadow-sm border-2 border-black dark:border-transparent">
                            Dev Login
                        </button>
                        <Link to={user ? `/profile/${user.id}` : "#"}>
                            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-full border-2 border-black dark:border-gray-800 cursor-pointer shadow-sm flex items-center justify-center text-[10px] text-white font-bold">
                                {user ? user.username.substring(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                            </div>
                        </Link>
                    </div>
                </nav>
            )}

            {/* MAIN CONTENT AREA */}
            {isLandingPage ? (
                <main>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                    </Routes>
                </main>
            ) : isFullScreenPage ? (
                // Note: Changed to w-full so scrolling works correctly for the massive Club Profile!
                <main className="w-full relative min-h-[calc(100vh-64px)]">
                    <Routes>
                        <Route path="/map" element={<MapPage />} />
                        <Route path="/messages" element={<MessagingPage />} />
                        <Route path="/profile/:id" element={<UserProfilePage />} />

                        {/* Immersive Views */}
                        <Route path="/clubs/:id" element={<ClubProfilePage />} />
                        <Route path="/store" element={<StorePage />} />
                        <Route path="/charity" element={<CharityPage />} />
                    </Routes>
                </main>
            ) : (
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pt-6 px-4 pb-12">
                    {/* LEFT SIDEBAR */}
                    <aside className="hidden md:block col-span-1">
                        <div className="sticky top-24 flex flex-col gap-8">
                            <div className="flex flex-col gap-2">
                                <Link to="/feed" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 px-4 py-3 rounded-xl transition-colors">
                                    <Home className="w-6 h-6" /> Feed
                                </Link>
                                <Link to="/map" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 px-4 py-3 rounded-xl transition-colors">
                                    <MapIcon className="w-6 h-6" /> Explore Map
                                </Link>
                                <Link to="/clubs" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 px-4 py-3 rounded-xl transition-colors w-full text-left">
                                    <Shield className="w-6 h-6" /> Browse Clubs
                                </Link>
                                <Link to="/messages" className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 px-4 py-3 rounded-xl transition-colors w-full text-left">
                                    <MessageSquare className="w-6 h-6" /> Messaging
                                </Link>
                                <Link
                                    to={user ? `/profile/${user.id}` : "#"}
                                    onClick={() => !user && alert('Please login first')}
                                    className="flex items-center gap-4 text-lg font-semibold text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 px-4 py-3 rounded-xl transition-colors w-full text-left"
                                >
                                    <User className="w-6 h-6" /> Profile
                                </Link>
                            </div>

                            {/* Promotional Widgets */}
                            <div className="flex flex-col gap-5 pr-2">
                                <Link to="/store" className="block">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border-2 border-black dark:border-emerald-900/30 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md">
                                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-400/10 dark:bg-emerald-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                                        <ShoppingCart className="w-7 h-7 text-orange-400 dark:text-emerald-400 mb-3 relative z-10" />
                                        <h3 className="font-black text-gray-900 dark:text-white text-base relative z-10 italic">Talanti Store</h3>
                                        <p className="text-xs text-gray-700 dark:text-gray-400 mt-1 mb-4 relative z-10 leading-relaxed font-medium">Instantly buy official gear, boots, and training equipment.</p>
                                        <button className="text-sm font-black text-white bg-orange-400 py-1.5 px-4 rounded-lg shadow-sm border-2 border-black group-hover:bg-orange-500 transition-colors w-full relative z-10 uppercase tracking-tighter">Shop Now</button>
                                    </div>
                                </Link>
                                <Link to="/charity" className="block">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border-2 border-black dark:border-emerald-900/30 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md">
                                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                                        <HeartHandshake className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mb-3 relative z-10" />
                                        <h3 className="font-black text-gray-900 dark:text-white text-base relative z-10 italic">Support Grassroots</h3>
                                        <p className="text-xs text-gray-700 dark:text-gray-400 mt-1 mb-4 relative z-10 leading-relaxed font-medium">Help fund local clubs and grassroots player campaigns.</p>
                                        <button className="text-sm font-black text-white bg-emerald-600 py-1.5 px-4 rounded-lg shadow-sm border-2 border-black group-hover:bg-emerald-700 transition-colors w-full relative z-10 uppercase tracking-tighter">View Campaigns</button>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </aside>

                    {/* CENTER FEED */}
                    <main className="col-span-1 md:col-span-2">
                        <Routes>
                            <Route path="/feed" element={<FeedPage />} />
                            <Route path="/clubs" element={<BrowseClubsPage />} />
                        </Routes>
                    </main>

                    {/* RIGHT SIDEBAR (Mini Map & Widgets) */}
                    <aside className="hidden md:block col-span-1 relative">
                        <div className="sticky top-24 flex flex-col gap-8">
                            <MiniMap />
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors">
                                <h3 className="font-black italic text-gray-900 dark:text-white mb-4 uppercase tracking-tighter text-sm underline decoration-orange-400 decoration-2">Revolutionary Wisdom</h3>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                    {[
                                        { quote: "He who does not work, neither shall he eat.", author: "Vladimir Lenin" },
                                        { quote: "Better to die on your feet than to live on your knees.", author: "Emiliano Zapata" },
                                        { quote: "The true revolutionary is guided by a great feeling of love.", author: "Che Guevara" },
                                        { quote: "I am from the people, I am for the people. I'll fight against any injustice, because I have it in my heart.", author: "Diego Maradona" },
                                        { quote: "A revolutionary must be a person of action, not just a person of words. You must be on the field, in the struggle, every single day.", author: "Thomas Sankara" },
                                        { quote: "The only goal worth fighting for is the liberation of the people.", author: "Che Guevara" },
                                        { quote: "When you play for the people, you don't play for money. You play for the pride of your neighborhood, for the hope of your family.", author: "Diego Maradona" }
                                    ].map((q, idx) => (
                                        <div key={idx} className="border-l-4 border-emerald-500 pl-3 py-1 bg-gray-50/50 dark:bg-gray-900/20 rounded-r-lg">
                                            <p className="text-xs text-gray-700 dark:text-gray-300 font-bold italic leading-relaxed">"{q.quote}"</p>
                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">— {q.author}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* CONDITIONAL FLOATING AI CHATBOT BUTTON (Only on Feed Page) */}
            {isFeedPage && (
                <div className="fixed bottom-8 right-8 z-[9999] group">
                    <div className="absolute bottom-full right-0 pb-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 origin-bottom-right">
                        <div className="w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 border-b border-gray-100 dark:border-gray-700">
                                <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    Talanti AI
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 font-medium leading-relaxed">Hi there! I'm your AI assistant. How can I help you today?</p>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                                {["How do I register?", "How do I use the map?", "How do I edit my profile?", "How do I use the store?"].map((question) => (
                                    <button key={question} onClick={() => alert(`AI Chatbot coming soon! (You clicked: "${question}")`)} className="text-left text-sm text-gray-700 dark:text-gray-200 bg-gray-50 hover:bg-emerald-50 dark:bg-gray-700/50 dark:hover:bg-emerald-900/40 py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-500 transition-all font-medium shadow-sm hover:shadow">
                                        {question}
                                    </button>
                                ))}
                            </div>
                            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white dark:bg-gray-800 border-b border-r border-gray-100 dark:border-gray-700 transform rotate-45 hidden group-hover:block"></div>
                        </div>
                    </div>
                    <button onClick={() => alert("Talanti AI Assistant (Powered by Spring AI) is coming soon!")} className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-lime-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300" aria-label="Ask Talanti AI">
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