import { Binoculars, Home, Inbox, LayoutGrid, type LucideIcon } from 'lucide-react';
import { operationDescriptions, operationTabs, toolLabel } from '../clubOperations/workspaceNavigation';
import type { JobWorkspace, ModuleScope } from './types';
import type { WorkspaceCopy } from './copy';

const deskModules: Partial<Record<JobWorkspace['key'], readonly string[]>> = {
    registration: ['REGISTRATION', 'GUARDIANS', 'DEPARTURES', 'CREDENTIALS'], money: ['FINANCE'], kit: ['EQUIPMENT'], travel: ['TRAVEL'],
    facilities: ['FACILITIES', 'READINESS'], scouting: ['SCOUTING'],
    'player-file': ['DEVELOPMENT', 'ATTENDANCE', 'AVAILABILITY', 'MEDICAL', 'WELLBEING', 'EDUCATION'], safeguarding: ['WELFARE', 'GUARDIANS'],
    media: ['MATCHES'], matches: ['MATCHES'],
};
export interface DeskTool { id: string; module: string; label: string; description: string; icon: LucideIcon; scope: ModuleScope }
export const canReadScope = (scope: ModuleScope, squad?: number | null) => squad ? scope.globalRead || scope.readSquadIds.includes(squad) : scope.globalRead || scope.readSquadIds.length > 0;
export const privateModules = new Set(['MEDICAL', 'WELLBEING', 'WELFARE']);

export function workspaceTools(workspace: JobWorkspace, copy: WorkspaceCopy = english => english): DeskTool[] {
    const allowed = deskModules[workspace.key];
    const scopes = workspace.moduleScopes.filter(s => workspace.modules.includes(s.module) && canReadScope(s) && (workspace.key === 'shared' || allowed?.includes(s.module)));
    return scopes.flatMap(scope => {
        const tab = operationTabs.find(t => t.module === scope.module && t.module !== 'SETTINGS');
        if (tab) return [{ id: tab.id, module: scope.module, label: toolLabel(tab.id), description: operationDescriptions[scope.module], icon: tab.icon, scope }];
        if (scope.module === 'SCOUTING' && workspace.key === 'scouting') return [{ id: 'scouting', module: 'SCOUTING', label: copy('Scouting', 'სკაუტინგი'), description: copy('Open your current scouting records and permitted player sources.', 'გახსენით სკაუტინგის მიმდინარე ჩანაწერები და თქვენთვის ხელმისაწვდომი მოთამაშეთა წყაროები.'), icon: Binoculars, scope }];
        return [];
    });
}

export const overviewItem = { id: 'overview', label: 'Overview', icon: Home };
export const toolsItem = { id: 'tools', label: 'All tools', icon: LayoutGrid };
export const inboxItem = { id: 'inbox', label: 'Inbox', icon: Inbox };
