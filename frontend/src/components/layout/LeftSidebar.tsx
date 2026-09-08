import { Link } from 'react-router-dom';
import { MapPinned, Shield, UsersRound } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface LeftSidebarProps {
    user: { id?: number; username?: string; role?: string; fullName?: string; name?: string; avatarUrl?: string } | null;
}

const initialsFrom = (value: string) =>
    value
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'GK';

const socialLinks = [
    {
        to: '/people',
        label: 'Following',
        description: 'People you keep up with',
        icon: UsersRound,
        iconClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300'
    },
    {
        to: '/clubs/following',
        label: 'Followed clubs',
        description: 'Clubs you keep up with',
        icon: Shield,
        iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
    },
    {
        to: '/map',
        label: 'Map',
        description: 'Find football near you',
        icon: MapPinned,
        iconClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
    }
] as const;

export const LeftSidebar = ({ user }: LeftSidebarProps) => {
    const avatarUrl = resolveMediaUrl(user?.avatarUrl);
    const displayName = user?.fullName || user?.name || user?.username || 'Your profile';

    return (
        <aside className="hidden lg:block">
            <nav aria-label="Home shortcuts" className="sticky top-[calc(var(--app-header-height)+16px)] space-y-1">
                <Link
                    to={user?.id ? `/profile/${user.id}` : '/login'}
                    className="feed-side-link home-social-link"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="feed-side-link__visual feed-side-link__visual--avatar h-10 w-10 ring-1 ring-[var(--feed-card-border)]">
                            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsFrom(displayName)}
                        </span>
                        <span className="min-w-0">
                            <span className="feed-side-link__title text-sm font-semibold text-[var(--feed-text-primary)]">{displayName}</span>
                            <span className="block truncate text-[10px] text-[var(--feed-text-muted)]">View your profile</span>
                        </span>
                    </span>
                </Link>

                {socialLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link key={item.to} to={item.to} className="feed-side-link home-social-link">
                            <span className="flex min-w-0 items-center gap-3">
                                <span className={`feed-side-link__visual h-10 w-10 ${item.iconClass}`}>
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="feed-side-link__title text-sm font-semibold text-[var(--feed-text-primary)]">{item.label}</span>
                                    <span className="block truncate text-[10px] text-[var(--feed-text-muted)]">{item.description}</span>
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
};
