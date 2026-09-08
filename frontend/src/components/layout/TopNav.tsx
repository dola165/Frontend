import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Bell,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    Check,
    HeartHandshake,
    Home,
    LogOut,
    Menu,
    MessageSquare,
    MapPinned,
    Moon,
    PanelTopClose,
    PanelTopOpen,
    Settings,
    Shield,
    ShieldCheck,
    ShoppingBag,
    Sun,
    Target,
    Trophy,
    User,
    UsersRound,
    Search,
    X
} from 'lucide-react';
import { GlobalSearchBar } from '../search/GlobalSearchBar';
import { NotificationBell } from '../notifications/NotificationBell';
import { resolveNavigationKey } from './navigation';
import { GrasskickzLogo } from './GrasskickzLogo';
import { AppPageFrame } from './AppPageShell';
import type { ThemePreference } from '../../theme';

interface TopNavProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    myClubId: number | null;
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    handleLogout: () => void;
    collapsible?: boolean;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

const labelKey = (id: string): string => {
    const keys: Record<string, string> = {
        home: 'nav.feed', map: 'nav.map', clubs: 'nav.clubs', 'my-club': 'nav.myClub',
        calendar: 'nav.schedule', messages: 'nav.messages', marketplace: 'nav.marketplace',
        needs: 'nav.clubNeeds', notifications: 'nav.notifications', 'agent-dashboard': 'nav.agentHub',
        tournaments: 'nav.tournaments', people: 'nav.people', 'clubs-following': 'nav.followedClubs',
        store: 'nav.store', jobs: 'nav.jobs', campaigns: 'nav.campaigns'
    };
    return keys[id] || id;
};

const primaryLinks = [
    { id: 'home', path: '/home', label: 'Home', icon: Home, authRequired: true },
    { id: 'map', path: '/map', label: 'Map', icon: MapPinned, authRequired: true },
    { id: 'clubs', path: '/clubs', label: 'Clubs', icon: Shield, authRequired: false },
    { id: 'my-club', path: '/my-club', label: 'My Club', icon: Building2, authRequired: true },
    { id: 'calendar', path: '/calendar', label: 'Schedule', icon: CalendarDays, authRequired: true },
    { id: 'tournaments', path: '/tournaments', label: 'Tournaments', icon: Trophy, authRequired: false },
];

// Agent-cut (P1 W1): Marketplace + Club Needs are AGENT-only surfaces. The seeded
// AGENT demo account (zviad@) keeps full access; other roles never see the links.
const agentOnlyLinks = [
    { id: 'marketplace', path: '/marketplace', label: 'Marketplace', icon: ShoppingBag, authRequired: false },
    { id: 'needs', path: '/needs', label: 'Club Needs', icon: Target, authRequired: false },
    { id: 'agent-dashboard', path: '/agent/dashboard', label: 'Agent Hub', icon: ShieldCheck, authRequired: true },
];

export const TopNav = ({
    user,
    myClubId,
    themePreference,
    setThemePreference,
    handleLogout,
    collapsible = false,
    collapsed = false,
    onCollapsedChange
}: TopNavProps) => {
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
    const [openMenuLocationKey, setOpenMenuLocationKey] = useState<string | null>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
    const mobileSearchTriggerRef = useRef<HTMLButtonElement | null>(null);
    const hadMobileSearchOpen = useRef(false);
    const hadMenuOpen = useRef(false);
    const menuOpen = openMenuLocationKey === location.key;
    const lightNavigation = themePreference === 'light';

    useEffect(() => {
        if (!menuOpen) return;
        const handleOutsideClick = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuLocationKey(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [menuOpen]);

    useEffect(() => {
        if (hadMobileSearchOpen.current && !mobileSearchOpen) {
            mobileSearchTriggerRef.current?.focus();
        }
        hadMobileSearchOpen.current = mobileSearchOpen;
    }, [mobileSearchOpen]);

    useEffect(() => {
        if (hadMenuOpen.current && !menuOpen) {
            menuTriggerRef.current?.focus();
        }
        hadMenuOpen.current = menuOpen;
    }, [menuOpen]);

    const iconActionClass = (active = false) => `inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] ${active
        ? lightNavigation ? 'border-[#16a34a]/45 bg-[#dcfce7] text-[#166534]' : 'border-[#22c55e]/45 bg-[#354038] text-[#86efac]'
        : lightNavigation ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950' : 'border-white/[0.07] bg-[#292d34] text-[#f1f3f5] hover:bg-[#363b44] hover:text-white'}`;
    const menuItemClass = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${lightNavigation ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950' : 'text-[#d4d4d8] hover:bg-white/[0.06] hover:text-white'}`;
    const visibleLinks = [
        ...primaryLinks.filter(item => !item.authRequired || !!user),
        ...(user?.role === 'AGENT' ? agentOnlyLinks : [])
    ];
    const mobileLinks = [
        ...visibleLinks,
        { id: 'messages', path: '/messages', label: 'Messages', icon: MessageSquare, authRequired: true },
        { id: 'notifications', path: '/notifications', label: 'Notifications', icon: Bell, authRequired: true },
        { id: 'people', path: '/people', label: 'People', icon: UsersRound, authRequired: true },
        { id: 'clubs-following', path: '/clubs/following', label: 'Followed clubs', icon: Shield, authRequired: true },
        { id: 'store', path: '/store', label: 'Store', icon: ShoppingBag, authRequired: false },
        { id: 'jobs', path: '/jobs', label: 'Jobs & volunteering', icon: BriefcaseBusiness, authRequired: false },
        { id: 'campaigns', path: '/campaigns', label: 'Campaigns', icon: HeartHandshake, authRequired: false }
    ].filter(item => !item.authRequired || !!user);

    if (collapsible && collapsed) {
        return (
            <button
                type="button"
                onClick={() => onCollapsedChange?.(false)}
                className={`fixed right-3 top-3 z-[1400] inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-xl backdrop-blur-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] ${lightNavigation ? 'border-slate-200 bg-white/95 text-slate-800 hover:border-[#16a34a]/50 hover:bg-slate-50' : 'border-white/10 bg-[#0f1117]/95 text-[#f4f4f5] hover:border-[#16a34a]/50 hover:bg-[#16181d]'}`}
                aria-label={t('nav.showNavigation')}
                title={t('nav.showNavigation')}
                aria-controls="app-top-navigation"
                aria-expanded="false"
            >
                <PanelTopOpen className="h-4 w-4 text-[#16a34a]" />
                <span className="hidden sm:inline">{t('nav.showNavigation')}</span>
            </button>
        );
    }

    return (
        <nav id="app-top-navigation" className={`sticky top-0 z-[1500] border-b backdrop-blur-xl ${lightNavigation ? 'top-nav-light border-slate-200 bg-[#f8fafc]' : 'top-nav-force-dark border-[#ffffff0d] bg-[#0f1117]'}`}>
            <AppPageFrame className="flex flex-col">
                <div className="flex h-[56px] items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link to={user ? '/home' : '/'} className="shrink-0">
                            <GrasskickzLogo compact={isClubPage} />
                        </Link>
                    </div>

                    <GlobalSearchBar light={lightNavigation} />

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
                        {!mobileSearchOpen && (
                            <button
                                type="button"
                                onClick={() => setMobileSearchOpen(true)}
                                className={`${iconActionClass()} lg:hidden`}
                                ref={mobileSearchTriggerRef}
                                aria-label={t('search.open')}
                                title={t('search.open')}
                                aria-expanded={mobileSearchOpen}
                                aria-controls="mobile-global-search"
                            >
                                <Search className="h-5 w-5" />
                            </button>
                        )}
                        {user ? (
                            <>
                                <Link
                                    to="/map"
                                    className={`world-nav-button inline-flex h-10 items-center rounded-full p-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1117] ${activeKey === 'map' ? 'world-nav-button--active' : ''}`}
                                    aria-label="GrassKickZ World map"
                                    title="GrassKickZ World"
                                >
                                    <span className="world-nav-button__inner flex h-full items-center gap-2 rounded-full px-2.5">
                                        <span className="hidden h-8 w-[94px] overflow-hidden sm:block">
                                            <img src="/brand/grasskickz-world-wordmark.png" alt="GrassKickZ World" className="h-full w-full object-cover object-center" />
                                        </span>
                                        <img src="/brand/grasskickz-world-mark.png" alt="" className="h-8 w-6 shrink-0 object-contain" />
                                    </span>
                                </Link>
                                <Link to="/messages" className={iconActionClass(activeKey === 'messages')} aria-label={t('nav.messages')} title={t('nav.messages')}>
                                    <MessageSquare className="h-5 w-5" />
                                </Link>
                                <NotificationBell enabled light={lightNavigation} />
                                <Link
                                    to={`/profile/${user.id}`}
                                    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] ${activeKey === 'profile'
                                        ? lightNavigation ? 'border-[#16a34a]/45 bg-[#dcfce7] text-[#166534]' : 'border-[#22c55e]/45 bg-[#354038] text-[#f4f4f5]'
                                        : lightNavigation ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-white/[0.07] bg-[#292d34] text-[#f4f4f5] hover:bg-[#363b44]'}`}
                                    aria-label={t('nav.profile')}
                                    title={t('nav.profile')}
                                >
                                    {(user.fullName || user.username || 'U').substring(0, 2).toUpperCase()}
                                </Link>

                                <div ref={menuRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setOpenMenuLocationKey(menuOpen ? null : location.key)}
                                        className={iconActionClass()}
                                        ref={menuTriggerRef}
                                        aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
                                        title={t('nav.menu')}
                                        aria-expanded={menuOpen}
                                        aria-haspopup="menu"
                                        aria-controls="account-navigation-menu"
                                    >
                                        <Menu className="h-5 w-5" />
                                    </button>

                                    {menuOpen && (
                                        <div id="account-navigation-menu" role="menu" className={`absolute right-0 top-11 z-[150] max-h-[min(80dvh,40rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-2 shadow-2xl ${lightNavigation ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#16181d]'}`}>
                                            <div className={`mb-2 border-b px-1 pb-2 lg:hidden ${lightNavigation ? 'border-slate-200' : 'border-white/[0.07]'}`} role="group" aria-label={t('nav.mobileNavigation')}>
                                                <p className={`px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${lightNavigation ? 'text-slate-500' : 'text-[#71717a]'}`}>{t('nav.mobileNavigation')}</p>
                                                {mobileLinks.map((item) => {
                                                    const Icon = item.icon;
                                                    return (
                                                        <Link key={`${item.id}-mobile`} to={item.path} role="menuitem" className={menuItemClass}>
                                                            <Icon className="h-4 w-4 text-[#16a34a]" />
                                                            {t(labelKey(item.id), item.label)}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                            <div className={`border-b px-3 pb-3 pt-2 ${lightNavigation ? 'border-slate-200' : 'border-white/[0.07]'}`}>
                                                <p className={`truncate text-sm font-semibold ${lightNavigation ? 'text-slate-900' : 'text-[#f4f4f5]'}`}>{user.fullName || user.username}</p>
                                                <p className={`mt-0.5 text-[11px] ${lightNavigation ? 'text-slate-500' : 'text-[#71717a]'}`}>{t('nav.menuDescription')}</p>
                                            </div>
                                            <Link to="/account" role="menuitem" className={`mt-2 ${menuItemClass}`}>
                                                <Settings className="h-4 w-4 text-[#16a34a]" />
                                                {t('nav.accountSettings')}
                                            </Link>
                                            {user.role === 'SYSTEM_ADMIN' && (
                                                <Link to="/admin" role="menuitem" className={menuItemClass}>
                                                    <ShieldCheck className="h-4 w-4 text-[#16a34a]" />
                                                    {t('nav.admin')}
                                                </Link>
                                            )}

                                            <div className={`my-1 border-y px-1 py-2 ${lightNavigation ? 'border-slate-200' : 'border-white/[0.07]'}`} role="group" aria-label={t('nav.appearance')}>
                                                <p className={`px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${lightNavigation ? 'text-slate-500' : 'text-[#71717a]'}`}>{t('nav.appearance')}</p>
                                                {([
                                                    { value: 'map-light' as const, label: t('nav.mapLightMode'), note: t('nav.recommended'), icon: MapPinned },
                                                    { value: 'dark' as const, label: t('nav.darkMode'), note: t('nav.everywhere'), icon: Moon },
                                                    { value: 'light' as const, label: t('nav.lightMode'), note: t('nav.everywhere'), icon: Sun }
                                                ]).map(({ value, label, note, icon: Icon }) => {
                                                    const selected = themePreference === value;
                                                    return (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            role="menuitemradio"
                                                            aria-checked={selected}
                                                            onClick={() => setThemePreference(value)}
                                                            className={`${menuItemClass} justify-between ${selected ? lightNavigation ? 'bg-[#dcfce7] text-[#166534]' : 'bg-white/[0.07] text-white' : ''}`}
                                                        >
                                                            <span className="flex min-w-0 items-center gap-3">
                                                                <Icon className="h-4 w-4 shrink-0 text-[#16a34a]" />
                                                                <span className="min-w-0">
                                                                    <span className="block truncate font-semibold">{label}</span>
                                                                    <span className={`block text-[10px] ${selected ? 'opacity-75' : lightNavigation ? 'text-slate-500' : 'text-[#71717a]'}`}>{note}</span>
                                                                </span>
                                                            </span>
                                                            {selected && <Check className="h-4 w-4 shrink-0 text-[#16a34a]" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button type="button" role="menuitem" onClick={switchLanguage} className={menuItemClass}>
                                                <span className="inline-flex h-4 min-w-4 items-center justify-center text-[10px] font-bold text-[#16a34a]">{isGeorgian ? 'EN' : 'GE'}</span>
                                                {isGeorgian ? t('nav.useEnglish') : t('nav.useGeorgian')}
                                            </button>
                                            <button type="button" role="menuitem" onClick={handleLogout} className={`mt-1 flex w-full items-center gap-3 border-t px-3 py-3 text-left text-sm text-rose-500 hover:bg-rose-500/10 ${lightNavigation ? 'border-slate-200' : 'border-white/[0.07]'}`}>
                                                <LogOut className="h-4 w-4" />
                                                {t('nav.signOut')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5] sm:inline-flex"
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

                        {collapsible && (
                            <button
                                type="button"
                                onClick={() => onCollapsedChange?.(true)}
                                className={iconActionClass()}
                                aria-label={t('nav.hideNavigation')}
                                title={t('nav.hideNavigation')}
                                aria-controls="app-top-navigation"
                                aria-expanded="true"
                            >
                                <PanelTopClose className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className={`scrollbar-hide overflow-x-auto border-t ${lightNavigation ? 'border-slate-200' : 'border-[#ffffff0d]'}`}>
                    <div className="flex min-w-max items-stretch gap-1 px-1">
                        {visibleLinks.map((item) => {
                            const active = activeKey === item.id;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`inline-flex h-10 items-center gap-2 border-b-[3px] px-3 text-xs font-semibold transition-colors ${
                                        active
                                            ? 'border-[#16a34a] text-[#16a34a]'
                                            : lightNavigation ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950' : 'border-transparent text-[#a1a1aa] hover:bg-[#1a1c22] hover:text-[#f4f4f5]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${active ? 'text-[#16a34a]' : ''}`} />
                                    {t(labelKey(item.id), item.label)}
                                </Link>
                            );
                        })}
                    </div>
                </div>
                {mobileSearchOpen && (
                    <div className={`flex items-center gap-2 border-t py-2 lg:hidden ${lightNavigation ? 'border-slate-200' : 'border-[#ffffff0d]'}`}>
                        <div id="mobile-global-search" className="min-w-0 flex-1">
                            <GlobalSearchBar light={lightNavigation} mobile />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setMobileSearchOpen(false);
                            }}
                            className={iconActionClass()}
                            aria-label={t('search.close')}
                            title={t('search.close')}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </AppPageFrame>
        </nav>
    );
};
