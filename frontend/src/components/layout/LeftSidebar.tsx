import { showSquadNavigation } from './organizationNavigation';
import { MediaImage } from "../ui/MediaImage";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ShortcutEmblem, type ShortcutKind } from './ShortcutEmblem';
import { resolveMediaUrl } from "../../utils/resolveMediaUrl";
import { hasNavigationCapability, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { ConnectionsDialog } from "../profile/ConnectionsDialog";
import { type ManagedClubLink } from "./WorkspaceShortcuts";
import { WorkspaceAccess } from './FootballActivity';
import { DolaLink } from '../../features/dola/DolaProvider';

interface LeftSidebarProps {
  managedClubs?: ManagedClubLink[];
  user: {
    id?: number;
    username?: string;
    role?: string;
    navigationCapabilities?: NavigationCapabilities;
    fullName?: string;
    name?: string;
    avatarUrl?: string;
  } | null;
}

const initialsFrom = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "GK";

export const LeftSidebar = ({ user }: LeftSidebarProps) => {
  const [showFollowing, setShowFollowing] = useState(false);
  const capabilities = user?.navigationCapabilities;
  const primary: { to: string; label: string; description: string; icon: ShortcutKind }[] = [
    ...(hasNavigationCapability(capabilities, 'parent.hub') ? [{ to: '/parent', label: 'Parent Hub', description: 'Your children and their football', icon: 'family' as const }] : []),
    ...(showSquadNavigation(capabilities) ? [{ to: '/squads', label: 'My squads', description: 'Coach updates, families and chat', icon: 'squads' as const }] : []),
    ...(hasNavigationCapability(capabilities, 'referee.workspace') ? [{ to: '/referees/me', label: 'Referee workspace', description: 'Your appointments and availability', icon: 'referee' as const }] : []),
    ...(hasNavigationCapability(capabilities, 'agent.hub') ? [{ to: '/agent', label: 'Agent Hub', description: 'Your players and opportunities', icon: 'agent' as const }] : []),
    { to: '/calendar?scope=personal', label: 'My Schedule', description: 'Your personal calendar', icon: 'schedule' },
  ];
  const shortcut = (item: typeof primary[number]) => <Link key={item.to} to={item.to} className="feed-side-link home-social-link">
    <ShortcutEmblem kind={item.icon} /><span className="home-shortcut-copy"><span className="feed-side-link__title">{item.label}</span><span className="home-shortcut-description">{item.description}</span></span>
  </Link>;
  const avatarUrl = resolveMediaUrl(user?.avatarUrl);
  const displayName =
    user?.fullName || user?.name || user?.username || "Your profile";

  return (
    <aside className="home-side-rail home-side-rail--left hidden lg:block">
      <nav
        aria-label="Home shortcuts"
        className="home-side-scroll space-y-2 py-2"
      >
        <Link
          to={user?.id ? `/profile/${user.id}` : "/login"}
          className="feed-side-link home-social-link home-profile-shortcut"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="feed-side-link__visual feed-side-link__visual--avatar h-10 w-10 ring-1 ring-[var(--feed-card-border)]">
              {avatarUrl ? (
                <MediaImage
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initialsFrom(displayName)
              )}
            </span>
            <span className="min-w-0">
              <span className="feed-side-link__title text-sm font-semibold text-[var(--feed-text-primary)]">
                {displayName}
              </span>
              <span className="block truncate text-[10px] text-[var(--feed-text-muted)]">
                View your profile
              </span>
            </span>
          </span>
        </Link>

        <WorkspaceAccess key={user?.id} userId={user?.id} caps={capabilities} className="feed-side-link home-social-link workspace-shortcut w-full" />
        <DolaLink className="feed-side-link home-social-link home-dola-shortcut">
          <ShortcutEmblem kind="dola" /><span className="home-shortcut-copy"><span className="feed-side-link__title">Agent Dola</span><span className="home-shortcut-description">Your football assistant</span></span>
        </DolaLink>
        <div className="home-shortcut-group" role="group" aria-label="Your football">
          <h2 className="home-shortcut-heading">Your football</h2>
          {primary.map(shortcut)}
        </div>
        <div className="home-shortcut-group" role="group" aria-label="Explore">
          <h2 className="home-shortcut-heading">Explore</h2>
          {shortcut({ to: '/map', label: 'Map', description: 'Find football near you', icon: 'map' })}
          <button type="button" onClick={() => setShowFollowing(true)} className="feed-side-link home-social-link w-full text-left">
            <ShortcutEmblem kind="following" /><span className="home-shortcut-copy"><span className="feed-side-link__title">Following</span><span className="home-shortcut-description">People you keep up with</span></span>
          </button>
          {shortcut({ to: '/clubs/following', label: 'Followed clubs', description: 'Clubs you keep up with', icon: 'clubs' })}
        </div>
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
