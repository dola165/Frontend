import type { LucideIcon } from 'lucide-react';

export type WorkspaceTab = 'overview' | 'personnel' | 'players' | 'invites' | 'applications' | 'roles' | 'squads' | 'tryouts' | 'inbox';

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
