import { Link, useLocation } from 'react-router-dom';
import {
    BellDot,
    CalendarDays,
    ChevronRight,
    ClipboardList,
    Compass,
    Megaphone,
    Settings,
    ShieldCheck,
    Trophy,
    Users
} from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { resolveNavigationKey } from './navigation';

interface LeftSidebarProps {
    user: { id?: number; username?: string; role?: string; fullName?: string; name?: string; avatarUrl?: string } | null;
    myClubId: number | null;
}

interface SidebarLinkItem {
    id: string;
    path: string;
    label: string;
    subtitle: string;
    icon: typeof Settings;
    avatar?: boolean;
}

interface SidebarPlaceholderItem {
    id: string;
    label: string;
    subtitle: string;
    icon: typeof Megaphone;
}

const buildLinks = (user: LeftSidebarProps['user']) => {
    const displayName = user?.fullName || user?.name || user?.username || 'Your Profile';
    const items: SidebarLinkItem[] = [
        { id: 'profile', path: user ? `/profile/${user.id}` : '/login', label: displayName, subtitle: 'Public profile', icon: Settings, avatar: true },
        { id: 'account', path: user ? '/account' : '/login', label: 'Account Center', subtitle: 'Manage', icon: Settings },
        { id: 'tournament-setup', path: '/tournaments/setup', label: 'Tournament Setup', subtitle: 'Organizer Flow', icon: Trophy },
        { id: 'calendar', path: '/calendar', label: 'My Schedule', subtitle: 'Personal', icon: CalendarDays }
    ];

    if (user?.role === 'SYSTEM_ADMIN') {
        items.unshift({ id: 'admin', path: '/admin', label: 'Admin', subtitle: 'Control', icon: ShieldCheck });
    }

    return items;
};

const placeholderItems: SidebarPlaceholderItem[] = [
    { id: 'announcements', icon: Megaphone, label: 'Announcements', subtitle: 'Soon' },
    { id: 'surveys', icon: ClipboardList, label: 'Surveys', subtitle: 'Soon' }
];

const feedSwitcherItems: SidebarLinkItem[] = [
    { id: 'feed-for-you', path: '/feed', label: 'For You', subtitle: 'Discovery', icon: Compass },
    { id: 'feed-following', path: '/feed?view=following', label: 'Following', subtitle: 'Chosen Accounts', icon: Users }
];

const initialsFrom = (value: string) =>
    value
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'GK';

const SidebarLinkRow = ({
    item,
    active,
    avatarUrl
}: {
    item: SidebarLinkItem;
    active: boolean;
    avatarUrl?: string;
}) => {
    const Icon = item.icon;
    const avatarImage = item.avatar ? resolveMediaUrl(avatarUrl) : undefined;
    const initials = initialsFrom(item.label);

    return (
        <Link to={item.path} className={`feed-side-link group ${active ? 'feed-side-link--active' : ''}`}>
            <span className="flex min-w-0 items-center gap-3">
                <span className={`feed-side-link__visual ${item.avatar ? 'feed-side-link__visual--avatar' : ''}`}>
                    {item.avatar ? (
                        avatarImage ? <img src={avatarImage} alt={item.label} className="h-full w-full rounded-[inherit] object-cover" /> : <span>{initials}</span>
                    ) : (
                        <Icon className="h-4 w-4" />
                    )}
                </span>

                <span className="min-w-0">
                    <span className="feed-side-link__title">{item.label}</span>
                    <span className="feed-side-link__subtitle">{item.subtitle}</span>
                </span>
            </span>

            <ChevronRight className="feed-side-link__arrow h-4 w-4 shrink-0" />
        </Link>
    );
};

const PlaceholderRow = ({ item }: { item: SidebarPlaceholderItem }) => {
    const Icon = item.icon;

    return (
        <div className="feed-side-link group">
            <span className="flex min-w-0 items-center gap-3">
                <span className="feed-side-link__visual">
                    <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0">
                    <span className="feed-side-link__title">{item.label}</span>
                    <span className="feed-side-link__subtitle">{item.subtitle}</span>
                </span>
            </span>

            <BellDot className="feed-side-link__arrow h-4 w-4 shrink-0" />
        </div>
    );
};

export const LeftSidebar = ({ user, myClubId }: LeftSidebarProps) => {
    const location = useLocation();
    const items = buildLinks(user);
    const activeKey = resolveNavigationKey(location.pathname, myClubId);
    const showFeedSwitcher = location.pathname === '/feed';
    const activeFeedView = new URLSearchParams(location.search).get('view') === 'following' ? 'following' : 'for-you';

    return (
        <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--app-header-height)+20px)] flex flex-col gap-5">
                {showFeedSwitcher ? (
                    <section className="rounded-[18px] border border-subtle bg-surface px-3 py-3 shadow-panel">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Main Feed</p>
                        <p className="mt-1 text-sm font-black uppercase tracking-[0.14em] text-primary">Switch View</p>

                        <div className="mt-3 flex flex-col gap-2">
                            {feedSwitcherItems.map((item) => (
                                <SidebarLinkRow
                                    key={item.id}
                                    item={item}
                                    active={activeFeedView === (item.id === 'feed-following' ? 'following' : 'for-you')}
                                />
                            ))}
                        </div>
                    </section>
                ) : null}

                <div className="flex flex-col gap-2">
                    {items.map((item) => (
                        <SidebarLinkRow key={item.id} item={item} active={activeKey === item.id} avatarUrl={user?.avatarUrl} />
                    ))}
                </div>

                <div className="h-px bg-[color:var(--feed-side-divider)]" />

                <div className="flex flex-col gap-2">
                    {placeholderItems.map((item) => (
                        <PlaceholderRow key={item.id} item={item} />
                    ))}
                </div>
            </div>
        </aside>
    );
};
