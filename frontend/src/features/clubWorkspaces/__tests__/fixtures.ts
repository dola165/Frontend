import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { JobWorkspace, JobWorkspaceManifest, ModuleScope } from '../types';

export const moduleScope = (module: string, scope: Partial<ModuleScope> = {}): ModuleScope => ({ module, globalRead: false, globalWrite: false, readSquadIds: [2], writeSquadIds: [2], ...scope });
export function desk(key: JobWorkspace['key'] = 'money', scopes = [moduleScope('FINANCE')]): JobWorkspace {
    return { key, title: key === 'money' ? 'Money' : key, layout: 'work', maturity: 'prototype', jobTitles: ['Current job'],
        modules: scopes.map(s => s.module), moduleScopes: scopes, squadIds: [...new Set(scopes.flatMap(s => s.readSquadIds))], clubWide: scopes.length > 0 && scopes.every(s => s.globalRead), path: `/clubs/7/work/${key}` };
}
export const manifest = (workspaces = [desk()]): JobWorkspaceManifest => ({ clubId: 7, actorId: 9, clubName: 'FC Dinamo Tbilisi Academy', workspaces });
export const roles = (): RolesWorkspace => ({ actorId: 9, leadership: false, catalog: [], views: [], current: { id: 'all', label: 'All responsibilities', modules: [], squadIds: [2, 3], clubWide: false, appointmentId: null, revision: null },
    requestSquads: [], squads: [], sessions: [], requests: [], invitations: [], people: [{ id: 4, name: 'Current player', squad_id: 2, squad_name: 'U14' }, { id: 5, name: 'Other player', squad_id: 3, squad_name: 'U16' }] });
export const bootstrap = (): Bootstrap => ({ clubId: 7, actorId: 9, clubName: 'FC Dinamo Tbilisi Academy', leadership: false, definitions: [], specialisations: [], permissions: [],
    settings: { setting: 'CLUB', playing_level: 'YOUTH', enabled_modules: ['FINANCE', 'REGISTRATION', 'EQUIPMENT', 'TRAVEL', 'FACILITIES', 'MEDICAL'], revision: 0 },
    modules: ['FINANCE', 'REGISTRATION', 'EQUIPMENT', 'TRAVEL', 'FACILITIES', 'MEDICAL', 'CREDENTIALS'].map(id => ({ id, globalRead: true, globalWrite: true, writable: true, readSquads: [2, 3], writeSquads: [2, 3] })),
    squads: [{ id: 2, name: 'U14' }, { id: 3, name: 'U16' }], people: [{ id: 4, name: 'Current player' }, { id: 5, name: 'Other player' }], staff: [], venues: [], guardians: [], events: [],
    sessions: [{ id: 6, title: 'Current training', starts_at: '2026-10-31T10:00:00Z', squad_id: 2, squad_name: 'U14' }, { id: 8, title: 'Other training', starts_at: '2026-10-31T11:00:00Z', squad_id: 3, squad_name: 'U16' }], links: [] });
