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
    Search,
    Shield,
    ShieldCheck,
    Sun,
    User
} from 'lucide-react';
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
    {
        id: 'feed',
        path: '/feed',
        label: 'Feed',
        icon: Home
    },
    {
        id: 'map',
        path: '/map',
        label: 'Map',
        icon: MapIcon
    },
    {
        id: 'clubs',
        path: '/clubs',
        label: 'Clubs',
        icon: Shield
    },
    {
        id: 'my-club',
        path: '/my-club',
        label: 'My Club',
        icon: Building2
    },
    {
        id: 'calendar',
        path: '/calendar',
        label: 'Schedule',
        icon: CalendarDays
    },
    {
        id: 'messages',
        path: '/messages',
        label: 'Messages',
        icon: MessageSquare
    },
    {
        id: 'notifications',
        path: '/notifications',
        label: 'Notifications',
        icon: BellRing
    }
];

export const TopNav = ({ user, myClubId, darkMode, setDarkMode, handleLogout }: TopNavProps) => {
    const location = useLocation();
    const activeKey = resolveNavigationKey(location.pathname, myClubId);
    const isClubPage = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);
    const navClassName = 'sticky top-0 z-50 border-b border-[color:var(--text-secondary)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] backdrop-blur-xl';
    const activeLinkClassName = 'border-[color:var(--accent-primary)] text-[color:var(--text-primary)]';
    const inactiveLinkClassName = 'border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]';
    const activeIconClassName = 'text-[color:var(--accent-primary)]';

    return (
        <nav className={navClassName}>
            <div className="mx-auto flex max-w-[1600px] flex-col px-4 sm:px-6">
                <div className="flex h-[68px] items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[color:var(--text-secondary)] lg:hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                        <Link to={user ? '/feed' : '/'} className="shrink-0">
                            <GrasskickzLogo compact={isClubPage} />
                        </Link>
                    </div>

                    <div className="hidden min-w-0 max-w-xl flex-1 items-center justify-center lg:flex">
                        <label className="flex w-full max-w-xl items-center gap-3 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2.5 text-[color:var(--text-secondary)] transition-colors focus-within:border-[color:var(--accent-primary)] focus-within:bg-white/[0.06]">
                            <Search className="h-4 w-4 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search clubs, players, locations"
                                className="w-full bg-transparent text-sm font-medium text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-secondary)]"
                            />
                        </label>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <NotificationBell enabled={Boolean(user?.id)} />

                        {user?.role === 'SYSTEM_ADMIN' && (
                            <Link
                                to="/admin"
                                className="hidden items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] sm:inline-flex"
                            >
                                <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--accent-highlight)]" />
                                Admin
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() => setDarkMode(!darkMode)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        {user ? (
                            <>
                                <Link
                                    to="/account"
                                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] px-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--text-primary)] transition-colors hover:border-white/18"
                                >
                                    {(user.username || user.fullName || 'U').substring(0, 2).toUpperCase()}
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="hidden rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] sm:inline-flex"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="hidden rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] sm:inline-flex"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-highlight)] bg-[color:var(--bg-surface)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--accent-highlight)] transition-colors hover:text-[color:var(--text-primary)]"
                                >
                                    <User className="h-3.5 w-3.5" />
                                    Account
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="scrollbar-hide overflow-x-auto border-t border-white/6">
                    <div className="flex min-w-max items-stretch gap-5">
                        {primaryLinks.map((item) => {
                            const active = activeKey === item.id;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`inline-flex h-11 items-center gap-2 border-b-2 px-1 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
                                        active
                                            ? activeLinkClassName
                                            : inactiveLinkClassName
                                    }`}
                                >
                                    <Icon className={`h-3.5 w-3.5 ${active ? activeIconClassName : ''}`} />
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
