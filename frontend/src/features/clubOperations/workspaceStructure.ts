import type { WorkspaceTab } from '../../components/workspace/types';
import type { RoleView } from './useWorkspaceRoles';

/** Opens a club tool, optionally with context such as a squad, session or record. */
export type OpenWorkspace = (tab: WorkspaceTab, context?: Record<string, string>) => void;

/**
 * Coach Hub and the older personal tabs left the club workspace for My squads, the coach's own workspace.
 * Their links keep working: each opens the matching My squads page.
 */
const personalPages: Record<string, string> = { 'coach-hub': '', 'my-day': '', 'my-squads': '', 'my-people': 'players', 'my-role': 'coaches' };
export function personalWorkspaceTarget(tab: string | null, hub: string | null) {
  if (!tab || personalPages[tab] === undefined) return null;
  const page = tab === 'coach-hub' ? ({ players: 'players', responsibilities: 'coaches' } as Record<string, string>)[hub ?? ''] ?? '' : personalPages[tab];
  return `/my-squads${page ? `?tab=${page}` : ''}`;
}

/** Approved responsibilities a person can work in (not the "all my work" or plain membership views). */
export const focusableViews = (views: RoleView[]) => views.filter(view => !['all', 'member'].includes(view.id));
