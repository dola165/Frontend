import { apiClient } from '../../api/axiosConfig';
import type {
    ClubInviteCandidate,
    ClubManagementOverview,
    ClubMembershipApplication,
    ClubMembershipContext,
    ClubMembershipRole,
    ClubPlayerAffiliation,
    MyClubInvitation,
    PageResult
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

export const fetchClubPlayers = async (clubId: number, status?: string | null, page = 0, size = 20) => {
    const response = await apiClient.get<PageResult<ClubPlayerAffiliation>>(`/clubs/${clubId}/players`, {
        params: { status: status || undefined, page, size }
    });
    return response.data;
};

export const updateClubPlayerStatus = async (clubId: number, userId: number, status: string) => {
    const response = await apiClient.patch<ClubPlayerAffiliation>(`/clubs/${clubId}/players/${userId}`, { status });
    return response.data;
};

export const createClubApplication = async (clubId: number, role: Extract<ClubMembershipRole, 'COACH' | 'PLAYER'>, message?: string | null) => {
    const response = await apiClient.post<{ applicationId: number }>(`/clubs/${clubId}/applications`, { role, message });
    return response.data;
};

export const selfRegisterClubPlayer = async (clubId: number) => {
    const response = await apiClient.post<ClubPlayerAffiliation>(`/clubs/${clubId}/players/self-register`);
    return response.data;
};

export const cancelClubApplication = async (clubId: number, applicationId: number) => {
    const response = await apiClient.post<{ status: string }>(`/clubs/${clubId}/applications/${applicationId}/cancel`);
    return response.data;
};

export const acceptClubApplication = async (clubId: number, applicationId: number) => {
    await apiClient.post(`/clubs/${clubId}/management/applications/${applicationId}/accept`);
};

export const declineClubApplication = async (clubId: number, applicationId: number) => {
    await apiClient.post(`/clubs/${clubId}/management/applications/${applicationId}/decline`);
};
