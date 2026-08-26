import { apiClient } from '../../api/axiosConfig';
import type {
    BulkApplicationDecisionRequestPayload,
    BulkApplicationDecisionResponse,
    ClubInviteCandidate,
    ClubJourney,
    ClubManagementOverview,
    ClubMembershipApplication,
    ClubMembershipContext,
    ClubMembershipRole,
    ClubPlayerAffiliation,
    MyClubInvitation,
    MyClubMembership,
    PageResult,
    PlayerJoinPolicy
} from './domain';

export const fetchMyClubMembershipContext = async () => {
    const response = await apiClient.get<ClubMembershipContext>('/clubs/my-membership-context');
    return response.data;
};

export const fetchClubManagementOverview = async (clubId: number) => {
    const response = await apiClient.get<ClubManagementOverview>(`/clubs/${clubId}/management`);
    return response.data;
};

export const searchClubInviteCandidates = async (clubId: number, query: string, page = 0, size = 8) => {
    const response = await apiClient.get<PageResult<ClubInviteCandidate>>(`/clubs/${clubId}/management/user-search`, {
        params: { query, page, size }
    });
    return response.data;
};

export const createClubInvitation = async (clubId: number, userId: number, role: ClubMembershipRole) => {
    await apiClient.post(`/clubs/${clubId}/management/invitations`, { userId, role });
};

export const cancelClubInvitation = async (clubId: number, inviteId: number) => {
    await apiClient.delete(`/clubs/${clubId}/management/invitations/${inviteId}`);
};

export const fetchMyClubInvitations = async () => {
    const response = await apiClient.get<MyClubInvitation[]>('/club-memberships/invites/me');
    return response.data;
};

export const acceptClubInvitation = async (inviteId: number) => {
    const response = await apiClient.post<{ status: string }>(`/club-memberships/invites/${inviteId}/accept`);
    return response.data;
};

export const declineClubInvitation = async (inviteId: number) => {
    const response = await apiClient.post<{ status: string }>(`/club-memberships/invites/${inviteId}/decline`);
    return response.data;
};

export const updateClubMemberRole = async (clubId: number, userId: number, role: ClubMembershipRole) => {
    await apiClient.patch(`/clubs/${clubId}/management/members/${userId}/role`, { role });
};

export const removeClubMember = async (clubId: number, userId: number) => {
    await apiClient.post(`/clubs/${clubId}/management/members/${userId}/remove`);
};

export const leaveClubMembership = async (clubId: number) => {
    await apiClient.post(`/clubs/${clubId}/membership/leave`);
};

export const transferClubOwnership = async (clubId: number, userId: number) => {
    await apiClient.post(`/clubs/${clubId}/ownership/transfer`, { userId });
};

export const fetchPendingClubApplications = async (clubId: number) => {
    const response = await apiClient.get<ClubMembershipApplication[]>(`/clubs/${clubId}/management/applications`);
    return response.data;
};

/** Phase A3 — applications list with optional position/ageGroup/status filters. */
export const fetchClubApplications = async (
    clubId: number,
    filters?: { position?: string | null; ageGroup?: string | null; status?: string | null }
) => {
    const response = await apiClient.get<ClubMembershipApplication[]>(`/clubs/${clubId}/management/applications`, {
        params: {
            position: filters?.position || undefined,
            ageGroup: filters?.ageGroup || undefined,
            status: filters?.status || undefined,
        },
    });
    return response.data;
};

/** Phase A3 — bulk accept/decline with per-id results. */
export const bulkDecideClubApplications = async (
    clubId: number,
    payload: BulkApplicationDecisionRequestPayload
) => {
    const response = await apiClient.post<BulkApplicationDecisionResponse>(
        `/clubs/${clubId}/applications/bulk-decide`,
        payload
    );
    return response.data;
};

/** Phase A4 — the authenticated player's club journey aggregate. */
export const fetchClubJourney = async () => {
    const response = await apiClient.get<ClubJourney>('/me/club-journey');
    return response.data;
};

export const fetchClubPlayers = async (clubId: number, status?: string | null, page = 0, size = 20) => {
    const response = await apiClient.get<PageResult<ClubPlayerAffiliation>>(`/clubs/${clubId}/players`, {
        params: { status: status || undefined, page, size }
    });
    return response.data;
};

export const updateClubPlayerStatus = async (
    clubId: number,
    userId: number,
    status: string,
    trialEndsOn?: string | null,
    message?: string | null
) => {
    const response = await apiClient.patch<ClubPlayerAffiliation>(`/clubs/${clubId}/players/${userId}`, {
        status,
        trialEndsOn: trialEndsOn ?? null,
        message: message ?? null,
    });
    return response.data;
};

/** Phase A1 — promote a trialist to ACTIVE and assign them to a squad in one action. */
export const promoteClubPlayer = async (
    clubId: number,
    userId: number,
    payload: { squadId: number; trialEndsOn?: string | null }
) => {
    const response = await apiClient.post<ClubPlayerAffiliation>(`/clubs/${clubId}/players/${userId}/promote`, {
        squadId: payload.squadId,
        trialEndsOn: payload.trialEndsOn ?? null,
    });
    return response.data;
};

export const createClubApplication = async (
    clubId: number,
    role: Extract<ClubMembershipRole, 'COACH' | 'PLAYER'>,
    message?: string | null,
    extra?: { position?: string | null; ageGroup?: string | null; jobId?: number | null }
) => {
    const response = await apiClient.post<{ applicationId: number }>(`/clubs/${clubId}/applications`, {
        role,
        message,
        position: extra?.position ?? null,
        ageGroup: extra?.ageGroup ?? null,
        jobId: extra?.jobId ?? null,
    });
    return response.data;
};

// ── Club jobs (WEB_APP_MASTER_PLAN.md §4.2, Phase 2) ──

export interface ClubJob {
    id: number;
    clubId?: number | null;
    title: string;
    description?: string | null;
    ageGroup?: string | null;
    level?: string | null;
    status?: string | null;
    createdAt?: string | null;
    createdBy?: number | null;
    applicationCount?: number | null;
}

export interface ClubJobPayload {
    title?: string;
    description?: string | null;
    ageGroup?: string | null;
    level?: string | null;
    status?: 'OPEN' | 'CLOSED';
}

export const fetchClubJobs = async (clubId: number) => {
    const response = await apiClient.get<ClubJob[]>(`/clubs/${clubId}/jobs`);
    return response.data;
};

export const fetchAllClubJobs = async (clubId: number) => {
    const response = await apiClient.get<ClubJob[]>(`/clubs/${clubId}/jobs/all`);
    return response.data;
};

export const createClubJob = async (clubId: number, payload: ClubJobPayload) => {
    const response = await apiClient.post<ClubJob>(`/clubs/${clubId}/jobs`, payload);
    return response.data;
};

export const updateClubJob = async (clubId: number, jobId: number, payload: ClubJobPayload) => {
    const response = await apiClient.patch<ClubJob>(`/clubs/${clubId}/jobs/${jobId}`, payload);
    return response.data;
};

export const deleteClubJob = async (clubId: number, jobId: number) => {
    await apiClient.delete(`/clubs/${clubId}/jobs/${jobId}`);
};

/** Per-job application list (item 5) — job creator or club owner/admin only. */
export const fetchJobApplications = async (clubId: number, jobId: number): Promise<ClubMembershipApplication[]> => {
    const response = await apiClient.get<ClubMembershipApplication[]>(`/clubs/${clubId}/jobs/${jobId}/applications`);
    return response.data;
};

/** Owner/admin only — the backend rejects COACH (Phase 2 §4.4). */
export const updateClubSettings = async (clubId: number, playerJoinPolicy: PlayerJoinPolicy) => {
    await apiClient.patch(`/clubs/${clubId}`, { playerJoinPolicy });
};

export const selfRegisterClubPlayer = async (clubId: number) => {
    const response = await apiClient.post<ClubPlayerAffiliation>(`/clubs/${clubId}/players/self-register`);
    return response.data;
};

export const cancelClubApplication = async (clubId: number, applicationId: number) => {
    const response = await apiClient.post<{ status: string }>(`/clubs/${clubId}/applications/${applicationId}/cancel`);
    return response.data;
};

export const acceptClubApplication = async (clubId: number, applicationId: number, message?: string | null) => {
    await apiClient.post(`/clubs/${clubId}/management/applications/${applicationId}/accept`, {
        message: message ?? null,
    });
};

export const declineClubApplication = async (clubId: number, applicationId: number, message?: string | null) => {
    await apiClient.post(`/clubs/${clubId}/management/applications/${applicationId}/decline`, {
        message: message ?? null,
    });
};

export const fetchMyClubMemberships = async () => {
    const response = await apiClient.get<MyClubMembership[]>('/club-memberships/me');
    return response.data;
};

// ── Squad management ──

export interface UpdateSquadPayload {
    name?: string | null;
    category?: string | null;
    gender?: string | null;
    headCoachId?: number | null;
}

export interface UpdateSquadPlayerPayload {
    jerseyNumber?: number | null;
    squadRole?: string | null;
}

export interface AddSquadPlayerPayload {
    userId: number;
    jerseyNumber?: number | null;
    squadRole?: string | null;
}

export interface BatchAddSquadPlayersPayload {
    players: AddSquadPlayerPayload[];
}

export const updateSquad = async (clubId: number, squadId: number, payload: UpdateSquadPayload) => {
    await apiClient.patch(`/clubs/${clubId}/squads/${squadId}`, payload);
};

export const deleteSquad = async (clubId: number, squadId: number) => {
    await apiClient.delete(`/clubs/${clubId}/squads/${squadId}`);
};

export const updateSquadPlayer = async (clubId: number, squadId: number, userId: number, payload: UpdateSquadPlayerPayload) => {
    await apiClient.patch(`/clubs/${clubId}/squads/${squadId}/players/${userId}`, payload);
};

export const addPlayerToSquad = async (clubId: number, squadId: number, payload: AddSquadPlayerPayload) => {
    await apiClient.post(`/clubs/${clubId}/squads/${squadId}/players`, payload);
};

export const removePlayerFromSquad = async (clubId: number, squadId: number, userId: number) => {
    await apiClient.delete(`/clubs/${clubId}/squads/${squadId}/players/${userId}`);
};

export const batchAddPlayersToSquad = async (clubId: number, squadId: number, payload: BatchAddSquadPlayersPayload) => {
    await apiClient.post(`/clubs/${clubId}/squads/${squadId}/players/batch`, payload);
};

// ── Player Cards (WEB_APP_MASTER_PLAN.md §2.2) ──

export interface PlayerCard {
    id: number;
    clubId?: number | null;
    userId?: number | null;
    fullName?: string | null;
    birthYear?: number | null;
    position?: string | null;
    jerseyNumber?: number | null;
    photoUrl?: string | null;
    parentEmail?: string | null;
    guardianUserId?: number | null;
    squadId?: number | null;
    claimed?: boolean;
    registered?: boolean;
}

export interface CreatePlayerCardPayload {
    fullName: string;
    birthYear: number;
    position?: string | null;
    jerseyNumber?: number | null;
    photoUrl?: string | null;
    parentEmail?: string | null;
    squadId?: number | null;
}

export const createPlayerCard = async (clubId: number, payload: CreatePlayerCardPayload) => {
    const response = await apiClient.post<PlayerCard>(`/clubs/${clubId}/player-cards`, payload);
    return response.data;
};

export const fetchPlayerCards = async (clubId: number) => {
    const response = await apiClient.get<PlayerCard[]>(`/clubs/${clubId}/player-cards`);
    return response.data;
};

export const updatePlayerCard = async (clubId: number, cardId: number, payload: Partial<CreatePlayerCardPayload>) => {
    const response = await apiClient.patch<PlayerCard>(`/clubs/${clubId}/player-cards/${cardId}`, payload);
    return response.data;
};

export const deletePlayerCard = async (clubId: number, cardId: number) => {
    await apiClient.delete(`/clubs/${clubId}/player-cards/${cardId}`);
};

// ── Parental consent + activation (Sprint 3) ──

export const sendParentalConsentEmail = async (clubId: number, userId: number, parentEmail?: string | null) => {
    await apiClient.post(`/clubs/${clubId}/players/${userId}/consent-email`, { parentEmail });
};

export const fetchMyPlayerCards = async () => {
    const response = await apiClient.get<PlayerCard[]>('/player-cards/mine');
    return response.data;
};

export const activatePlayerCard = async (cardId: number, dateOfBirth: string, email: string) => {
    const response = await apiClient.post<{ username: string; tempPassword: string }>(
        `/player-cards/${cardId}/activate`,
        { dateOfBirth, email }
    );
    return response.data;
};
