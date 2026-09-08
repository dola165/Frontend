import {
    Bell,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    Home,
    MessageSquare,
    MapPinned,
    Shield,
    Trophy,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';

export type NavigationKey =
    | 'home'
    | 'map'
    | 'clubs'
    | 'my-club'
    | 'calendar'
    | 'messages'
    | 'notifications'
    | 'people'
    | 'clubs-following'
    | 'jobs'
    | 'tournaments'
    | 'profile'
    | 'account'
    | 'tournament-setup'
    | 'marketplace'
    | 'needs'
    | 'admin';

export interface ProductNavigationItem {
    id: string;
    path: string;
    label: string;
    translationKey: string;
    icon: LucideIcon;
    authRequired: boolean;
    preview?: boolean;
}

export const primaryProductNavigation: ProductNavigationItem[] = [
    { id: 'home', path: '/home', label: 'Home', translationKey: 'nav.feed', icon: Home, authRequired: true },
    { id: 'map', path: '/map', label: 'Map', translationKey: 'nav.map', icon: MapPinned, authRequired: true },
    { id: 'clubs', path: '/clubs', label: 'Clubs', translationKey: 'nav.clubs', icon: Shield, authRequired: false },
    { id: 'my-club', path: '/my-club', label: 'My Club', translationKey: 'nav.myClub', icon: Building2, authRequired: true },
    { id: 'calendar', path: '/calendar', label: 'Schedule', translationKey: 'nav.schedule', icon: CalendarDays, authRequired: true },
];

export const secondaryProductNavigation: ProductNavigationItem[] = [
    { id: 'messages', path: '/messages', label: 'Messages', translationKey: 'nav.messages', icon: MessageSquare, authRequired: true },
    { id: 'notifications', path: '/notifications', label: 'Notifications', translationKey: 'nav.notifications', icon: Bell, authRequired: true },
    { id: 'people', path: '/people', label: 'People', translationKey: 'nav.people', icon: UsersRound, authRequired: true },
    { id: 'clubs-following', path: '/clubs/following', label: 'Followed clubs', translationKey: 'nav.followedClubs', icon: Shield, authRequired: true },
    { id: 'tournaments', path: '/tournaments', label: 'Tournaments', translationKey: 'nav.tournaments', icon: Trophy, authRequired: false, preview: true },
    { id: 'jobs', path: '/jobs', label: 'Jobs & volunteering', translationKey: 'nav.jobs', icon: BriefcaseBusiness, authRequired: false, preview: true },
];

const clubRoutePattern = /^\/clubs\/(\d+)(?:\/|$)/;

export const resolveNavigationKey = (pathname: string, myClubId: number | null) => {
    if (pathname === '/home' || pathname === '/feed') return 'home';
    if (pathname === '/map') return 'map';
    if (pathname === '/clubs') return 'clubs';
    if (pathname === '/clubs/following') return 'clubs-following';
    if (pathname === '/my-club') return 'my-club';
    if (pathname === '/calendar') return 'calendar';
    if (pathname === '/messages') return 'messages';
    if (pathname === '/notifications') return 'notifications';
    if (pathname === '/people') return 'people';
    if (pathname === '/account') return 'account';
    if (pathname === '/tournaments/setup') return 'tournament-setup';
    if (pathname === '/tournaments' || /^\/tournaments\/\d+/.test(pathname)) return 'tournaments';
    if (pathname === '/admin') return 'admin';
    if (pathname === '/marketplace') return 'marketplace';
    if (pathname === '/needs') return 'needs';
    if (pathname === '/jobs') return 'jobs';
    if (pathname.startsWith('/profile/')) return 'profile';

    const clubRouteMatch = pathname.match(clubRoutePattern);
    if (clubRouteMatch) {
        const currentClubId = Number(clubRouteMatch[1]);
        return myClubId != null && currentClubId === myClubId ? 'my-club' : 'clubs';
    }

    return null;
};
