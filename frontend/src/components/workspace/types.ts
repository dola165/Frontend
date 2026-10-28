import type { OperationTab } from '../../features/clubOperations/workspaceNavigation';

/**
 * A club tool or place by its id, as Club office and its links name them: the records tools (OperationTab), the older
 * club screens, and the squads and calendar a tool can lead to.
 */
export type WorkspaceTab = OperationTab | 'calendar' | 'players' | 'admissions' | 'applications' | 'settings' | 'programmes' | 'squads' | 'player-cards' | 'tryouts' | 'store' | 'campaigns' | 'club-approaches';

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
