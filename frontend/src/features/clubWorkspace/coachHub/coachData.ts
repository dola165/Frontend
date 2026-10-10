import type { Bootstrap } from '../../clubOperations/api';
import type { RoleView, RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { focusableViews } from '../../clubOperations/workspaceStructure';

/** Squads named in some squad-level responsibilities: by default all of a person's own, or the ones switched on in Responsibilities. */
export function mySquadIds(views: RoleView[]) {
    return [...new Set(focusableViews(views).filter(view => !view.clubWide).flatMap(view => view.squadIds))];
}

export function personName(roles: RolesWorkspace, boot: Bootstrap | null, id: number | null) {
    if (id === null) return null;
    return roles.people.find(p => p.id === id)?.name ?? boot?.people.find(p => p.id === id)?.name ?? null;
}

/** Where a responsibility applies: the whole club, its squads, or nowhere yet (as `null`). */
export const viewSquads = (view: RoleView, roles: RolesWorkspace) => view.clubWide
    ? 'club' as const
    : roles.requestSquads.filter(s => view.squadIds.includes(s.id)).map(s => s.name).join(', ') || null;
