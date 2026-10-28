import { CheckCircle2, Handshake, HeartHandshake, IdCard, ReceiptText, ShoppingBag, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { Bootstrap } from '../clubOperations/api';
import { operationModule, operationTabs, toolLabel } from '../clubOperations/workspaceNavigation';
import { canManageClubOperations, isLeadershipRole } from '../clubs/domain';
import { MORE_TOOLS, OFFICE_TOOLS, type OfficeTool } from './officeLinks';

/**
 * What a person can do with a tool in More tools: open it, only read it (`view`), or see that it's a locked drawer
 * (medical notes and concerns, which admins don't open either). Nothing more is decided here: the server checks
 * every record when it's read.
 */
export type ToolState = 'open' | 'view' | 'locked';

const BESPOKE: Partial<Record<OfficeTool, LucideIcon>> = {
    admissions: UserPlus, applications: CheckCircle2, players: Users, 'player-cards': IdCard, campaigns: HeartHandshake,
    programmes: ReceiptText, store: ShoppingBag, tryouts: CheckCircle2, 'club-approaches': Handshake,
};
export const toolIcon = (tool: OfficeTool): LucideIcon => BESPOKE[tool] ?? operationTabs.find(tab => tab.id === tool)?.icon ?? Users;
export const toolName = (tool: OfficeTool) => toolLabel(tool);

export interface ToolAccessInput {
    boot: Bootstrap | null;
    /** The person's club membership role (Owner, Admin, the older Coach), from the club overview. */
    role: string | null | undefined;
    /** Whether the club's player admission answered for this person. */
    admissions: boolean;
}

/**
 * The tools this person can open today, exactly as the club workspace allowed them (whatever someone could open,
 * they still can): a tool's records come with a job that holds it, and the older club tools with the membership.
 */
export function toolStates({ boot, role, admissions }: ToolAccessInput): Map<OfficeTool, ToolState> {
    const leader = isLeadershipRole(role) || Boolean(boot?.leadership);
    const states = new Map<OfficeTool, ToolState>();
    for (const tool of OFFICE_TOOLS) {
        const module = operationModule(tool);
        if (module) {
            const access = boot?.modules.find(item => item.id === module);
            if (access) states.set(tool, access.writable ? 'open' : 'view');
            else if (leader && boot) states.set(tool, 'locked');
            continue;
        }
        const allowed = tool === 'admissions' ? admissions
            : ['players', 'player-cards', 'applications', 'tryouts'].includes(tool) ? canManageClubOperations(role)
                : leader;
        if (allowed) states.set(tool, 'open');
    }
    return states;
}

/**
 * More tools as this person sees it: admins every group, everyone else only the tools they can open. A tool the club
 * switched off in Settings is left out of the list (its old links still open it).
 */
export function moreToolGroups(states: Map<OfficeTool, ToolState>, boot: Bootstrap | null, everything: boolean) {
    const on = (tool: OfficeTool) => { const module = operationModule(tool); return !module || !boot || boot.settings.enabled_modules.includes(module); };
    return MORE_TOOLS.map(group => ({ ...group, tools: group.tools.filter(tool => on(tool) && (everything || states.get(tool) === 'open' || states.get(tool) === 'view')) }))
        .filter(group => group.tools.length);
}
