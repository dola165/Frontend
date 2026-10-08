import './football-nav-switch.css';
import { SelectionIndicator } from '../ui/SelectionIndicator';
import { SettingsChoice } from './SettingsChoice';
import { showSquadNavigation } from './organizationNavigation';
import { DolaLink } from '../../features/dola/DolaProvider';
import { footballActivities } from './footballActivities';
import { GrasskickzWorldLogo } from './GrasskickzWorldLogo';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Languages,
    LayoutGrid,
    Trophy,
    BriefcaseBusiness,
    LogOut,
    Menu,
    MessageSquare,
    MapPinned,
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
import { RequestsLink } from '../../features/requests/RequestsCentre';
import { isNavigationDestinationActive, primaryProductNavigation, resolveNavigationKey, secondaryProductNavigation } from './navigation';
import { accessibleClubs } from './clubAccess';
import { GrasskickzLogo } from './GrasskickzLogo';
import { productSurface } from './productDesign';
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
    quietCollapsed?: boolean;
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
    quietCollapsed = false,
    onCollapsedChange
}: TopNavProps) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const activeKey = resolveNavigationKey(location.pathname, myClubId, {
        search: location.search, clubIds: accessibleClubs(user?.navigationCapabilities).map(club => club.id),
        venueIds: user?.navigationCapabilities?.workspaces.filter(workspace => workspace.id === 'venue.workspace').map(workspace => workspace.context.id),
    });
    const isActive = (item: { id: string; path: string }) => isNavigationDestinationActive(item, location.pathname, location.search, activeKey);
    const isClubPage = /^\/clubs\/\d+(\/squads)?$/.test(location.pathname);
    const refreshedNavigation = Boolean(productSurface(location.pathname)) || location.pathname === '/home' || location.pathname === '/clubs' || /^\/clubs\/\d+$/.test(location.pathname);
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
    const accountInitialFocus = useRef<'first' | 'last'>('first');
    const exploreInitialFocus = useRef<'first' | 'last'>('first');
    const menuOpen = openMenuLocationKey === location.key;
    const exploreMenuOpen = openExploreLocationKey === location.key;
    const lightNavigation = themePreference === 'light';

    useEffect(() => {
        if (!menuOpen) return;
        const items = visibleMenuItems(menuRef.current);
        (accountInitialFocus.current === 'last' ? items.at(-1) : items[0])?.focus();
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

    const handleAccountKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // Settings choices are portaled and own their keyboard interaction.
        if (event.target instanceof Element && event.target.closest('[data-account-settings-panel]')) return;
        if (event.key === 'Escape' && menuOpen) {
            event.preventDefault(); event.stopPropagation(); setOpenMenuLocationKey(null); menuTriggerRef.current?.focus();
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (!menuOpen) {
            accountInitialFocus.current = event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first';
            setOpenExploreLocationKey(null); setOpenMenuLocationKey(location.key);
            return;
        }
        const items = visibleMenuItems(menuRef.current);
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
    };

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

    const iconActionClass = (active = false) => `inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${active
        ? lightNavigation ? 'border-[var(--color-accent)]/45 bg-[var(--color-inset)] text-[var(--color-accent)]' : 'border-[var(--color-accent)]/45 bg-[var(--color-inset)] text-[var(--color-accent)]'
        : lightNavigation ? 'border-[color:var(--color-border)] bg-[color:var(--color-elevated)] text-[color:var(--color-text)] hover:bg-[color:var(--color-inset)] hover:text-[color:var(--color-text)]' : 'border-[color:var(--color-border)]/[0.07] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-inset)] hover:text-[color:var(--color-text)]'}`;
    const menuItemClass = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${lightNavigation ? 'text-[color:var(--color-text)] hover:bg-[color:var(--color-inset)] hover:text-[color:var(--color-text)]' : 'text-[var(--color-muted)] hover:bg-[color:var(--color-ink)]/[0.06] hover:text-[color:var(--color-text)]'}`;
    const activities = footballActivities(user?.navigationCapabilities);
    const visibleLinks = primaryProductNavigation.filter(item => !item.authRequired || !!user).flatMap(item =>
        item.id === 'my-club' ? activities.map(activity => ({ ...item, ...activity, icon:activity.id==='my-club'?item.icon:activity.id==='tournaments'?Trophy:LayoutGrid })) : [item]
    );
    if(user)visibleLinks.push({id:'workspaces',path:'/workspaces',label:'My work',translationKey:'connectedWork.myWork',icon:BriefcaseBusiness,authRequired:true});
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
    ].filter((item, index, links) => links.findIndex(link => link.path === item.path) === index);
    const secondaryActive = visibleSecondaryLinks.some(isActive);

    if (collapsible && collapsed) {
        if (quietCollapsed) return null;
        return (
            <button
                type="button"
                onClick={() => onCollapsedChange?.(false)}
                className="fixed right-3 top-2 z-[1400] inline-flex h-8 w-9 items-center justify-center rounded-lg border border-[var(--border-primary)] bg-[var(--theme-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--theme-page)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                aria-label={t('nav.showNavigation')}
                title={t('nav.showNavigation')}
                aria-controls="app-top-navigation"
                aria-expanded="false"
            >
                <ChevronDown className="h-4 w-4 text-[var(--color-accent)]" />
            </button>
        );
    }

    return (
        <nav id="app-top-navigation" className={`sticky top-0 z-[1500] border-b backdrop-blur-xl ${refreshedNavigation ? 'top-nav-home' : ''} ${['/home', '/feed'].includes(location.pathname) ? 'top-nav-feed' : ''} ${lightNavigation ? 'top-nav-light border-[color:var(--color-border)] bg-[var(--color-elevated)]' : 'top-nav-force-dark border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
            <AppPageFrame className="relative flex flex-col">
                <div className="nav-primary-row flex h-[56px] items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link to={user ? '/home' : '/'} className="shrink-0">
                            <GrasskickzLogo compact={isClubPage} wordmark={refreshedNavigation} />
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
                                aria-controls={exploreMenuOpen ? "explore-navigation-menu" : undefined}
                            >
                                <LayoutGrid className="h-5 w-5" />
                                <span className="nav-shortcut-label hidden text-xs font-semibold sm:inline">{t('nav.explore')}</span>
                            </button>

                            {exploreMenuOpen && (
                                <div id="explore-navigation-menu" role="menu" aria-label={t('nav.explore')} className={`fixed left-4 right-4 top-[3.5rem] z-[150] max-h-[min(80dvh,40rem)] overflow-y-auto rounded-2xl border p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-80 ${lightNavigation ? 'border-[color:var(--color-border)] bg-[color:var(--color-elevated)]' : 'border-[color:var(--color-border)]/10 bg-[var(--color-surface)]'}`}>
                                    <p className={`px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] ${lightNavigation ? 'text-[color:var(--color-muted)]' : 'text-[var(--color-secondary)]'}`}>{t('nav.mobileNavigation')}</p>
                                    {visibleSecondaryLinks.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <Link key={`${item.id}-explore`} to={item.path} role="menuitem" tabIndex={-1}
                                                aria-current={isActive(item) ? 'page' : undefined}
                                                onClick={() => { setOpenExploreLocationKey(null); exploreTriggerRef.current?.focus(); }}
                                                aria-label={item.preview ? `${t(item.translationKey, item.label)} — ${t('nav.preview')}` : undefined} className={`${menuItemClass} ${isActive(item) ? lightNavigation ? 'bg-[var(--color-inset)] text-[var(--color-accent)]' : 'bg-[color:var(--color-ink)]/[0.07] text-[color:var(--color-text)]' : ''}`}>
                                                <Icon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                                                <span className="min-w-0 flex-1">{t(item.translationKey, item.label)}</span>
                                                {item.preview ? <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${lightNavigation ? 'border-[color:var(--color-warning)]/30 text-[color:var(--color-warning)]' : 'border-[color:var(--color-warning)]/30 text-[color:var(--color-warning)]'}`}>{t('nav.preview')}</span> : null}
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
                                    className={`world-nav-button hidden h-10 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] sm:inline-flex ${activeKey === 'map' ? 'world-nav-button--active' : ''}`}
                                    aria-label="GrassKickZ World map"
                                    title="GrassKickZ World"
                                >
                                    <span className="world-nav-button__inner flex h-full items-center rounded-xl px-2.5">
                                        <GrasskickzWorldLogo />
                                    </span>
                                </Link>
                                <span className="hidden md:inline-flex">
                                    <DolaLink aria-label="Agent Dola" title="Ask Agent Dola"
                                        className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] ${lightNavigation ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)]' : 'border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/20'}`}>
                                        <Sparkles className="h-4 w-4" /><span>Agent Dola</span>
                                    </DolaLink>
                                </span>
                                <DolaLink className={`${iconActionClass(location.pathname === '/assistant')} nav-dola-mobile md:hidden`} aria-label="Agent Dola" title="Ask Agent Dola"><Sparkles className="h-5 w-5" /></DolaLink>
                                <span className="hidden md:inline-flex">
                                    <Link to="/messages" className={iconActionClass(activeKey === 'messages')} aria-label={t('nav.messages')} title={t('nav.messages')}>
                                        <MessageSquare className="h-5 w-5" />
                                    </Link>
                                </span>
                                <RequestsLink light={lightNavigation} />
                                <span className="hidden md:block"><NotificationBell enabled light={lightNavigation} /></span>
                                <Link
                                    to={`/profile/${user.id}`}
                                    className={`nav-profile-shortcut hidden h-10 min-w-10 items-center justify-center rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:inline-flex ${activeKey === 'profile'
                                        ? lightNavigation ? 'border-[var(--color-accent)]/45 bg-[var(--color-inset)] text-[var(--color-accent)]' : 'border-[var(--color-accent)]/45 bg-[var(--color-inset)] text-[var(--color-text)]'
                                        : lightNavigation ? 'border-[color:var(--color-border)] bg-[color:var(--color-elevated)] text-[color:var(--color-text)] hover:bg-[color:var(--color-inset)]' : 'border-[color:var(--color-border)]/[0.07] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-inset)]'}`}
                                    aria-label={t('nav.profile')}
                                    title={t('nav.profile')}
                                >
                                    {(user.fullName || user.username || 'U').substring(0, 2).toUpperCase()}
                                </Link>

                                <div ref={menuRef} className="relative" onKeyDown={handleAccountKeyDown} onBlur={event => {
                                    const next = event.relatedTarget as Element | null;
                                    if (next && !event.currentTarget.contains(next) && !next.closest('[data-account-settings-panel]')) setOpenMenuLocationKey(null);
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            accountInitialFocus.current = 'first';
                                            setOpenExploreLocationKey(null);
                                            setOpenMenuLocationKey(menuOpen ? null : location.key);
                                        }}
                                        className={iconActionClass()}
                                        ref={menuTriggerRef}
                                        aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
                                        title={t('nav.menu')}
                                        aria-expanded={menuOpen}
                                        aria-haspopup="menu"
                                        aria-controls={menuOpen ? "account-navigation-menu" : undefined}
                                    >
                                        <Menu className="h-5 w-5" />
                                    </button>

                                    {menuOpen && (
                                        <div id="account-navigation-menu" role="menu" className={`absolute right-0 top-11 z-[150] max-h-[min(80dvh,40rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-2 shadow-2xl ${lightNavigation ? 'border-[color:var(--color-border)] bg-[color:var(--color-elevated)]' : 'border-[color:var(--color-border)]/10 bg-[var(--color-surface)]'}`}>
                                            <div className={`mb-2 border-b px-1 pb-2 lg:hidden ${lightNavigation ? 'border-[color:var(--color-border)]' : 'border-[color:var(--color-border)]/[0.07]'}`} role="group" aria-label={t('nav.mobileNavigation')}>
                                                <p className={`px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${lightNavigation ? 'text-[color:var(--color-muted)]' : 'text-[var(--color-secondary)]'}`}>{t('nav.mobileNavigation')}</p>
                                                <Link to={`/profile/${user.id}`} role="menuitem" className={menuItemClass}><User size={16} /> Profile</Link>
                                                {mobileLinks.map((item) => {
                                                    const Icon = item.icon;
                                                    return (
                                                        <Link key={`${item.id}-mobile`} to={item.path} role="menuitem" aria-current={isActive(item) ? 'page' : undefined} aria-label={item.preview ? `${t(item.translationKey, item.label)} — ${t('nav.preview')}` : undefined} className={menuItemClass}>
                                                            <Icon className="h-4 w-4 text-[var(--color-accent)]" />
                                                            <span className="min-w-0 flex-1">{t(item.translationKey, item.label)}</span>
                                                            {item.preview ? <span className="rounded-full border border-[color:var(--color-warning)]/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--color-warning)]">{t('nav.preview')}</span> : null}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                            <div className={`border-b px-3 pb-3 pt-2 ${lightNavigation ? 'border-[color:var(--color-border)]' : 'border-[color:var(--color-border)]/[0.07]'}`}>
                                                <p className={`truncate text-sm font-semibold ${lightNavigation ? 'text-[color:var(--color-text)]' : 'text-[var(--color-text)]'}`}>{user.fullName || user.username}</p>
                                                <p className={`mt-0.5 text-[11px] ${lightNavigation ? 'text-[color:var(--color-muted)]' : 'text-[var(--color-secondary)]'}`}>{t('nav.menuDescription')}</p>
                                            </div>
                                            <Link to="/account" role="menuitem" className={`mt-2 ${menuItemClass}`}>
                                                <Settings className="h-4 w-4 text-[var(--color-accent)]" />
                                                {t('nav.accountSettings')}
                                            </Link>
                                            <DolaLink role="menuitem" className={menuItemClass}>
                                                <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />Agent Dola
                                            </DolaLink>
                                            {hasNavigationCapability(user.navigationCapabilities, 'admin.console') && (
                                                <Link to="/admin" role="menuitem" className={menuItemClass}>
                                                    <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
                                                    {t('nav.admin')}
                                                </Link>
                                            )}

                                            <div className={`my-1 border-y py-1 ${lightNavigation ? 'border-[color:var(--color-border)]' : 'border-[color:var(--color-border)]/[0.07]'}`}>
                                                <SettingsChoice
                                                    id="account-appearance"
                                                    label={t('nav.appearance')}
                                                    icon={themePreference === 'light' ? Sun : MapPinned}
                                                    value={themePreference === 'dark' ? 'map-light' : themePreference}
                                                    onChange={value => setThemePreference(value as ThemePreference)}
                                                    light={lightNavigation}
                                                    options={[
                                                        { value: 'map-light', label: t('nav.mapLightMode'), note: t('nav.recommended'), icon: MapPinned },
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

                                            <button type="button" role="menuitem" onClick={handleLogout} className={`mt-1 flex w-full items-center gap-3 border-t px-3 py-3 text-left text-sm text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 ${lightNavigation ? 'border-[color:var(--color-border)]' : 'border-[color:var(--color-border)]/[0.07]'}`}>
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
                                    className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] sm:inline-flex"
                                >
                                    {t('nav.signIn')}
                                </Link>
                                <Link
                                    to="/signup"
                                    aria-label={t('nav.account')}
                                    title={t('nav.account')}
                                    className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-2.5 text-xs font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] sm:px-4"
                                >
                                    <User className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{t('nav.account')}</span>
                                </Link>
                            </>
                        )}

                    </div>
                </div>

                <div className={`flex min-w-0 items-center border-t ${lightNavigation ? 'border-[color:var(--color-border)]' : 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]'}`}>
                    <div className="app-selection-rail scrollbar-hide flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto px-1">
                        <SelectionIndicator value={`${activeKey}:${location.pathname}:${location.search}`} selector='.football-nav-entry > a[aria-current="page"]' />
                        {visibleLinks.map((item) => {
                            const active = isActive(item);
                            const Icon = item.icon;

                            return (
                                <span key={item.path} className="football-nav-entry"><Link
                                    key={item.path}
                                    to={item.path}
                                    aria-current={active ? 'page' : undefined}
                                    className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-xs font-semibold transition-colors ${
                                        active
                                            ? lightNavigation ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-accent)] text-[var(--color-accent)]'
                                            : lightNavigation ? 'border-transparent text-[color:var(--color-muted)] hover:bg-[color:var(--color-inset)] hover:text-[color:var(--color-text)]' : 'border-transparent text-[var(--color-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${active ? 'text-current' : ''}`} strokeWidth={1.6} aria-hidden="true" />
                                    {t(item.translationKey, item.label)}
                                    {item.preview ? <span className="rounded-full border border-[color:var(--color-warning)]/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[color:var(--color-warning)]">{t('nav.preview')}</span> : null}
                                </Link></span>
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
                    <div className={`nav-mobile-search-row flex items-center gap-2 border-t py-2 lg:hidden ${lightNavigation ? 'border-[color:var(--color-border)]' : 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]'}`}>
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

function visibleMenuItems(container: HTMLElement | null): HTMLElement[] {
    return Array.from(container?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter(element => {
        for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (ancestor.hidden || ancestor.inert || style.display === 'none' || style.visibility === 'hidden') return false;
        }
        return !element.matches(':disabled');
    });
}
