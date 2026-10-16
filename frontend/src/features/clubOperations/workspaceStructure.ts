import { useCallback, useMemo, useState } from 'react';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import type { RoleView } from './useWorkspaceRoles';
import { operationDescriptions, operationModule, operationTabs } from './workspaceNavigation';

/** Opens a workspace tool, optionally with context such as a squad, session or record. */
export type OpenWorkspace = (tab: WorkspaceTab, context?: Record<string, string>) => void;

// A tool has one home. Pins are personal links, never a permission source.
// Every tab answers "who or what is this about" (the owner, 14 October). Attendance stays on paper and match
// preparation belongs on the match, so neither has a tab; their records still answer their old addresses.
export const workspaceAreas = [
  { id: 'squads', label: 'Squads', description: 'Your squads, and what is true about their players.', tabs: ['squads', 'player-cards', 'restrictions', 'development'] },
  { id: 'players', label: 'Players', description: 'The club’s register of players, and what the club keeps about each one.', tabs: ['players', 'guardians', 'registration', 'education', 'medical', 'welfare', 'departures'] },
  { id: 'staff', label: 'Staff', description: 'The people who work for the club: jobs, access, credentials, hiring.', tabs: ['personnel', 'staff-duties', 'role-requests', 'credentials', 'specialists', 'jobs'] },
  { id: 'joining', label: 'Joining', description: 'Players coming in: first visits, applications, tryouts, agents, invitations.', tabs: ['admissions', 'applications', 'tryouts', 'club-approaches', 'invites'] },
  { id: 'club', label: 'Club', description: 'Grounds, travel, kit, fees, money, the store and fundraising.', tabs: ['facilities', 'travel', 'equipment', 'programmes', 'finance', 'store', 'campaigns'] },
  { id: 'settings', label: 'Settings', description: 'Club setup, the public profile and ownership.', tabs: ['settings', 'workspace-settings', 'roles'] },
] as const;
export const areaFor = (tab: string) => workspaceAreas.find(area => (area.tabs as readonly string[]).includes(tab));

/** Destinations that live at the top of the rail rather than inside an area. */
export const personalTabs = new Set<WorkspaceTab>(['overview', 'calendar', 'inbox', 'actions', 'tools']);
/** The tools nobody can hide from their rail: the club's people, squads and settings, and the way in and out. */
export const essentialTabs = new Set<WorkspaceTab>(['overview', 'calendar', 'inbox', 'actions', 'tools', 'squads', 'players', 'personnel', 'settings']);

export function toolDescription(tab: Pick<TabItem, 'id' | 'label'>) {
  return operationDescriptions[operationModule(tab.id) ?? ''] ?? ({
    squads: 'Rosters, training sessions and squad responsibilities.', calendar: 'Every squad’s training, matches and club events together.',
    players: 'Manage club affiliations, trialists and player status.',
    'role-requests': 'Assign staff roles and review requested changes.', personnel: 'Coaches, specialists, referees and management access.',
    roles: 'Manage ownership and club membership.', settings: 'Joining policy, public profile, activities and imports.',
    programmes: 'Training programmes, prices and fees shown on the club profile.',
    overview: 'Club totals, decisions and the coming week.', inbox: 'Decisions and alerts for the club.',
    'club-approaches': 'Review player-approved approaches from agents.', jobs: 'Post openings and review applicants.',
    admissions: 'Arrange introductions, agree a place and complete group enrollment.', applications: 'Review club and staff applications.', tryouts: 'Organise tryouts and review players.',
    store: 'Manage your public merchandise catalogue.', campaigns: 'Manage fundraising and sponsorship campaigns.',
    'player-cards': 'Edit football profiles and player information.', invites: 'Invite people to join the club.', tools: 'Every tool your club role allows.',
  } as Partial<Record<WorkspaceTab, string>>)[tab.id] ?? tab.label;
}

/**
 * Coach Hub and the older personal tabs left the club workspace for My squads, the coach's own workspace.
 * Their links keep working: each opens the matching My squads page.
 */
const personalPages: Partial<Record<WorkspaceTab, string>> = { 'coach-hub': '', 'my-day': '', 'my-squads': '', 'my-people': 'players', 'my-role': 'coaches' };
export function personalWorkspaceTarget(tab: WorkspaceTab | null, hub: string | null) {
  if (!tab || personalPages[tab] === undefined) return null;
  const page = tab === 'coach-hub' ? ({ players: 'players', responsibilities: 'coaches' } as Record<string, string>)[hub ?? ''] ?? '' : personalPages[tab];
  return `/my-squads${page ? `?tab=${page}` : ''}`;
}

// ---------------------------------------------------------------- responsibilities shape the workspace

/** Approved responsibilities a person can work in (not the "all my work" or plain membership views). */
export const focusableViews = (views: RoleView[]) => views.filter(view => !['all', 'member'].includes(view.id));

/** The tools a set of responsibilities uses. Club administration uses every tool. */
export function focusTabs(views: RoleView[]): Set<WorkspaceTab> | 'all' {
  if (!views.length || views.some(view => view.id === 'club')) return 'all';
  const tabs = new Set<WorkspaceTab>();
  for (const view of views) {
    operationTabs.filter(tab => view.modules.includes(tab.module)).forEach(tab => tabs.add(tab.id));
    if (view.squadIds.length) tabs.add('squads');
  }
  return tabs;
}

/**
 * Which approved responsibilities shape this person's navigation: a personal presentation
 * preference on this browser. It never grants or removes access; the server stays authoritative.
 */
export function useResponsibilityFocus(club: number, user: number | null, views: RoleView[]) {
  const key = `gk-ws-focus:v1:${club}:${user ?? 'me'}`;
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
  });
  const available = useMemo(() => focusableViews(views), [views]);
  // Hiding everything would leave an empty rail, so at least one responsibility always stays on.
  const selectedViews = useMemo(() => { const shown = available.filter(view => !hidden.includes(view.id)); return shown.length ? shown : available; }, [available, hidden]);
  const selected = selectedViews.map(view => view.id);
  const tabs = useMemo(() => focusTabs(selectedViews), [selectedViews]);
  const toggle = useCallback((id: string) => setHidden(previous => {
    const next = previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id];
    if (available.every(view => next.includes(view.id))) return previous;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* The choice still applies for this visit. */ }
    return next;
  }), [available, key]);
  const showAll = useCallback(() => {
    setHidden([]);
    try { localStorage.removeItem(key); } catch { /* The choice still applies for this visit. */ }
  }, [key]);
  return { available, selected, selectedViews, tabs, toggle, showAll };
}
export type ResponsibilityFocus = ReturnType<typeof useResponsibilityFocus>;

// ---------------------------------------------------------------- the person's own rail

interface StoredLayout { tabs: string[]; areas: string[] }
const readLayout = (key: string): StoredLayout => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<StoredLayout> | null;
    const list = (items: unknown) => Array.isArray(items) ? items.filter((id): id is string => typeof id === 'string') : [];
    return { tabs: list(value?.tabs), areas: list(value?.areas) };
  } catch { return { tabs: [], areas: [] }; }
};

/**
 * Which tools and areas this person has hidden from their rail, on this browser. Hiding moves a tool under
 * More tools; it never changes access, and the essentials cannot be hidden. (Pins and the responsibility focus
 * are stored the same way; a per-person layout on the server is a backend need, see BACKEND_NEEDS.md.)
 */
export function useWorkspaceLayout(club: number, user: number | null) {
  const key = `gk-ws-layout:v1:${club}:${user ?? 'me'}`;
  const [stored, setStored] = useState<StoredLayout>(() => readLayout(key));
  const save = useCallback((next: StoredLayout) => {
    setStored(next);
    try { if (next.tabs.length || next.areas.length) localStorage.setItem(key, JSON.stringify(next)); else localStorage.removeItem(key); } catch { /* The choice still applies for this visit. */ }
  }, [key]);
  const hiddenTabs = useMemo(() => new Set(stored.tabs.filter(id => !essentialTabs.has(id as WorkspaceTab))), [stored.tabs]);
  const hiddenAreas = useMemo(() => new Set(stored.areas), [stored.areas]);
  const toggleTab = useCallback((id: WorkspaceTab) => {
    if (essentialTabs.has(id)) return;
    save({ ...stored, tabs: stored.tabs.includes(id) ? stored.tabs.filter(item => item !== id) : [...stored.tabs, id] });
  }, [save, stored]);
  const toggleArea = useCallback((id: string) => save({ ...stored, areas: stored.areas.includes(id) ? stored.areas.filter(item => item !== id) : [...stored.areas, id] }), [save, stored]);
  const reset = useCallback(() => save({ tabs: [], areas: [] }), [save]);
  /** A tool is off the rail when it, or its whole area, is hidden; essentials never are. */
  const isHidden = useCallback((id: WorkspaceTab) => !essentialTabs.has(id) && (hiddenTabs.has(id) || Boolean(areaFor(id) && hiddenAreas.has(areaFor(id)!.id))), [hiddenTabs, hiddenAreas]);
  return { hiddenTabs, hiddenAreas, isHidden, toggleTab, toggleArea, reset, customised: hiddenTabs.size > 0 || hiddenAreas.size > 0 };
}
export type WorkspaceLayout = ReturnType<typeof useWorkspaceLayout>;
