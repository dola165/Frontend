import { isKnownMinor } from '../../utils/age';
import { showSquadNavigation } from './organizationNavigation';
import { MediaImage } from "../ui/MediaImage";
import { Link } from "react-router-dom";
import { useState } from "react";
import type { ShortcutKind } from './ShortcutEmblem';
import { BriefcaseBusiness, Flag, Heart, MapPinned, Shield, UserCheck, Users } from 'lucide-react';
import { resolveMediaUrl } from "../../utils/resolveMediaUrl";
import { capabilitiesKnown, hasConfirmedLinks, hasNavigationCapability, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { ConnectionsDialog } from "../profile/ConnectionsDialog";
import { WorkspaceAccess } from './WorkspaceAccess';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { CreateCard } from '../../features/pages/create/CreateLink';
import { hasOwnPage } from '../../features/pages/create/entry';
import { TeamWorkHomeRow } from '../../features/teamWork/TeamWorkHomeRow';
import './side-links.css';

interface LeftSidebarProps {
  embedded?: boolean;
  user: {
    id?: number;
    username?: string;
    navigationCapabilities?: NavigationCapabilities;
    fullName?: string;
    name?: string;
    avatarUrl?: string;
    dob?: string | null;
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

const shortcutIcons = { family: Heart, squads: Users, map: MapPinned, following: UserCheck, clubs: Shield, referee: Flag, agent: BriefcaseBusiness };
const HomeIcon = ({ kind }: { kind: ShortcutKind }) => {
  const Icon = shortcutIcons[kind as keyof typeof shortcutIcons] ?? Shield;
  return <span className={`home-nav-icon home-nav-icon--${kind}`}><Icon size={19} aria-hidden="true" /></span>;
};

export const LeftSidebar = ({ user, embedded = false }: LeftSidebarProps) => {
  const copy = useJourneyCopy();
  const [showFollowing, setShowFollowing] = useState(false);
  const capabilities = user?.navigationCapabilities;
  const primary: { to: string; label: string; description: string; icon: ShortcutKind }[] = [
    ...(hasNavigationCapability(capabilities, 'parent.hub') || hasNavigationCapability(capabilities, 'club.family') ? [{ to: '/parent', label: copy('Parent Hub', 'მშობლის სივრცე'), description: copy('Your children and their football', 'თქვენი შვილები და მათი ფეხბურთი'), icon: 'family' as const }] : []),
    ...(showSquadNavigation(capabilities) ? [{ to: '/squads', label: copy('My squads', 'ჩემი გუნდები'), description: copy('Coach updates, families and chat', 'მწვრთნელის სიახლეები, ოჯახები და ჩატი'), icon: 'squads' as const }] : []),
    ...(hasNavigationCapability(capabilities, 'referee.workspace') ? [{ to: '/referees/me', label: copy('Referee workspace', 'მსაჯის სივრცე'), description: copy('Your appointments and availability', 'დანიშვნები და ხელმისაწვდომობა'), icon: 'referee' as const }] : []),
    ...(hasNavigationCapability(capabilities, 'agent.hub') ? [{ to: '/agent', label: copy('Agent Hub', 'აგენტის სივრცე'), description: copy('Your players and opportunities', 'თქვენი მოთამაშეები და შესაძლებლობები'), icon: 'agent' as const }] : []),
  ];
  const shortcut = (item: typeof primary[number]) => <Link key={item.to} to={item.to} aria-label={`${item.label}. ${item.description}`} className="feed-side-link home-social-link">
    <HomeIcon kind={item.icon} /><span className="home-shortcut-copy"><span className="feed-side-link__title">{item.label}</span><span className="home-shortcut-description">{item.description}</span></span>
  </Link>;
  const avatarUrl = resolveMediaUrl(user?.avatarUrl);
  const displayName =
    user?.fullName || user?.name || user?.username || copy('Your profile', 'თქვენი პროფილი');

  return (
    <aside className={embedded ? 'home-shortcuts-embedded' : 'home-side-rail home-side-rail--left hidden lg:block'}>
      <nav
        aria-label={copy('Home shortcuts', 'მთავარის მალსახმობები')}
        className="home-side-scroll home-sidebar-nav"
      >
        <div className="home-rail-card home-context-card">
        <Link
          to={user?.id ? `/profile/${user.id}` : "/login"}
          aria-label={`${displayName}. ${copy('View your profile', 'პროფილის ნახვა')}`}
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
                {copy('View your profile', 'პროფილის ნახვა')}
              </span>
            </span>
          </span>
        </Link>
        <WorkspaceAccess key={user?.id} userId={user?.id} caps={capabilities} />
        <TeamWorkHomeRow caps={capabilities} />
        </div>
        {/* Someone with no page of their own is offered one; once they have a club or a page, the card goes. */}
        {capabilitiesKnown(capabilities) && !hasOwnPage(capabilities) && !isKnownMinor(user?.dob) && <CreateCard from="home" />}
        {/* My schedule is not here: whoever wants it pins it (owner, 27 October 2026). */}
        {primary.length > 0 && <div className="home-shortcut-group home-rail-card" role="group" aria-label={copy('Your football', 'თქვენი ფეხბურთი')}>
          <h2 className="home-shortcut-heading">{copy('Your football', 'თქვენი ფეხბურთი')}</h2>
          {primary.map(shortcut)}
        </div>}
        {/* Someone nobody has linked to a club, squad or child yet keeps up through follows. */}
        {capabilitiesKnown(capabilities) && !hasConfirmedLinks(capabilities) && <div className="home-shortcut-group home-rail-card" role="group" aria-label={copy('Explore', 'აღმოაჩინეთ')}>
          <h2 className="home-shortcut-heading">{copy('Explore', 'აღმოაჩინეთ')}</h2>
          <button type="button" onClick={() => setShowFollowing(true)} aria-label={copy('Following. People you keep up with', 'გამოწერილი. ადამიანები, ვისაც ადევნებთ თვალს')} className="feed-side-link home-social-link w-full text-left">
            <HomeIcon kind="following" /><span className="home-shortcut-copy"><span className="feed-side-link__title">{copy('Following', 'გამოწერილი')}</span><span className="home-shortcut-description">{copy('People you keep up with', 'ადამიანები, ვისაც ადევნებთ თვალს')}</span></span>
          </button>
          {shortcut({ to: '/clubs/following', label: copy('Followed clubs', 'გამოწერილი კლუბები'), description: copy('Clubs you keep up with', 'კლუბები, რომლებსაც ადევნებთ თვალს'), icon: 'clubs' })}
        </div>}
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
