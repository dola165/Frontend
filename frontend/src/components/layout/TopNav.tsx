import { Link, useLocation } from 'react-router-dom';
import {
    BellRing,
    Building2,
    CalendarDays,
    Home,
    Map as MapIcon,
    Menu,
    MessageSquare,
    Moon,
    Shield,
    ShieldCheck,
    ShoppingBag,
    Sun,
    User
} from 'lucide-react';
import { GlobalSearchBar } from '../search/GlobalSearchBar';
import { NotificationBell } from '../notifications/NotificationBell';
import { resolveNavigationKey } from './navigation';
import { GrasskickzLogo } from './GrasskickzLogo';

interface TopNavProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    myClubId: number | null;
    darkMode: boolean;
    setDarkMode: (val: boolean) => void;
    handleLogout: () => void;
}

const primaryLinks = [
    { id: 'feed', path: '/feed', label: 'Feed', icon: Home },
    { id: 'map', path: '/map', label: 'Map', icon: MapIcon },
    { id: 'clubs', path: '/clubs', label: 'Clubs', icon: Shield },
    { id: 'my-club', path: '/my-club', label: 'My Club', icon: Building2 },
    { id: 'calendar', path: '/calendar', label: 'Schedule', icon: CalendarDays },
    { id: 'messages', path: '/messages', label: 'Messages', icon: MessageSquare },
    { id: 'marketplace', path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'notifications', path: '/notifications', label: 'Notifications', icon: BellRing }
];

export const TopNav = ({ user, myClubId, darkMode, setDarkMode, handleLogout }: TopNavProps) => {
    const location = useLocation();
    const activeKey = resolveNavigationKey(location.pathname, myClubId);
    const isClubPage = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);

    return (
        <nav className="sticky top-0 z-50 border-b border-subtle bg-base backdrop-blur-xl">
            <div className="mx-auto flex w-full flex-col px-6 sm:px-8">
                <div className="flex h-[56px] items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-black/5 dark:hover:bg-white/[0.06] lg:hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                        <Link to={user ? '/feed' : '/'} className="shrink-0">
                            <GrasskickzLogo compact={isClubPage} />
                        </Link>
                    </div>

                    <GlobalSearchBar />

                    <div className="flex shrink-0 items-center gap-1.5">
                        <NotificationBell enabled={Boolean(user?.id)} />

                        {user?.role === 'SYSTEM_ADMIN' && (
                            <Link
                                to="/admin"
                                className="hidden items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/[0.06] dark:bg-[#27272a] dark:text-[#a1a1aa] dark:hover:bg-[#1e293b] dark:hover:text-[#f4f4f5]"
                            >
                                <ShieldCheck className="h-3.5 w-3.5 text-[#00c853]" />
                                Admin
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() => setDarkMode(!darkMode)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/[0.06] dark:hover:text-[#f4f4f5]"
                            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        {user ? (
                            <>
                                <Link
                                    to="/account"
                                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-xs font-semibold transition-colors bg-[#f2f4f7] text-slate-700 hover:bg-slate-200 dark:bg-[#27272a] dark:text-[#f4f4f5] dark:hover:bg-[#1e293b]"
                                >
                                    {(user.username || user.fullName || 'U').substring(0, 2).toUpperCase()}
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="hidden rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-[#71717a] dark:hover:bg-white/[0.04] dark:hover:text-[#f4f4f5]"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="hidden rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-[#71717a] dark:hover:bg-white/[0.04] dark:hover:text-[#f4f4f5]"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-2 rounded-full bg-[#00c853] px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#00e676]"
                                >
                                    <User className="h-3.5 w-3.5" />
                                    Account
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="scrollbar-hide overflow-x-auto border-t border-subtle">
                    <div className="flex min-w-max items-stretch gap-1 px-1">
                        {primaryLinks.map((item) => {
                            const active = activeKey === item.id;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`inline-flex h-10 items-center gap-2 border-b-[3px] px-3 text-xs font-semibold transition-colors ${
                                        active
                                            ? 'border-[#00c853] text-[#00c853]'
                                            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-[#71717a] dark:hover:bg-white/[0.04] dark:hover:text-[#f4f4f5]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${active ? 'text-[#00c853]' : ''}`} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
};
