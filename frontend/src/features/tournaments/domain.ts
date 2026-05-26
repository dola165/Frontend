export type OrganizationKind = 'CLUB' | 'COMPANY' | 'SPONSOR' | 'MEDIA' | 'HEALTHCARE' | 'SPORTS_ORG' | 'PARTNER';
export type CreatableOrganizationKind = Exclude<OrganizationKind, 'CLUB'>;
export type TournamentParticipantScope = 'CLUB' | 'SQUAD' | 'PLAYER';
export type TournamentVisibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED';
export type TournamentHostAccessType = 'OWN_ORGANIZATION' | 'ORGANIZER_FOR';
export type TournamentStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TournamentEntryStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'WITHDRAWN' | 'ACTIVE' | 'ELIMINATED' | 'COMPLETED';
export type TournamentFixtureStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type TournamentStageStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TournamentStageType = 'GROUP' | 'KNOCKOUT' | 'ROUND_ROBIN' | 'LEAGUE';
export type DraftTeamStatus = 'FORMING' | 'LOCKED' | 'PROMOTED' | 'DISBANDED';

export interface MyOrganization {
    id: number;
    slug: string;
    displayName: string;
    description?: string | null;
    membershipRole: string;
    kinds: OrganizationKind[];
    primaryKind?: OrganizationKind | null;
    clubBacked: boolean;
    canCreateTournament: boolean;
}

export interface TournamentHostClubOption {
    clubId: number;
    clubName: string;
    organizationId: number;
    organizationName: string;
    accessType: TournamentHostAccessType;
}

export interface CreateOrganizationPayload {
    displayName: string;
    description?: string | null;
    kind: CreatableOrganizationKind;
}

export interface CreateTournamentPayload {
    organizerOrganizationId: number;
    hostClubId?: number | null;
    name: string;
    description?: string | null;
    rules?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    participantScope: TournamentParticipantScope;
    visibility: TournamentVisibility;
    registrationOpensAt?: string | null;
    registrationClosesAt?: string | null;
    locationId?: number | null;
}

export interface TournamentStaffAssignmentDto {
    id: number;
    userId: number;
    fullName: string;
    role: string;
    status: string;
    assignedBy: number;
    createdAt: string;
}

export interface TournamentEntryDto {
    id: number;
    clubId: number | null;
    clubName: string | null;
    squadId: number | null;
    squadName: string | null;
    userId: number | null;
    displayName: string | null;
    status: TournamentEntryStatus;
    seed: number | null;
    requestedBy: number | null;
    decidedBy: number | null;
    decidedAt: string | null;
    confirmedAt: string | null;
    withdrawnAt: string | null;
    withdrawalReason: string | null;
}

export interface TournamentStageDto {
    id: number;
    parentStageId: number | null;
    name: string;
    stageType: TournamentStageType;
    stageOrder: number;
    status: TournamentStageStatus;
}

export interface TournamentFixtureDto {
    id: number;
    stageId: number | null;
    stageName: string | null;
    homeEntryId: number | null;
    homeLabel: string | null;
    awayEntryId: number | null;
    awayLabel: string | null;
    winnerEntryId: number | null;
    homeScore: number | null;
    awayScore: number | null;
    roundNumber: number | null;
    fixtureOrder: number | null;
    scheduledAt: string | null;
    locationId: number | null;
    status: TournamentFixtureStatus;
    linkedMatchId: number | null;
}

export interface DraftTeamDto {
    id: number;
    name: string;
    status: DraftTeamStatus;
    memberCount: number;
    promotedEntryId: number | null;
    createdAt: string;
}

export interface DraftTeamDetailDto {
    id: number;
    name: string;
    status: DraftTeamStatus;
    promotedEntryId: number | null;
    createdBy: number | null;
    createdAt: string;
    members: TournamentEntryDto[];
}

export interface TournamentDetail {
    id: number;
    name: string;
    description?: string | null;
    rules?: string | null;
    status: TournamentStatus;
    organizerOrganizationId: number;
    hostClubId?: number | null;
    participantScope: TournamentParticipantScope;
    visibility: TournamentVisibility;
    startDate?: string | null;
    endDate?: string | null;
    registrationOpensAt?: string | null;
    registrationClosesAt?: string | null;
    locationId?: number | null;
    staffAssignments: TournamentStaffAssignmentDto[];
    entries: TournamentEntryDto[];
    stages: TournamentStageDto[];
    fixtures: TournamentFixtureDto[];
}

export interface RequestTournamentEntryPayload {
    clubId: number;
    squadId?: number | null;
}

export interface UpdateEntryStatusPayload {
    status: TournamentEntryStatus;
    reason?: string | null;
}

export interface CreateDraftTeamPayload {
    name: string;
}

export interface AddDraftTeamMembersPayload {
    entryIds: number[];
}

export interface CompleteFixturePayload {
    winnerEntryId: number;
    homeScore?: number | null;
    awayScore?: number | null;
}

export interface UpdateFixtureScoresPayload {
    homeScore?: number | null;
    awayScore?: number | null;
}

const fallbackLabel = (value: string) => value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const organizationKindLabel = (kind?: string | null) => {
    if (!kind) return 'Unknown';
    if (kind === 'SPORTS_ORG') return 'Sports Org';
    return fallbackLabel(kind);
};

export const membershipRoleLabel = (role?: string | null) => {
    if (!role) return 'Unknown';
    if (role === 'CLUB_ADMIN') return 'Club Admin';
    return fallbackLabel(role);
};

export const hostAccessLabel = (accessType?: string | null) => {
    if (!accessType) return 'Unknown';
    if (accessType === 'OWN_ORGANIZATION') return 'Own Organization';
    if (accessType === 'ORGANIZER_FOR') return 'Organizer For';
    return fallbackLabel(accessType);
};

export const tournamentScopeLabel = (scope?: string | null) => {
    if (!scope) return 'Unknown';
    return fallbackLabel(scope);
};

export const tournamentVisibilityLabel = (visibility?: string | null) => {
    if (!visibility) return 'Unknown';
    return fallbackLabel(visibility);
};

export const entryStatusTone = (status: string) => {
    switch (status) {
        case 'ACTIVE': return 'success';
        case 'PENDING': return 'warning';
        case 'APPROVED': return 'info';
        case 'REJECTED': case 'WITHDRAWN': case 'ELIMINATED': return 'danger';
        case 'COMPLETED': return 'neutral';
        default: return 'neutral';
    }
};

export const fixtureStatusTone = (status: string) => {
    switch (status) {
        case 'SCHEDULED': return 'info';
        case 'COMPLETED': return 'success';
        case 'CANCELLED': return 'danger';
        default: return 'neutral';
    }
};

export const draftTeamStatusLabel = (status: string) => {
    switch (status) {
        case 'FORMING': return 'Forming';
        case 'LOCKED': return 'Locked';
        case 'PROMOTED': return 'Promoted';
        case 'DISBANDED': return 'Disbanded';
        default: return fallbackLabel(status);
    }
};
