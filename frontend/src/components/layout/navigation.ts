import {
  Bell,
  ShoppingBag,
  HeartHandshake,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Home,
  MessageSquare,
  MapPinned,
  LandPlot,
  Shield,
  UsersRound,
  Goal,
  type LucideIcon,
} from "lucide-react";

export type NavigationKey =
  | "home"
  | "map"
  | "clubs"
  | "my-club"
  | "calendar"
  | "messages"
  | "notifications"
  | "people"
  | "clubs-following"
  | "store"
  | "stadiums"
  | "matches"
  | "match-exchange"
  | "referees"
  | "campaigns"
  | "jobs"
  | "tournaments"
  | "profile"
  | "account"
  | "parent-hub"
  | "squads"
  | "commerce-demo"
  | "tournament-setup"
  | "marketplace"
  | "needs"
  | "admin";

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
  {
    id: "home",
    path: "/home",
    label: "Home",
    translationKey: "nav.feed",
    icon: Home,
    authRequired: true,
  },
  {
    id: "map",
    path: "/map",
    label: "Map",
    translationKey: "nav.map",
    icon: MapPinned,
    authRequired: true,
  },
  {
    id: "clubs",
    path: "/clubs",
    label: "Clubs",
    translationKey: "nav.clubs",
    icon: Shield,
    authRequired: false,
  },
  {
    id: "my-club",
    path: "/my-club",
    label: "My Club",
    translationKey: "nav.myClub",
    icon: Building2,
    authRequired: true,
  },
  {
    id: "matches",
    path: "/matches",
    label: "Matches & Competitions",
    translationKey: "matches.navigation",
    icon: Goal,
    authRequired: false,
  },
  {
    id: "calendar",
    path: "/calendar",
    label: "Schedule",
    translationKey: "nav.schedule",
    icon: CalendarDays,
    authRequired: true,
  },
];

export const secondaryProductNavigation: ProductNavigationItem[] = [
  {
    id: "referees",
    path: "/referees/me",
    label: "Referee workspace",
    translationKey: "nav.referees",
    icon: UsersRound,
    authRequired: true,
  },
  {
    id: "store",
    path: "/store",
    label: "Store",
    translationKey: "nav.store",
    icon: ShoppingBag,
    authRequired: false,
  },
  {
    id: "stadiums",
    path: "/stadiums",
    label: "Stadiums",
    translationKey: "nav.stadiums",
    icon: LandPlot,
    authRequired: false,
  },
  {
    id: "campaigns",
    path: "/campaigns",
    label: "Fundraising & campaigns",
    translationKey: "nav.campaigns",
    icon: HeartHandshake,
    authRequired: false,
  },
  {
    id: "messages",
    path: "/messages",
    label: "Messages",
    translationKey: "nav.messages",
    icon: MessageSquare,
    authRequired: true,
  },
  {
    id: "notifications",
    path: "/notifications",
    label: "Notifications",
    translationKey: "nav.notifications",
    icon: Bell,
    authRequired: true,
  },
  {
    id: "people",
    path: "/people",
    label: "People",
    translationKey: "nav.people",
    icon: UsersRound,
    authRequired: true,
  },
  {
    id: "clubs-following",
    path: "/clubs/following",
    label: "Followed clubs",
    translationKey: "nav.followedClubs",
    icon: Shield,
    authRequired: true,
  },
  { id: 'tryouts', path: '/tryouts', label: 'Tryouts', translationKey: 'experience.navigation.tryouts', icon: Goal, authRequired: false },
  { id: 'events', path: '/events', label: 'Events', translationKey: 'experience.navigation.events', icon: CalendarDays, authRequired: false },
  {
    id: "jobs",
    path: "/jobs",
    label: "Roles",
    translationKey: "nav.jobs",
    icon: BriefcaseBusiness,
    authRequired: false,
  },
  {
    id: "parent-hub",
    path: "/parent",
    label: "Parent Hub",
    translationKey: "nav.parentHub",
    icon: UsersRound,
    authRequired: true,
  },
  {
    id: "squads",
    path: "/squads",
    label: "My squads",
    translationKey: "nav.mySquads",
    icon: UsersRound,
    authRequired: true,
  },
];

const clubRoutePattern = /^\/clubs\/(\d+)(?:\/|$)/;

export const resolveNavigationKey = (
  pathname: string,
  myClubId: number | null,
  context: { search?: string; clubIds?: number[]; venueIds?: number[] } = {},
) => {
  if (pathname === '/tryouts' || /^\/tryouts\/\d+\/?$/.test(pathname)) return 'tryouts';
  if (pathname === '/events') return 'events';
  if (pathname === '/requests') return 'requests';
  if (pathname === '/agent' || pathname.startsWith('/agent/')) return 'agent-hub';
  if (pathname === "/matches") return "matches";
  if (pathname.startsWith("/match-exchange") || pathname === "/match-history") return "matches";
  if (pathname.startsWith("/referees")) return "referees";
  if (pathname === "/home" || pathname === "/feed") return "home";
  if (pathname === "/map") return "map";
  if (pathname === "/clubs") return "clubs";
  if (pathname === "/clubs/following") return "clubs-following";
  if (pathname === '/my-organizations') return new URLSearchParams(context.search).get('kind') === 'VENUE' ? 'my-venues' : 'my-organizations';
  if (/^\/stadiums\/\d+\/manage$/.test(pathname)) return 'my-venues';
  if (pathname.startsWith('/organizations/')) {
    const id = Number(pathname.match(/^\/organizations\/(\d+)(?:\/|$)/)?.[1]);
    return context.venueIds?.includes(id) ? 'my-venues' : 'my-organizations';
  }
  if (pathname === "/my-club") return "my-club";
  if (pathname === "/calendar") return "calendar";
  if (pathname === "/messages") return "messages";
  if (pathname === "/notifications") return "notifications";
  if (pathname === "/people") return "people";
  if (pathname === '/account' || pathname.startsWith('/account/') || pathname === '/reports') return 'account';
  if (pathname === '/parent' || pathname.startsWith('/parent/')) return 'parent-hub';
  if (pathname === "/squads" || pathname.startsWith("/squads/"))
    return "squads";
  if (pathname === "/demo/commerce") return "commerce-demo";
  if (pathname === "/tournaments/setup") return "matches";
  if (pathname === "/tournaments" || /^\/tournaments\/\d+/.test(pathname))
    return "matches";
  if (pathname === "/admin") return "admin";
  if (pathname === "/marketplace") return "marketplace";
  if (pathname === "/needs") return "needs";
  if (pathname === "/store" || pathname.startsWith("/store/")) return "store";
  if (pathname === "/stadiums" || pathname.startsWith("/stadiums/"))
    return "stadiums";
  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/"))
    return "campaigns";
  if (pathname === "/jobs" || pathname.startsWith("/jobs/") || pathname === "/roles" || pathname.startsWith("/roles/")) return "jobs";
  if (pathname.startsWith("/profile/")) return "profile";

  const clubRouteMatch = pathname.match(clubRoutePattern);
  if (clubRouteMatch) {
    const currentClubId = Number(clubRouteMatch[1]);
    return currentClubId === myClubId || context.clubIds?.includes(currentClubId) ? 'my-club' : 'clubs';
  }

  return null;
};

/** Workspace links have dynamic IDs; match their actual path and required query context. */
export function isNavigationDestinationActive(item: { id: string; path: string }, pathname: string, search: string, activeKey: string | null) {
  if (item.id === activeKey) return true;
  if (!item.id.includes(':') && !item.id.startsWith('workspace-')) return false;
  const [path, query] = item.path.split('?');
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  const current = new URLSearchParams(search);
  return [...new URLSearchParams(query)].every(([key, value]) => current.get(key) === value);
}
