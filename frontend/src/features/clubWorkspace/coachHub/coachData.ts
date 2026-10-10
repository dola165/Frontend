import type { Bootstrap } from '../../clubOperations/api';
import type { RoleView, RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { focusableViews } from '../../clubOperations/workspaceStructure';

/** Squads this person is personally responsible for: those named in their squad-level responsibilities. */
export function mySquadIds(roles: RolesWorkspace) {
    return [...new Set(focusableViews(roles.views).filter(view => !view.clubWide).flatMap(view => view.squadIds))];
}

/** Whether the person may read a tool's records for one squad. Server access stays authoritative. */
export function canReadSquad(boot: Bootstrap | null, module: string, squad: number) {
    return Boolean(boot?.settings.enabled_modules.includes(module) && boot.modules.some(m => m.id === module && (m.globalRead || m.readSquads?.includes(squad))));
}

export function personName(roles: RolesWorkspace, boot: Bootstrap | null, id: number | null) {
    if (id === null) return null;
    return roles.people.find(p => p.id === id)?.name ?? boot?.people.find(p => p.id === id)?.name ?? null;
}

export const viewScope = (view: RoleView, roles: RolesWorkspace) => view.clubWide
    ? 'Whole club'
    : roles.requestSquads.filter(s => view.squadIds.includes(s.id)).map(s => s.name).join(', ') || 'No squads assigned yet';
