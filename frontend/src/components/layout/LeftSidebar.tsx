import { MediaImage } from '../ui/MediaImage';
import { Link } from 'react-router-dom';
import { useState, type CSSProperties } from 'react';
import { CalendarDays, MapPinned, Shield, UsersRound } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { ConnectionsDialog } from '../profile/ConnectionsDialog';
import { WorkspaceShortcuts, type ManagedClubLink } from './WorkspaceShortcuts';

interface LeftSidebarProps {
    managedClubs?: ManagedClubLink[];
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

export const LeftSidebar = ({ user, managedClubs = [] }: LeftSidebarProps) => {
    const [showFollowing, setShowFollowing] = useState(false);
    const links = [
        { to: '/clubs/following', label: 'Followed clubs', description: 'Clubs you keep up with', icon: Shield, colour: 'var(--social-clubs)' },
        { to: '/map', label: 'Map', description: 'Find football near you', icon: MapPinned, colour: 'var(--social-map)' },
        { to: '/calendar?scope=personal', label: 'My Schedule', description: 'Your personal calendar', icon: CalendarDays, colour: 'var(--social-schedule)' },
    ];
    const avatarUrl = resolveMediaUrl(user?.avatarUrl);
    const displayName = user?.fullName || user?.name || user?.username || 'Your profile';

    return (
        <aside className="hidden lg:block">
            <nav aria-label="Home shortcuts" className="sticky top-[calc(var(--app-header-height)+16px)] space-y-2 py-2">
                <Link
                    to={user?.id ? `/profile/${user.id}` : '/login'}
                    className="feed-side-link home-social-link home-profile-shortcut"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="feed-side-link__visual feed-side-link__visual--avatar h-10 w-10 ring-1 ring-[var(--feed-card-border)]">
                            {avatarUrl ? <MediaImage src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsFrom(displayName)}
                        </span>
                        <span className="min-w-0">
                            <span className="feed-side-link__title text-sm font-semibold text-[var(--feed-text-primary)]">{displayName}</span>
                            <span className="block truncate text-[10px] text-[var(--feed-text-muted)]">View your profile</span>
                        </span>
                    </span>
                </Link>

                <WorkspaceShortcuts clubs={managedClubs} />
                <button
                    type="button"
                    onClick={() => setShowFollowing(true)}
                    className="feed-side-link home-social-link w-full text-left"
                    style={{ '--shortcut-accent': 'var(--social-people)' } as CSSProperties}
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="home-shortcut-icon">
                            <UsersRound className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="feed-side-link__title text-sm font-semibold text-[var(--feed-text-primary)]">Following</span>
                            <span className="block truncate text-[10px] text-[var(--feed-text-muted)]">People you keep up with</span>
                        </span>
                    </span>
                </button>

                {links.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link key={item.to} to={item.to} className="feed-side-link home-social-link" style={{ '--shortcut-accent': item.colour } as CSSProperties}>
                            <span className="flex min-w-0 items-center gap-3">
                                <span className="home-shortcut-icon">
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
            {showFollowing && user?.id && (
                <ConnectionsDialog
                    userId={user.id}
                    kind="following"
                    showFollowingStatus
                    onClose={() => setShowFollowing(false)}
                />
            )}
        </aside>
    );
};
