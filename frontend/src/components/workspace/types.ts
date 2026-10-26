import type { LucideIcon } from 'lucide-react';
import { operationTabs, type OperationTab } from '../../features/clubOperations/workspaceNavigation';

export type WorkspaceTab = OperationTab | 'calendar' | 'tools' | 'coach-hub' | 'my-day' | 'my-people' | 'my-squads' | 'my-role' | 'overview' | 'personnel' | 'players' | 'invites' | 'admissions' | 'applications' | 'jobs' | 'settings' | 'programmes' | 'squads' | 'player-cards' | 'tryouts' | 'inbox' | 'store' | 'campaigns' | 'club-approaches';

export const WORKSPACE_TAB_IDS: readonly WorkspaceTab[] = [
    'overview', 'calendar', 'personnel', 'players', 'invites', 'admissions', 'applications', 'jobs',
    'settings', 'programmes', 'squads', 'player-cards', 'tryouts', 'inbox', 'store', 'campaigns', 'club-approaches',
    ...operationTabs.map(tab => tab.id),
    'tools', 'coach-hub', 'my-day', 'my-people', 'my-squads', 'my-role',
];

export const parseWorkspaceTab = (value: string | null): WorkspaceTab | null => (
    value && WORKSPACE_TAB_IDS.includes(value as WorkspaceTab) ? value as WorkspaceTab : null
);

export interface TabItem {
    id: WorkspaceTab;
    label: string;
    icon: LucideIcon;
    /** Items waiting in this tool, from the server. Omitted when nothing is waiting. */
    count?: number;
}

export interface UserSearchDto {
    id: number;
    fullName?: string | null;
    username: string;
    position?: string | null;
    userType?: string | null;
}

export interface TryoutApplicantDto {
    id: number;
    userId: number;
    name: string;
    position?: string | null;
    ageGroup?: string | null;
    status: string;
    profilePictureUrl?: string | null;
    matchScore: number;
    attributes: Record<string, number>;
}
