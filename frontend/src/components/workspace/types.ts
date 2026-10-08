import type { LucideIcon } from 'lucide-react';
import { operationTabs, type OperationTab } from '../../features/clubOperations/workspaceNavigation';

export type WorkspaceTab = OperationTab | 'tools' | 'my-day' | 'my-people' | 'my-squads' | 'my-role' | 'role-requests' | 'overview' | 'personnel' | 'players' | 'invites' | 'admissions' | 'applications' | 'roles' | 'jobs' | 'settings' | 'squads' | 'player-cards' | 'tryouts' | 'inbox' | 'store' | 'campaigns' | 'club-approaches';

export const WORKSPACE_TAB_IDS: readonly WorkspaceTab[] = [
    'overview', 'personnel', 'players', 'invites', 'admissions', 'applications', 'roles', 'jobs',
    'settings', 'squads', 'player-cards', 'tryouts', 'inbox', 'store', 'campaigns', 'club-approaches',
    ...operationTabs.map(tab => tab.id),
    'tools', 'my-day', 'my-people', 'my-squads', 'my-role', 'role-requests',
];

export const parseWorkspaceTab = (value: string | null): WorkspaceTab | null => (
    value && WORKSPACE_TAB_IDS.includes(value as WorkspaceTab) ? value as WorkspaceTab : null
);

export interface TabItem {
    id: WorkspaceTab;
    label: string;
    icon: LucideIcon;
    badge?: string | null;
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
