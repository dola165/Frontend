import { Link, useLocation } from 'react-router-dom';
import { Search, Bot, Sun, Moon, User, ChevronUp, ChevronDown, Home, Map as MapIcon, Shield, Building2, CalendarDays, MessageSquare, Menu } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';

interface TopNavProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    darkMode: boolean;
    setDarkMode: (val: boolean) => void;
    isRoofVisible: boolean;
    setIsRoofVisible: (val: boolean) => void;
    handleLogout: () => void;
}
export const TopNav = ({ user, darkMode, setDarkMode, isRoofVisible, setIsRoofVisible, handleLogout }: TopNavProps) => {
    const location = useLocation();
    const isFeedPage = location.pathname === '/feed';

    // Trigger the ultra-slim navbar on BOTH profile pages
    const isCompactMode = /^\/clubs\/\d+$/.test(location.pathname) || /^\/profile\/\d+$/.test(location.pathname);

    if (!isRoofVisible) {
        return (
            <div className="sticky top-0 z-[60] w-full flex justify-center h-0">
                <button
                    onClick={() => setIsRoofVisible(true)}
                    className="bg-[#121b22] border border-t-0 border-slate-800 text-slate-500 hover:text-white px-8 py-1 rounded-b-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-all flex items-center gap-2 group hover:pt-2"
                >
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 hidden sm:block transition-all">Show Roof</span>
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <nav className={`sticky top-0 ${isCompactMode ? 'h-16' : 'h-24'} bg-white dark:bg-[#121b22] border-b border-slate-300 dark:border-slate-800 flex flex-col z-50 transition-all duration-500 ease-in-out shadow-xl overflow-hidden relative`}>

            {/* TOP ROW: Absolutely positioned to top. Container grows slightly to center elements smoothly. */}
            <div className={`absolute top-0 left-0 w-full flex justify-between items-center px-4 md:px-6 transition-all duration-500 ease-in-out z-10 ${
                isCompactMode ? 'h-16 pointer-events-none' : 'h-14 pointer-events-auto'
            }`}>

                {/* Left Cluster */}
                <div className={`flex items-center gap-4 lg:gap-6 w-auto lg:w-1/3 ${isCompactMode ? 'pointer-events-auto' : ''}`}>
                    <button className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
                        <Menu className="w-5 h-5" />
                    </button>
                    <Link to="/feed" className="font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest transition-all shrink-0 text-xl">
                        TALANTI
                    </Link>
                    <div className="hidden lg:flex items-center bg-slate-100 dark:bg-[#0a0f13] border border-transparent dark:border-slate-700 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 rounded-sm px-4 py-2 w-72 xl:w-96 transition-all shadow-inner">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input type="text" placeholder="Query database..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-900 dark:text-white placeholder-slate-500 font-medium" />
                    </div>
                </div>

                {/* Right Cluster */}
                <div className={`flex items-center justify-end gap-3 lg:w-1/3 ${isCompactMode ? 'pointer-events-auto' : ''}`}>
                    <NotificationBell enabled={Boolean(user?.id)} />

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

                    <Link to={user?.id ? `/profile/${user.id}` : "#"}>
                        <div className="w-9 h-9 ml-2 bg-slate-200 dark:bg-slate-800 rounded-sm border border-slate-300 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 transition-colors flex items-center justify-center text-xs text-slate-900 dark:text-white font-bold">
                            {user
                                ? (user.username || user.fullName || 'U').substring(0, 2).toUpperCase()
                                : <User className="w-4 h-4" />
                            }
                        </div>
                    </Link>

                    {/* HIDE ROOF BUTTON */}
                    <button onClick={() => setIsRoofVisible(false)} title="Hide Roof" className="ml-2 p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded-md transition-colors">
                        <ChevronUp className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* BOTTOM ROW: Absolutely positioned to bottom. Glides upward as the navbar shrinks. */}
            <div className={`absolute bottom-0 left-0 w-full flex justify-center transition-all duration-500 ease-in-out z-20 ${
                isCompactMode
                    ? 'h-16 border-transparent pointer-events-none'
                    : 'h-10 border-t border-slate-200 dark:border-slate-800/50 pointer-events-auto'
            }`}>
                <div className={`flex h-full ${isCompactMode ? 'pointer-events-auto' : ''}`}>
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
                                  className={`relative flex flex-col items-center justify-start h-full transition-all duration-500 ease-in-out group ${
                                      isCompactMode ? 'pt-4 px-5 sm:px-7' : 'pt-[10px] px-8 sm:px-10'
                                  } ${
                                      isActive
                                          ? "text-rose-600 dark:text-rose-500"
                                          : "text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                  }`}>

                                <item.icon className={`transition-all duration-500 ease-in-out ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'} w-5 h-5 group-hover:scale-110`} />

                                {/* Red active line pinned perfectly to bottom edge */}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-rose-500 rounded-t-full shadow-[0_-2px_8px_rgba(244,63,94,0.3)]" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};
