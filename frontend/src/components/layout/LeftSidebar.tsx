import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Building2,
    CalendarDays,
    Compass,
    Map as MapIcon,
    Users
} from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { resolveNavigationKey } from './navigation';
import { fetchMyClubMemberships } from '../../features/clubs/api';
import type { MyClubMembership } from '../../features/clubs/domain';
import { clubRoleLabel } from '../../features/clubs/domain';

interface LeftSidebarProps {
    user: { id?: number; username?: string; role?: string; fullName?: string; name?: string; avatarUrl?: string } | null;
    myClubId: number | null;
}

interface SidebarNavItem {
    id: string;
    path: string;
    label: string;
    icon: typeof MapIcon;
}

const mainNavItems: SidebarNavItem[] = [
    { id: 'map', path: '/map', label: 'Maps', icon: MapIcon },
    { id: 'calendar', path: '/calendar', label: 'Schedule', icon: CalendarDays }
];

const initialsFrom = (value: string) =>
    value
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'GK';

export const LeftSidebar = ({ user, myClubId }: LeftSidebarProps) => {
    const location = useLocation();
    const activeKey = resolveNavigationKey(location.pathname, myClubId);
    const showFeedSwitcher = location.pathname === '/feed';
    const activeFeedView = new URLSearchParams(location.search).get('view') === 'following' ? 'following' : 'for-you';
    const [memberships, setMemberships] = useState<MyClubMembership[]>([]);
    const [loaded, setLoaded] = useState(false);
    const avatarUrl = resolveMediaUrl(user?.avatarUrl);

    useEffect(() => {
        let active = true;
        fetchMyClubMemberships()
            .then((data) => { if (active) setMemberships(data); })
            .catch(() => {})
            .finally(() => { if (active) setLoaded(true); });
        return () => { active = false; };
    }, []);

    return (
        <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--app-header-height)+12px)] flex flex-col gap-0.5">
                {/* Essential navigation — Map & Schedule (exceptions kept out of TopNav duplication rule) */}
                <div className="flex flex-col gap-0.5">
                    {mainNavItems.map((item) => {
                        const active = activeKey === item.id;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`feed-side-link group ${active ? 'feed-side-link--active' : ''}`}
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <span className="feed-side-link__visual">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="feed-side-link__title">{item.label}</span>
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Feed switcher */}
                {showFeedSwitcher && (
                    <>
                        <div className="my-2 h-px bg-[var(--feed-divider)]" />
                        <div className="flex flex-col gap-0.5">
                            <Link
                                to="/feed"
                                className={`feed-side-link ${activeFeedView === 'for-you' ? 'feed-side-link--active' : ''}`}
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <span className="feed-side-link__visual">
                                        <Compass className="h-4 w-4" />
                                    </span>
                                    <span className="feed-side-link__title">For You</span>
                                </span>
                            </Link>
                            <Link
                                to="/feed?view=following"
                                className={`feed-side-link ${activeFeedView === 'following' ? 'feed-side-link--active' : ''}`}
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <span className="feed-side-link__visual">
                                        <Users className="h-4 w-4" />
                                    </span>
                                    <span className="feed-side-link__title">Following</span>
                                </span>
                            </Link>
                        </div>
                    </>
                )}

                {/* Profile */}
                <div className="my-2 h-px bg-[var(--feed-divider)]" />
                <div className="flex flex-col gap-0.5">
                    <Link
                        to={user ? `/profile/${user.id}` : '/login'}
                        className={`feed-side-link ${activeKey === 'profile' ? 'feed-side-link--active' : ''}`}
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <span className="feed-side-link__visual feed-side-link__visual--avatar">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                    <span>{initialsFrom(user?.fullName || user?.username || 'You')}</span>
                                )}
                            </span>
                            <span className="feed-side-link__title">{user?.fullName || user?.username || 'Your Profile'}</span>
                        </span>
                    </Link>
                </div>

                {/* My Clubs */}
                {loaded && memberships.length > 0 && (
                    <>
                        <div className="my-2 h-px bg-[var(--feed-divider)]" />
                        <div className="flex flex-col gap-0.5">
                            {memberships.slice(0, 4).map((m) => (
                                <Link
                                    key={m.clubId}
                                    to={`/clubs/${m.clubId}`}
                                    className="feed-side-link"
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <span className="feed-side-link__visual">
                                            <Building2 className="h-4 w-4" />
                                        </span>
                                        <span className="feed-side-link__title">{m.clubName}</span>
                                    </span>
                                    <span className="text-[10px] font-medium text-[var(--feed-text-muted)]">
                                        {clubRoleLabel(m.role)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
};
