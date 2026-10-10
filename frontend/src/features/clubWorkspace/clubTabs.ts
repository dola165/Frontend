import {
    BellRing, Briefcase, BriefcaseBusiness, Bus, CheckCircle2, Compass, Goal, Settings2, ClipboardList, CreditCard, Crown, Gauge, HeartHandshake, LayoutDashboard, LayoutGrid,
    ReceiptText, Settings, ShieldCheck, ShoppingBag, UserPlus, Users, UserRoundCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import type { WorkspaceNavGroup, WorkspaceNavItem } from '../../design/workspace/WorkspaceShell';
import type { Bootstrap } from '../clubOperations/api';
import type { ClubManagementOverview } from '../clubs/domain';
import type { RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import { availableOperationTabs, operationModule } from '../clubOperations/workspaceNavigation';
import { personalTabs, workspaceAreas } from '../clubOperations/workspaceStructure';
import { translate } from '../../locales/useCopy';
import { workspaceNavEn } from '../../locales/workspaceDesign';

/** The translated name of a workspace destination or area, as the rail shows it. */
export const navLabel = (id: string) => (id in workspaceNavEn ? translate('workspaceNav', workspaceNavEn, id as keyof typeof workspaceNavEn) : id);

interface ClubTabsInput {
    overview: ClubManagementOverview | null;
    roles: RolesWorkspace | null;
    boot: Bootstrap | null;
    canManageLeadership: boolean;
    canManageOperations: boolean;
    canManageTryouts: boolean;
    tryoutCount: number;
    admissionsLabel: string | null;
    admissionsWaiting: number;
}

/** Every tool this person may open in the club workspace, decided by their verified club role and appointments. */
export function buildClubTabs({ overview, roles, boot, canManageLeadership, canManageOperations, canManageTryouts, tryoutCount, admissionsLabel, admissionsWaiting }: ClubTabsInput): TabItem[] {
    const items: TabItem[] = [];
    // Labels follow the app language; a tool without its own entry keeps the name it came with.
    const add = (item: TabItem) => { if (!items.some(existing => existing.id === item.id)) items.push(item.id in workspaceNavEn ? { ...item, label: navLabel(item.id) } : item); };
    if (overview || roles) add({ id: 'overview', label: 'Overview', icon: LayoutDashboard });
    if (roles) add({ id: 'coach-hub', label: 'Coach Hub', icon: Gauge });
    if (canManageLeadership || boot?.modules.some(m => m.id === 'STAFF')) add({ id: 'personnel', label: 'Staff', icon: Users });
    if (canManageOperations) {
        add({ id: 'players', label: 'Players', icon: Users });
        add({ id: 'invites', label: 'Invites', icon: UserPlus, count: overview?.pendingInvitations.length || undefined });
    }
    if (admissionsLabel) add({ id: 'admissions', label: admissionsLabel, icon: UserPlus, count: admissionsWaiting || undefined });
    if (canManageOperations) add({ id: 'applications', label: 'Applications', icon: CheckCircle2, count: overview?.pendingApplications.length || undefined });
    if (canManageLeadership) {
        add({ id: 'roles', label: 'Ownership & access', icon: Crown });
        add({ id: 'club-approaches', label: 'Agent approaches', icon: HeartHandshake });
    }
    if (canManageOperations) add({ id: 'jobs', label: 'Open roles', icon: Briefcase });
    if (canManageLeadership) {
        add({ id: 'programmes', label: 'Programmes & fees', icon: ReceiptText });
        add({ id: 'store', label: 'Store', icon: ShoppingBag });
        add({ id: 'campaigns', label: 'Campaigns', icon: HeartHandshake });
        add({ id: 'settings', label: 'Club settings', icon: Settings });
    }
    if (canManageOperations) {
        add({ id: 'squads', label: 'Squads', icon: ShieldCheck });
        add({ id: 'player-cards', label: 'Player cards', icon: CreditCard });
    }
    if (canManageTryouts) add({ id: 'tryouts', label: 'Tryouts', icon: CheckCircle2, count: tryoutCount || undefined });
    if (boot) availableOperationTabs(boot).forEach(tab => add({ id: tab.id, label: tab.id === 'actions' ? 'Work queue' : tab.label, icon: tab.id === 'actions' ? ClipboardList : tab.icon }));
    if (roles) {
        add({ id: 'tools', label: 'All tools', icon: LayoutGrid });
        if (roles.squads.length && !canManageOperations) add({ id: 'squads', label: 'Squads', icon: ShieldCheck });
        if (roles.leadership) add({ id: 'role-requests', label: 'Staff roles', icon: UserRoundCog, count: roles.requests.filter(r => r.status === 'PENDING' && r.user_id !== roles.actorId).length || undefined });
    }
    return items;
}

/** Tools the club has switched off stay out of everyday navigation, unless open or asked for. */
export function visibleTabs(tabs: TabItem[], boot: Bootstrap | null, active: WorkspaceTab, includeHidden: boolean) {
    return tabs.filter(tab => {
        const module = operationModule(tab.id);
        return !module || ['HOME', 'SETTINGS'].includes(module) || includeHidden || active === tab.id || boot?.settings.enabled_modules.includes(module);
    });
}

const areaIcons: Record<string, LucideIcon> = { football: Goal, people: Users, operations: Bus, recruitment: Compass, business: BriefcaseBusiness, settings: Settings2 };
const navItem = (tab: TabItem): WorkspaceNavItem => ({ id: tab.id, label: tab.label, icon: tab.icon, count: tab.count });

/** Shapes the rail: primary destinations, pins, the areas your responsibilities use, then everything else. */
export function clubNavigation(tabs: TabItem[], { focus, pins, inbox }: { focus: Set<WorkspaceTab> | 'all'; pins: TabItem[]; inbox: { allowed: boolean; unread: number } }) {
    const byId = (id: string) => tabs.find(tab => tab.id === id);
    const primary: WorkspaceNavItem[] = [
        byId('overview'), byId('coach-hub'),
        // The club's own notifications. Named "Club updates" so it is never confused with the header Inbox.
        inbox.allowed ? { id: 'inbox' as const, label: navLabel('inbox'), icon: BellRing, count: inbox.unread || undefined } : undefined,
        byId('actions'),
    ].filter((tab): tab is TabItem => Boolean(tab)).map(navItem);
    const pinned = pins.filter(tab => !personalTabs.has(tab.id)).map(navItem);
    const grouped = (keep: (id: WorkspaceTab) => boolean): WorkspaceNavGroup[] => workspaceAreas
        .map(area => ({ id: area.id, label: navLabel(`area-${area.id}`), icon: areaIcons[area.id], items: (area.tabs as readonly WorkspaceTab[]).map(byId).filter((tab): tab is TabItem => Boolean(tab) && keep(tab!.id)).map(navItem) }))
        .filter(group => group.items.length);
    const inFocus = (id: WorkspaceTab) => focus === 'all' || focus.has(id);
    const groups = grouped(inFocus);
    const more = focus === 'all' ? [] : grouped(id => !inFocus(id));
    const footer = byId('tools') ? [navItem(byId('tools')!)] : [];
    return { primary, pinned, groups, more, footer };
}
