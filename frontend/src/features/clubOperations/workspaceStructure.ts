import { useCallback, useMemo, useState } from 'react';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import type { RoleView } from './useWorkspaceRoles';
import { operationDescriptions, operationModule, operationTabs } from './workspaceNavigation';

/** Opens a workspace tool, optionally with context such as a squad, session or record. */
export type OpenWorkspace = (tab: WorkspaceTab, context?: Record<string, string>) => void;

// A tool has one home. Pins are personal links, never a permission source.
export const workspaceAreas = [
  { id: 'football', label: 'Football', description: 'Squads, training and player development.', tabs: ['squads', 'attendance', 'development', 'restrictions', 'preparation', 'player-cards'] },
  { id: 'people', label: 'People', description: 'Players, staff, permissions and care.', tabs: ['players', 'personnel', 'staff-duties', 'role-requests', 'credentials', 'specialists', 'guardians', 'registration', 'education', 'medical', 'welfare', 'departures', 'invites'] },
  { id: 'operations', label: 'Club operations', description: 'Venues, travel and equipment.', tabs: ['facilities', 'travel', 'equipment'] },
  { id: 'recruitment', label: 'Recruitment', description: 'Joining, applications, tryouts and agent approaches.', tabs: ['admissions', 'applications', 'tryouts', 'club-approaches', 'jobs'] },
  { id: 'business', label: 'Club business', description: 'Programmes and fees, finance, the club shop and campaigns.', tabs: ['programmes', 'finance', 'store', 'campaigns'] },
  { id: 'settings', label: 'Settings', description: 'Club setup, the public profile and ownership.', tabs: ['settings', 'workspace-settings', 'roles'] },
] as const;
export const areaFor = (tab: string) => workspaceAreas.find(area => (area.tabs as readonly string[]).includes(tab));

/** Destinations that live at the top of the rail rather than inside an area. */
export const personalTabs = new Set<WorkspaceTab>(['overview', 'coach-hub', 'inbox', 'actions', 'tools']);

export function toolDescription(tab: Pick<TabItem, 'id' | 'label'>) {
  return operationDescriptions[operationModule(tab.id) ?? ''] ?? ({
    'coach-hub': 'Your squads, sessions, players and tasks in one place.', squads: 'Rosters, training sessions and squad responsibilities.',
    players: 'Manage club affiliations, trialists and player status.',
    'role-requests': 'Assign staff roles and review requested changes.', personnel: 'Coaches, specialists, referees and management access.',
    roles: 'Manage ownership and club membership.', settings: 'Joining policy, public profile, activities and imports.',
    programmes: 'Training programmes, prices and fees shown on the club profile.',
    overview: 'Club totals, decisions and the coming week.', inbox: 'Club notifications and requests.',
    'club-approaches': 'Review player-approved approaches from agents.', jobs: 'Post openings and review applicants.',
    admissions: 'Arrange introductions, agree a place and complete group enrollment.', applications: 'Review club and staff applications.', tryouts: 'Organise tryouts and review players.',
    store: 'Manage your public merchandise catalogue.', campaigns: 'Manage fundraising and sponsorship campaigns.',
    'player-cards': 'Edit football profiles and player information.', invites: 'Invite people to join the club.', tools: 'Every tool your club role allows.',
  } as Partial<Record<WorkspaceTab, string>>)[tab.id] ?? tab.label;
}

/** Old personal tabs now live in Coach Hub; their links keep working. */
const legacyTabs: Partial<Record<WorkspaceTab, { tab: WorkspaceTab; hub?: string }>> = {
  'my-day': { tab: 'coach-hub' }, 'my-squads': { tab: 'coach-hub' },
  'my-people': { tab: 'coach-hub', hub: 'players' }, 'my-role': { tab: 'coach-hub', hub: 'responsibilities' },
};
export const legacyTabTarget = (tab: WorkspaceTab | null) => (tab ? legacyTabs[tab] ?? null : null);
export function canonicalWorkspaceTab(tab: WorkspaceTab | null): WorkspaceTab | null {
  return tab ? legacyTabs[tab]?.tab ?? tab : null;
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
  return { available, selected, selectedViews, tabs, toggle };
}
export type ResponsibilityFocus = ReturnType<typeof useResponsibilityFocus>;
