import type { Bootstrap } from '../clubOperations/api';
import type { RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import type { JobWorkspace } from './types';

/** Intersect two independently server-issued projections, per module. Never use the desk's aggregate clubWide. */
export function scopeBootstrap(boot: Bootstrap, workspace: JobWorkspace, roles: RolesWorkspace, module: string): Bootstrap {
    const modules = boot.modules.map(permission => {
        const scope = workspace.moduleScopes.find(item => item.module === permission.id);
        // Companion actions (such as registration credentials) retain their own canonical endpoint authority.
        if (!scope) return permission;
        const sourceRead = permission.globalRead === true, sourceWrite = permission.globalWrite;
        const globalRead = sourceRead && scope.globalRead, globalWrite = sourceWrite && scope.globalWrite;
        const readSquads = [...new Set([...(permission.readSquads ?? []), ...scope.readSquadIds])].filter(id => (sourceRead || permission.readSquads?.includes(id)) && (scope.globalRead || scope.readSquadIds.includes(id)));
        const writeSquads = [...new Set([...permission.writeSquads, ...scope.writeSquadIds])].filter(id => (sourceWrite || permission.writeSquads.includes(id)) && (scope.globalWrite || scope.writeSquadIds.includes(id)) && (globalRead || readSquads.includes(id)));
        return { ...permission, globalRead, globalWrite, readSquads, writeSquads, writable: permission.writable && (globalWrite || writeSquads.length > 0) };
    });
    const active = modules.find(item => item.id === module);
    const readable = (id: number) => active?.globalRead || active?.readSquads?.includes(id);
    const peopleBySquad = roles.people.filter(person => readable(person.squad_id));
    return {
        ...boot, modules, squads: boot.squads.filter(squad => readable(squad.id)),
        peopleBySquad, people: active?.globalRead ? boot.people : boot.people.filter(person => peopleBySquad.some(item => item.id === person.id)),
        sessions: boot.sessions.filter(session => active?.globalRead || session.squad_id !== undefined && readable(session.squad_id)),
    };
}
