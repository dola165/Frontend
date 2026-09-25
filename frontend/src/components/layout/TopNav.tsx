import './football-nav-switch.css';
import { SettingsChoice } from './SettingsChoice';
import { showSquadNavigation } from './organizationNavigation';
import { DolaLink } from '../../features/dola/DolaProvider';
import { WorkspaceAccess } from './FootballActivity';
import { useFootballActivity } from './footballActivities';
import { MediaImage } from '../ui/MediaImage';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Languages,
    LayoutGrid,
    LogOut,
    Menu,
    MessageSquare,
    MapPinned,
    Moon,
    ChevronUp,
    ChevronDown,
    Settings,
    ShieldCheck,
    Sun,
    User,
    Search,
    X
} from 'lucide-react';
import { GlobalSearchBar } from '../search/GlobalSearchBar';
import { NotificationBell } from '../notifications/NotificationBell';
import { primaryProductNavigation, resolveNavigationKey, secondaryProductNavigation } from './navigation';
import { GrasskickzLogo } from './GrasskickzLogo';
import { AppPageFrame } from './AppPageShell';
import type { ThemePreference } from '../../theme';
import type { ManagedClubLink } from './WorkspaceShortcuts';
import { hasNavigationCapability, workspaceLinks, type NavigationCapabilities } from '../../context/navigationCapabilities';

interface TopNavProps {
    managedClubs?: ManagedClubLink[];
    user: { id?: number; username?: string; fullName?: string; role?: string; navigationCapabilities?: NavigationCapabilities } | null;
    myClubId: number | null;
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    handleLogout: () => void;
    collapsible?: boolean;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export const TopNav = ({
    user,
    myClubId,
    managedClubs = [],
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
    const [openExploreLocationKey, setOpenExploreLocationKey] = useState<string | null>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
    const exploreMenuRef = useRef<HTMLDivElement | null>(null);
    const exploreTriggerRef = useRef<HTMLButtonElement | null>(null);
    const mobileSearchTriggerRef = useRef<HTMLButtonElement | null>(null);
    const hadMobileSearchOpen = useRef(false);
    const hadMenuOpen = useRef(false);
    const exploreInitialFocus = useRef<'first' | 'last'>('first');
    const menuOpen = openMenuLocationKey === location.key;
    const exploreMenuOpen = openExploreLocationKey === location.key;
    const lightNavigation = themePreference === 'light';

    useEffect(() => {
        if (!menuOpen) return;
        const handleOutsideClick = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)
                && !(event.target instanceof Element && event.target.closest('[data-account-settings-panel]'))) {
                setOpenMenuLocationKey(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [menuOpen]);

    useEffect(() => {
        if (!exploreMenuOpen) return;
        const items = exploreMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        (exploreInitialFocus.current === 'last' ? items?.[items.length - 1] : items?.[0])?.focus();
        const handleOutsideClick = (event: MouseEvent) => {
            if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
                setOpenExploreLocationKey(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [exploreMenuOpen]);

    useEffect(() => {
        if (hadMobileSearchOpen.current && !mobileSearchOpen) {
            mobileSearchTriggerRef.current?.focus();
        }
        hadMobileSearchOpen.current = mobileSearchOpen;
    }, [mobileSearchOpen]);

    useEffect(() => {
        if (hadMenuOpen.current && !menuOpen && !exploreMenuOpen) {
            menuTriggerRef.current?.focus();
        }
        hadMenuOpen.current = menuOpen;
    }, [exploreMenuOpen, menuOpen]);

    const handleExploreKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' || (event.key === 'Tab' && exploreMenuOpen)) {
            event.preventDefault();
            event.stopPropagation();
            const trigger = exploreTriggerRef.current;
            if (event.key === 'Tab' && trigger) {
                const candidates = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
                    .filter((element) => {
                        if (element.tabIndex < 0 || element.matches(':disabled') || (element !== trigger && exploreMenuRef.current?.contains(element))) return false;
                        for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
                            const style = getComputedStyle(ancestor);
                            if (ancestor.hidden || ancestor.inert || style.display === 'none' || style.visibility === 'hidden') return false;
                        }
                        return true;
                    });
                const next = candidates[candidates.indexOf(trigger) + (event.shiftKey ? -1 : 1)];
                (next ?? trigger).focus();
            } else {
                trigger?.focus();
            }
            setOpenExploreLocationKey(null);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (!exploreMenuOpen) {
            exploreInitialFocus.current = event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first';
            setOpenMenuLocationKey(null);
            setOpenExploreLocationKey(location.key);
            return;
        }
        const items = Array.from(exploreMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        if (!items.length) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
    };

    const iconActionClass = (active = false) => `inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] ${active
        ? lightNavigation ? 'border-[#16a34a]/45 bg-[#dcfce7] text-[#166534]' : 'border-[#22c55e]/45 bg-[#354038] text-[#86efac]'
        : lightNavigation ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950' : 'border-white/[0.07] bg-[#292d34] text-[#f1f3f5] hover:bg-[#363b44] hover:text-white'}`;
    const menuItemClass = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${lightNavigation ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950' : 'text-[#d4d4d8] hover:bg-white/[0.06] hover:text-white'}`;
    const activity = useFootballActivity(user?.id, user?.navigationCapabilities);
    const visibleLinks = primaryProductNavigation.filter(item => !item.authRequired || !!user).map(item =>
        item.id === 'my-club' ? { ...item, ...activity.selected } : item
    );
    const visibleSecondaryLinks = [
        ...(user?.navigationCapabilities !== undefined
            ? workspaceLinks(user.navigationCapabilities).filter(link => link.capability !== 'admin.console')
                .map(link => ({ id: link.key, path: link.path, label: link.label, translationKey: `workspaceShortcut.${link.key}`, icon: LayoutGrid, authRequired: true, preview: false }))
            : managedClubs.map(club => ({ id: `workspace-${club.clubId}`, path: `/clubs/${club.clubId}/workspace`, label: `Workspace — ${club.clubName}`, translationKey: `workspaceShortcut.${club.clubId}`, icon: LayoutGrid, authRequired: true, preview: false }))),
        ...secondaryProductNavigation.filter(item => (item.id !== 'squads' || showSquadNavigation(user?.navigationCapabilities)) && (!item.authRequired || !!user)
            && (user?.navigationCapabilities === undefined || !['parent-hub', 'referees'].includes(item.id))),
    ];
    const mobileLinks = [
        ...visibleLinks,
        ...visibleSecondaryLinks,
    ];
    const secondaryActive = visibleSecondaryLinks.some((item) => item.id === activeKey);

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
                <ChevronDown className="h-4 w-4 text-[#16a34a]" />
                <span>{t('nav.showNavigation')}</span>
            </button>
        );
    }

    return (
        <nav id="app-top-navigation" className={`sticky top-0 z-[1500] border-b backdrop-blur-xl ${lightNavigation ? 'top-nav-light border-slate-200 bg-[#f8fafc]' : 'top-nav-force-dark border-[#33414d] bg-[#10151b]'}`}>
            <AppPageFrame className="relative flex flex-col">
                <div className="nav-primary-row flex h-[56px] items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link to={user ? '/home' : '/'} className="shrink-0">
                            <GrasskickzLogo compact={isClubPage} />
                        </Link>
                    </div>

                    <GlobalSearchBar light={lightNavigation} />

                    <div className="nav-actions flex shrink-0 items-center gap-1 sm:gap-2.5">
                        {!mobileSearchOpen && (
                            <button
                                type="button"
                                onClick={() => setMobileSearchOpen(true)}
                                className={`${iconActionClass()} nav-search-trigger lg:hidden`}
                                ref={mobileSearchTriggerRef}
                                aria-label={t('search.open')}
                                title={t('search.open')}
                                aria-expanded={mobileSearchOpen}
                                aria-controls="mobile-global-search"
                            >
                                <Search className="h-5 w-5" />
                            </button>
                        )}
                        <div ref={exploreMenuRef} className="relative" onKeyDown={handleExploreKeyDown}
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenExploreLocationKey(null);
                            }}>
                            <button
                                type="button"
                                onClick={() => {
                                    exploreInitialFocus.current = 'first';
                                    setOpenMenuLocationKey(null);
                                    setOpenExploreLocationKey(exploreMenuOpen ? null : location.key);
                                }}
                                className={`${iconActionClass(secondaryActive)} !w-auto gap-2 px-2.5 sm:px-3`}
                                ref={exploreTriggerRef}
                                aria-label={t('nav.explore')}
                                title={t('nav.explore')}
                                aria-expanded={exploreMenuOpen}
                                aria-haspopup="menu"
                                aria-controls="explore-navigation-menu"
                            >
                                <LayoutGrid className="h-5 w-5" />
                                <span className="nav-shortcut-label hidden text-xs font-semibold sm:inline">{t('nav.explore')}</span>
                            </button>

                            {exploreMenuOpen && (
                                <div id="explore-navigation-menu" role="menu" aria-label={t('nav.explore')} className={`fixed left-4 right-4 top-[3.5rem] z-[150] max-h-[min(80dvh,40rem)] overflow-y-auto rounded-2xl border p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-80 ${lightNavigation ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#16181d]'}`}>
                                    <p className={`px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] ${lightNavigation ? 'text-slate-500' : 'text-[#71717a]'}`}>{t('nav.mobileNavigation')}</p>
                                    {visibleSecondaryLinks.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <Link key={`${item.id}-explore`} to={item.path} role="menuitem" tabIndex={-1}
                                                onClick={() => { setOpenExploreLocationKey(null); exploreTriggerRef.current?.focus(); }}
                                                aria-label={item.preview ? `${t(item.translationKey, item.label)} — ${t('nav.preview')}` : undefined} className={`${menuItemClass} ${activeKey === item.id ? lightNavigation ? 'bg-[#dcfce7] text-[#166534]' : 'bg-white/[0.07] text-white' : ''}`}>
                                                <Icon className="h-4 w-4 shrink-0 text-[#16a34a]" />
                                                <span className="min-w-0 flex-1">{t(item.translationKey, item.label)}</span>
                                                {item.preview ? <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${lightNavigation ? 'border-amber-600/30 text-amber-700' : 'border-amber-400/30 text-amber-300'}`}>{t('nav.preview')}</span> : null}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {user ? (
                            <>
                                <Link
                                    to="/map"
                                    className={`world-nav-button hidden h-10 items-center rounded-full p-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1117] sm:inline-flex ${activeKey === 'map' ? 'world-nav-button--active' : ''}`}
                                    aria-label="GrassKickZ World map"
                                    title="GrassKickZ World"
                                >
                                    <span className="world-nav-button__inner flex h-full items-center gap-2 rounded-full px-2.5">
                                        <span className="world-nav-wordmark hidden h-8 w-[94px] overflow-hidden sm:block">
                                            <MediaImage src="/brand/grasskickz-world-wordmark.png" alt="GrassKickZ World" className="h-full w-full object-cover object-center" />
                                        </span>
                                        <MediaImage src="/brand/grasskickz-world-mark.png" alt="" className="h-8 w-6 shrink-0 object-contain" />
                                    </span>
                                </Link>
                                <span className="hidden md:inline-flex">
                                    <DolaLink aria-label="Agent Dola" title="Ask Agent Dola"
                                        className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${lightNavigation ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'}`}>
                                        <Sparkles className="h-4 w-4" /><span>Agent Dola</span>
                                    </DolaLink>
                                </span>
                                <DolaLink className={`${iconActionClass(location.pathname === '/assistant')} nav-dola-mobile md:hidden`} aria-label="Agent Dola" title="Ask Agent Dola"><Sparkles className="h-5 w-5" /></DolaLink>
                                <span className="hidden md:inline-flex">
                                    <Link to="/messages" className={iconActionClass(activeKey === 'messages')} aria-label={t('nav.messages')} title={t('nav.messages')}>
                                        <MessageSquare className="h-5 w-5" />
                                    </Link>
                                </span>
                                <span className="hidden md:block"><NotificationBell enabled light={lightNavigation} /></span>
                                <Link
                                    to={`/profile/${user.id}`}
                                    className={`nav-profile-shortcut hidden h-10 min-w-10 items-center justify-center rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] sm:inline-flex ${activeKey === 'profile'
                                        ? lightNavigation ? 'border-[#16a34a]/45 bg-[#dcfce7] text-[#166534]' : 'border-[#22c55e]/45 bg-[#354038] text-[#f4f4f5]'
                                        : lightNavigation ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-white/[0.07] bg-[#292d34] text-[#f4f4f5] hover:bg-[#363b44]'}`}
                                    aria-label={t('nav.profile')}
                                    title={t('nav.profile')}
                                >
                                    {(user.fullName || user.username || 'U').substring(0, 2).toUpperCase()}
                                </Link>

                                <div ref={menuRef} className="relative" onKeyDown={event => {
                                    if (event.key === 'Escape' && menuOpen) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setOpenMenuLocationKey(null);
                                    }
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpenExploreLocationKey(null);
                                            setOpenMenuLocationKey(menuOpen ? null : location.key);
                                        }}
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
                                                <Link to={`/profile/${user.id}`} role="menuitem" className={menuItemClass}><User size={16} /> Profile</Link>
                                                <WorkspaceAccess key={user.id} userId={user.id} caps={user.navigationCapabilities} className={menuItemClass} />
                                                {mobileLinks.map((item) => {
                                                    const Icon = item.icon;
                                                    return (
                                                        <Link key={`${item.id}-mobile`} to={item.path} role="menuitem" aria-label={item.preview ? `${t(item.translationKey, item.label)} — ${t('nav.preview')}` : undefined} className={menuItemClass}>
                                                            <Icon className="h-4 w-4 text-[#16a34a]" />
                                                            <span className="min-w-0 flex-1">{t(item.translationKey, item.label)}</span>
                                                            {item.preview ? <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">{t('nav.preview')}</span> : null}
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
                                            <DolaLink role="menuitem" className={menuItemClass}>
                                                <Sparkles className="h-4 w-4 text-[#16a34a]" />Agent Dola
                                            </DolaLink>
                                            {hasNavigationCapability(user.navigationCapabilities, 'admin.console') && (
                                                <Link to="/admin" role="menuitem" className={menuItemClass}>
                                                    <ShieldCheck className="h-4 w-4 text-[#16a34a]" />
                                                    {t('nav.admin')}
                                                </Link>
                                            )}

                                            <div className={`my-1 border-y py-1 ${lightNavigation ? 'border-slate-200' : 'border-white/[0.07]'}`}>
                                                <SettingsChoice
                                                    id="account-appearance"
                                                    label={t('nav.appearance')}
                                                    icon={themePreference === 'light' ? Sun : themePreference === 'dark' ? Moon : MapPinned}
                                                    value={themePreference}
                                                    onChange={value => setThemePreference(value as ThemePreference)}
                                                    light={lightNavigation}
                                                    options={[
                                                        { value: 'map-light', label: t('nav.mapLightMode'), note: t('nav.recommended'), icon: MapPinned },
                                                        { value: 'dark', label: t('nav.darkMode'), note: t('nav.everywhere'), icon: Moon },
                                                        { value: 'light', label: t('nav.lightMode'), note: t('nav.everywhere'), icon: Sun },
                                                    ]}
                                                />
                                                <SettingsChoice
                                                    id="account-language"
                                                    label={t('nav.languageLabel')}
                                                    icon={Languages}
                                                    value={currentLanguage.split('-')[0]}
                                                    onChange={value => void i18n.changeLanguage(value)}
                                                    light={lightNavigation}
                                                    options={Object.keys(i18n.options.resources ?? {}).map(value => ({
                                                        value,
                                                        label: new Intl.DisplayNames([value], { type: 'language' }).of(value) ?? value,
                                                    }))}
                                                />
                                            </div>

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
                                <button type="button" onClick={switchLanguage} className={iconActionClass()}
                                    aria-label={isGeorgian ? t('nav.useEnglish') : t('nav.useGeorgian')}
                                    title={t('nav.language')}>
                                    <span className="text-xs font-semibold">{isGeorgian ? 'EN' : 'GE'}</span>
                                </button>
                                <Link
                                    to="/login"
                                    className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5] sm:inline-flex"
                                >
                                    {t('nav.signIn')}
                                </Link>
                                <Link
                                    to="/signup"
                                    aria-label={t('nav.account')}
                                    title={t('nav.account')}
                                    className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-[#16a34a] px-2.5 text-xs font-semibold text-black transition-colors hover:bg-[#22c55e] sm:px-4"
                                >
                                    <User className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{t('nav.account')}</span>
                                </Link>
                            </>
                        )}

                    </div>
                </div>

                <div className={`flex min-w-0 items-center border-t ${lightNavigation ? 'border-slate-200' : 'border-[#ffffff0d]'}`}>
                    <div className="scrollbar-hide flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto px-1">
                        {visibleLinks.map((item) => {
                            const active = activeKey === item.id;
                            const Icon = item.icon;

                            return (
                                <span key={item.path} className="football-nav-entry"><Link
                                    key={item.path}
                                    to={item.path}
                                    className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-xs font-semibold transition-colors ${
                                        active
                                            ? lightNavigation ? 'border-[#137b46] text-[#137b46]' : 'border-[#00e676] text-[#00e676]'
                                            : lightNavigation ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950' : 'border-transparent text-[#a1a1aa] hover:bg-[#1a1c22] hover:text-[#f4f4f5]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${active ? 'text-current' : ''}`} />
                                    {t(item.translationKey, item.label)}
                                    {item.preview ? <span className="rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-300">{t('nav.preview')}</span> : null}
                                </Link>{item.id === activity.selected.id && activity.activities.length > 1 && <span className="football-nav-switch" title="Switch your football activity"><ChevronDown size={14} aria-hidden="true" /><select aria-label="Switch football activity" value={activity.selected.id} onChange={e => activity.choose(e.target.value)}>{activity.activities.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></span>}</span>
                            );
                        })}
                    </div>
                    {collapsible && (
                        <button type="button" onClick={() => onCollapsedChange?.(true)}
                            className="nav-hide-control inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--theme-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
                            aria-label={t('nav.hideNavigation')} title={t('nav.hideNavigation')}
                            aria-controls="app-top-navigation" aria-expanded="true">
                            <ChevronUp className="h-4 w-4" /><span className="hidden sm:inline">{t('nav.hideNavigation')}</span>
                        </button>
                    )}
                </div>
                {mobileSearchOpen && (
                    <div className={`nav-mobile-search-row flex items-center gap-2 border-t py-2 lg:hidden ${lightNavigation ? 'border-slate-200' : 'border-[#ffffff0d]'}`}>
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
