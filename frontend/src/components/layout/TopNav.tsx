import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BellRing,
    Building2,
    CalendarDays,
    Home,
    Map as MapIcon,
    MessageSquare,
    Moon,
    Shield,
    ShieldCheck,
    ShoppingBag,
    Sun,
    Target,
    Trophy,
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

const labelKey = (id: string): string => {
    const keys: Record<string, string> = {
        feed: 'nav.feed', map: 'nav.map', clubs: 'nav.clubs', 'my-club': 'nav.myClub',
        calendar: 'nav.schedule', messages: 'nav.messages', marketplace: 'nav.marketplace',
        needs: 'nav.clubNeeds', notifications: 'nav.notifications', 'agent-dashboard': 'nav.agentHub',
        tournaments: 'nav.tournaments'
    };
    return keys[id] || id;
};

const primaryLinks = [
    { id: 'feed', path: '/feed', label: 'Feed', icon: Home, authRequired: true },
    { id: 'map', path: '/map', label: 'Map', icon: MapIcon, authRequired: true },
    { id: 'clubs', path: '/clubs', label: 'Clubs', icon: Shield, authRequired: false },
    { id: 'my-club', path: '/my-club', label: 'My Club', icon: Building2, authRequired: true },
    { id: 'calendar', path: '/calendar', label: 'Schedule', icon: CalendarDays, authRequired: true },
    { id: 'tournaments', path: '/tournaments', label: 'Tournaments', icon: Trophy, authRequired: false },
    { id: 'messages', path: '/messages', label: 'Messages', icon: MessageSquare, authRequired: true },
    { id: 'notifications', path: '/notifications', label: 'Notifications', icon: BellRing, authRequired: true },
];

// Agent-cut (P1 W1): Marketplace + Club Needs are AGENT-only surfaces. The seeded
// AGENT demo account (zviad@) keeps full access; other roles never see the links.
const agentOnlyLinks = [
    { id: 'marketplace', path: '/marketplace', label: 'Marketplace', icon: ShoppingBag, authRequired: false },
    { id: 'needs', path: '/needs', label: 'Club Needs', icon: Target, authRequired: false },
    { id: 'agent-dashboard', path: '/agent/dashboard', label: 'Agent Hub', icon: ShieldCheck, authRequired: true },
];

export const TopNav = ({ user, myClubId, darkMode, setDarkMode, handleLogout }: TopNavProps) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const activeKey = resolveNavigationKey(location.pathname, myClubId);
    const isClubPage = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);
    // W6: language switcher — shows the code of the language it will switch to.
    // i18next-browser-languagedetector persists the choice to localStorage
    // (cache key 'i18nextLng') on changeLanguage, so no manual storage needed.
    const currentLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase();
    const isGeorgian = currentLanguage.startsWith('ka');
    const switchLanguage = () => void i18n.changeLanguage(isGeorgian ? 'en' : 'ka');

    return (
        <nav className="sticky top-0 z-50 border-b border-[#ffffff0d] bg-[#0f1117] backdrop-blur-xl">
            <div className="mx-auto flex w-full flex-col px-6 sm:px-8">
                <div className="flex h-[56px] items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
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
                                className="hidden items-center gap-1.5 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5] sm:inline-flex"
                            >
                                <ShieldCheck className="h-3.5 w-3.5 text-[#16a34a]" />
                                Admin
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={switchLanguage}
                            className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-[#ffffff0d] bg-[#16181d] px-2.5 text-[11px] font-bold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
                            aria-label={t('nav.language')}
                            title={t('nav.language')}
                        >
                            {isGeorgian ? t('nav.langEn') : t('nav.langKa')}
                        </button>

                        <button
                            type="button"
                            onClick={() => setDarkMode(!darkMode)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
                            aria-label={darkMode ? t('nav.switchToLight') : t('nav.switchToDark')}
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        {user ? (
                            <>
                                <Link
                                    to="/account"
                                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-xs font-semibold transition-colors bg-[#16181d] text-[#f4f4f5] hover:bg-[#1a1c22]"
                                >
                                    {(user.username || user.fullName || 'U').substring(0, 2).toUpperCase()}
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="hidden rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex text-[#a1a1aa] hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
                                >
                                    {t('nav.signOut')}
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="hidden rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex text-[#a1a1aa] hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
                                >
                                    {t('nav.signIn')}
                                </Link>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#22c55e]"
                                >
                                    <User className="h-3.5 w-3.5" />
                                    {t('nav.account')}
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="scrollbar-hide overflow-x-auto border-t border-[#ffffff0d]">
                    <div className="flex min-w-max items-stretch gap-1 px-1">
                        {(() => {
                            // Filter links by auth status and role
                            const visibleLinks = [
                                ...primaryLinks.filter(item => !item.authRequired || !!user),
                                ...(user?.role === 'AGENT' ? agentOnlyLinks : [])
                            ];
                            return visibleLinks.map((item) => {
                            const active = activeKey === item.id;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`inline-flex h-10 items-center gap-2 border-b-[3px] px-3 text-xs font-semibold transition-colors ${
                                        active
                                            ? 'border-[#16a34a] text-[#16a34a]'
                                            : 'border-transparent text-[#a1a1aa] hover:bg-[#1a1c22] hover:text-[#f4f4f5]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${active ? 'text-[#16a34a]' : ''}`} />
                                    {t(labelKey(item.id), item.label)}
                                </Link>
                            );
                            });
                        })()}
                    </div>
                </div>
            </div>
        </nav>
    );
};
