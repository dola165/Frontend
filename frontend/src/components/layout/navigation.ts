export type NavigationKey =
    | 'feed'
    | 'map'
    | 'clubs'
    | 'my-club'
    | 'calendar'
    | 'messages'
    | 'notifications'
    | 'profile'
    | 'account'
    | 'tournament-setup'
    | 'admin'
    | 'store'
    | 'charity';

const clubRoutePattern = /^\/clubs\/(\d+)(?:\/|$)/;

export const resolveNavigationKey = (pathname: string, myClubId: number | null) => {
    if (pathname === '/feed') return 'feed';
    if (pathname === '/map') return 'map';
    if (pathname === '/clubs') return 'clubs';
    if (pathname === '/my-club') return 'my-club';
    if (pathname === '/calendar') return 'calendar';
    if (pathname === '/messages') return 'messages';
    if (pathname === '/notifications') return 'notifications';
    if (pathname === '/account') return 'account';
    if (pathname === '/tournaments/setup') return 'tournament-setup';
    if (pathname === '/admin') return 'admin';
    if (pathname === '/store') return 'store';
    if (pathname === '/charity') return 'charity';
    if (pathname.startsWith('/profile/')) return 'profile';

    const clubRouteMatch = pathname.match(clubRoutePattern);
    if (clubRouteMatch) {
        const currentClubId = Number(clubRouteMatch[1]);
        return myClubId != null && currentClubId === myClubId ? 'my-club' : 'clubs';
    }

    return null;
};
