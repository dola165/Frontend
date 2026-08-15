export type ClubMembershipRole = 'OWNER' | 'CLUB_ADMIN' | 'COACH' | 'PLAYER';
export type LegacyClubMembershipRole = ClubMembershipRole | 'AGENT';
export type ClubInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
export type ClubApplicationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export type ClubRelationshipState = 'NONE' | 'INVITED' | 'APPLIED' | 'TRIALIST' | 'ACTIVE' | 'LEFT' | 'REMOVED';
export type PlayerJoinPolicy = 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';
export type PlayerAffiliationStatus = 'TRIALIST' | 'ACTIVE' | 'PAST' | 'REMOVED';

export interface ClubMembershipContext {
    hasClubMembership: boolean;
    canCreateClub: boolean;
    clubId?: number | null;
    clubName?: string | null;
    myRole?: ClubMembershipRole | null;
}

export interface ClubManagedMember {
    userId: number;
    fullName?: string | null;
    username: string;
    avatarUrl?: string | null;
    role: LegacyClubMembershipRole;
    roleEditable: boolean;
}

export interface ClubMembershipInvite {
    id: number;
    userId: number;
    fullName?: string | null;
    username: string;
    avatarUrl?: string | null;
    role: ClubMembershipRole;
    status: ClubInviteStatus;
    createdAt?: string | null;
    expiresAt?: string | null;
}

export interface MyClubInvitation {
    id: number;
    clubId: number;
    clubName: string;
    role: ClubMembershipRole;
    status: ClubInviteStatus;
    createdAt?: string | null;
    expiresAt?: string | null;
}

export interface ClubMembershipApplication {
    id: number;
    userId: number;
    fullName?: string | null;
    username: string;
    avatarUrl?: string | null;
    role: ClubMembershipRole;
    status: ClubApplicationStatus;
    message?: string | null;
    createdAt?: string | null;
}

export interface ClubManagementOverview {
    currentUserRole: ClubMembershipRole | null;
    assignableInviteRoles: ClubMembershipRole[];
    assignableStaffRoles: Exclude<ClubMembershipRole, 'PLAYER'>[];
    activePlayerCount: number;
    trialistCount: number;
    overdueTrialistCount: number;
    members: ClubManagedMember[];
    pendingInvitations: ClubMembershipInvite[];
    pendingApplications: ClubMembershipApplication[];
}

export interface ClubPlayerAffiliation {
    userId: number;
    fullName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    status: PlayerAffiliationStatus;
    primary: boolean;
    source?: string | null;
    joinedAt?: string | null;
    endedAt?: string | null;
    position?: string | null;
    jerseyNumber?: number | null;
    parentEmail?: string | null;
    parentalConsentStatus?: string | null;
    parentalConsentAt?: string | null;
}

export interface ClubInviteCandidate {
    id: number;
    fullName?: string | null;
    username: string;
    position?: string | null;
    userType?: string | null;
}

export interface PageResult<T> {
    content: T[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
}

const roleLabels: Record<LegacyClubMembershipRole, string> = {
    OWNER: 'Owner',
    CLUB_ADMIN: 'Club Admin',
    COACH: 'Coach',
    PLAYER: 'Player',
    AGENT: 'Legacy Agent'
};

const inviteStatusLabels: Record<ClubInviteStatus, string> = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired'
};

const applicationStatusLabels: Record<ClubApplicationStatus, string> = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled'
};

const formatFallbackLabel = (value: string) => value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const clubRoleLabel = (role?: string | null) => {
    if (!role) {
        return 'Unknown';
    }

    return roleLabels[role as LegacyClubMembershipRole] ?? formatFallbackLabel(role);
};

export const clubInviteStatusLabel = (status?: string | null) => {
    if (!status) {
        return 'Unknown';
    }

    return inviteStatusLabels[status as ClubInviteStatus] ?? formatFallbackLabel(status);
};

export const clubApplicationStatusLabel = (status?: string | null) => {
    if (!status) {
        return 'Unknown';
    }

    return applicationStatusLabels[status as ClubApplicationStatus] ?? formatFallbackLabel(status);
};

export const isLeadershipRole = (role?: string | null): role is ClubMembershipRole =>
    role === 'OWNER' || role === 'CLUB_ADMIN';

export const canManageClubOperations = (role?: string | null): role is ClubMembershipRole =>
    isLeadershipRole(role) || role === 'COACH';

export const canReviewTryouts = (role?: string | null): role is ClubMembershipRole =>
    canManageClubOperations(role);

export const isLegacyAgentMembershipRole = (role?: string | null) => role === 'AGENT';

export interface MyClubMembership {
    clubId: number;
    clubName: string;
    role: ClubMembershipRole;
    status: PlayerAffiliationStatus;
    primary: boolean;
    logoUrl?: string | null;
}
