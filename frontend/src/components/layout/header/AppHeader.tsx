import './header.css';
import { useContext, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Earth, Heart, House, MessageSquare, Shield, Sparkles, Users } from 'lucide-react';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { accessibleClubs } from '../clubAccess';
import { ButtonLink, Count } from '../../../design/primitives';
import type { AuthUser } from '../../../context/AuthContext';
import { DolaLink } from '../../../features/dola/DolaProvider';
import { DolaContext } from '../../../features/dola/DolaContext';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { themeForRoute, type ThemePreference } from '../../../theme';
import { AccountMenu } from './AccountMenu';
import { ExploreMenu } from './ExploreMenu';
import { HeaderBrand, HeaderTab } from './HeaderTab';
import { HeaderSearch } from './HeaderSearch';
import { InboxButton } from './inbox/InboxButton';
import { PhoneTabBar } from './PhoneTabBar';
import { describeRoute, normalizePath } from './pins/describeRoute';
import { workDestinations, workspaceDestinations } from './pins/pinCatalog';
import { PinsBar } from './pins/PinsBar';
import { usePins, type Pin } from './pins/usePins';
import { useVisitRecorder } from './pins/useVisitRecorder';
import { myClub, primarySectionFor, type PrimaryTab } from './sections';
import { useUnreadMessages } from './useUnreadMessages';

interface AppHeaderProps {
    user: AuthUser | null;
    myClubId: number | null;
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    onLogout: () => void;
}

/** The most specific pin for the current page: its path matches and every query value it names matches. */
function currentPin(pins: Pin[], pathname: string, search: string) {
    const here = normalizePath(pathname, '');
    const params = new URLSearchParams(search);
    return pins
        .filter(pin => {
            const [path, query] = pin.path.split('?');
            return path === here && [...new URLSearchParams(query)].every(([key, value]) => params.get(key) === value);
        })
        .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

/** One header row: brand and search on the left, Home · World · My squads · My Club and personal pins centred, then Dola, Inbox, Messages and the account. */
export function AppHeader(props: AppHeaderProps) {
    return props.user ? <SignedInHeader {...props} user={props.user} /> : <GuestHeader themePreference={props.themePreference} />;
}

function SignedInHeader({ user, myClubId, themePreference, setThemePreference, onLogout }: AppHeaderProps & { user: AuthUser }) {
    const copy = useJourneyCopy();
    const { pathname, search } = useLocation();
    const capabilities = user.navigationCapabilities;
    const club = useMemo(() => myClub(capabilities, myClubId), [capabilities, myClubId]);
    const pins = usePins(user.id, capabilities, club.path);
    const [crowded, setCrowded] = useState(false);
    useVisitRecorder(user.id, capabilities, club.path);
    const unread = useUnreadMessages();
    const work = useMemo(() => workDestinations(capabilities, club.path, copy), [capabilities, club.path, copy]);
    const workspaces = useMemo(() => workspaceDestinations(capabilities, club.path, copy), [capabilities, club.path, copy]);
    const page = describeRoute(pathname, search, { capabilities, userId: user.id, myClubPath: club.path, copy });
    const pinned = currentPin(pins.pins, pathname, search);
    const section = pinned ? null : primarySectionFor(pathname, club.ids, search);
    const tabs: PrimaryTab[] = [
        { id: 'home', to: '/home', label: copy('Home', 'მთავარი'), icon: House, current: section === 'home' },
        { id: 'world', to: '/world', label: copy('World', 'მსოფლიო'), icon: Earth, current: section === 'world' },
        // Role tabs come from relationships: coaching a squad gives My squads (first: the coach's own work comes before
        // the club), a linked child gives Parent Hub. Later hubs (referee, organiser) are one more line here.
        ...(accessibleClubs(capabilities).some(c => c.canOpenWorkspace) ? [{ id: 'my-squads' as const, to: '/my-squads', label: copy('My squads', 'ჩემი გუნდები'), icon: Users, current: section === 'my-squads' }] : []),
        // Without a club the tab stays: it offers Find your club · Start your club instead of disappearing.
        ...(club.path || capabilities !== undefined ? [{ id: 'my-club' as const, to: club.path ?? '/my-club', label: copy('My Club', 'ჩემი კლუბი'), icon: Shield, current: section === 'my-club' }] : []),
        ...(hasNavigationCapability(capabilities, 'parent.hub') ? [{ id: 'parent-hub' as const, to: '/parent', label: copy('Parent Hub', 'მშობლის სივრცე'), icon: Heart, current: section === 'parent-hub' }] : []),
    ];
    const light = themeForRoute(themePreference) === 'light';
    const dola = useContext(DolaContext);
    const dolaOpen = pathname === '/assistant' || Boolean(dola?.visible && dola.panel);

    return (
        <>
            <header className="gk gk-header" data-pins={!pins.pins.length ? 'none' : crowded ? 'crowded' : 'some'}>
                <div className="gk-frame gk-header__row gk-header__row--centred">
                    <div className="gk-header__start">
                        <HeaderBrand to="/home" />
                        <HeaderSearch light={light} />
                    </div>
                    <nav className="gk-header__nav" aria-label={copy('Main', 'მთავარი ნავიგაცია')}>
                        <ul className="gk-header__tabs">
                            {tabs.map(tab => <li key={tab.id}><HeaderTab to={tab.to} label={tab.label} icon={tab.icon} current={tab.current} /></li>)}
                        </ul>
                        <PinsBar state={pins} page={page} work={work} activePath={pinned?.path ?? null} crowded={crowded} onCrowdedChange={setCrowded} />
                    </nav>
                    <div className="gk-header__actions">
                        <DolaLink className="gk-hbtn gk-hbtn--dola" aria-label="Agent Dola" title={copy('Ask Agent Dola', 'ჰკითხეთ Agent Dola-ს')}
                            aria-current={pathname === '/assistant' ? 'page' : undefined} data-open={dolaOpen || undefined}>
                            <Sparkles aria-hidden="true" /><span className="gk-hbtn__label">Agent Dola</span>
                        </DolaLink>
                        <InboxButton />
                        <Link to="/messages" className="gk-hbtn gk-header__messages" aria-current={pathname === '/messages' ? 'page' : undefined} title={copy('Messages', 'მიმოწერა')}
                            aria-label={unread ? copy(`Messages, ${unread} unread conversations`, `მიმოწერა, ${unread} წაუკითხავი`) : copy('Messages', 'მიმოწერა')}>
                            <MessageSquare aria-hidden="true" /><Count value={unread ?? 0} />
                        </Link>
                        <AccountMenu user={user} workspaces={workspaces} themePreference={themePreference} setThemePreference={setThemePreference} onLogout={onLogout} />
                    </div>
                </div>
            </header>
            <PhoneTabBar tabs={tabs} unreadMessages={unread} pins={pins} page={page} work={work} onPinnedPage={pinned !== null} />
        </>
    );
}

/** Signed out: World, everything public behind Explore, search, language and the way in. */
function GuestHeader({ themePreference }: { themePreference: ThemePreference }) {
    const copy = useJourneyCopy();
    const { i18n } = useTranslation();
    const { pathname } = useLocation();
    const georgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    return (
        <header className="gk gk-header gk-header--guest">
            <div className="gk-frame gk-header__row">
                <HeaderBrand to="/" />
                <nav className="gk-header__nav" aria-label={copy('Main', 'მთავარი ნავიგაცია')}>
                    <ul className="gk-header__tabs">
                        <li><HeaderTab to="/world" label={copy('World', 'მსოფლიო')} icon={Earth} current={primarySectionFor(pathname, []) === 'world'} /></li>
                    </ul>
                    <ExploreMenu />
                </nav>
                <div className="gk-header__actions">
                    <HeaderSearch light={themeForRoute(themePreference) === 'light'} />
                    <button type="button" className="gk-hbtn gk-header__language" lang={georgian ? 'en' : 'ka'} onClick={() => void i18n.changeLanguage(georgian ? 'en' : 'ka')}
                        aria-label={georgian ? 'Use English' : 'ქართულად'} title={georgian ? 'Use English' : 'ქართულად'}>{georgian ? 'EN' : 'ქა'}</button>
                    <ButtonLink variant="ghost" to="/login" className="gk-header__signin">{copy('Sign in', 'შესვლა')}</ButtonLink>
                    <ButtonLink variant="primary" to="/signup" className="gk-header__signup">{copy('Create account', 'ანგარიშის შექმნა')}</ButtonLink>
                </div>
            </div>
        </header>
    );
}
