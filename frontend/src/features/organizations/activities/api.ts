import { apiClient } from '../../../api/axiosConfig';

export interface OrganizationCapabilities {
    enabledActivities: ('PROFILE' | 'VENUE' | 'TOURNAMENT')[];
    revision: number;
    venueAvailable: boolean;
    canConfigureActivities: boolean;
    canEditProfile: boolean;
    canConfigureVenue: boolean;
    canManageVenueBookings: boolean;
    canCreateTournament: boolean;
    canInviteVenueOperator: boolean;
}
export interface OrganizationInvitation {
    id: number; organizationId: number; organizationName: string; recipientName: string | null;
    status: string; expiresAt: string | null; canRespond: boolean; canOpenVenue: boolean;
}
export interface VenueOperator {
    membershipId: number; userId: number; name: string | null; status: string;
    startedAt: string; endedAt: string | null;
}
export interface Delegation { invitations: OrganizationInvitation[]; operators: VenueOperator[] }
export const getActivities = async (id: number, signal?: AbortSignal) =>
    (await apiClient.get<OrganizationCapabilities>(`/organizations/${id}/activities`, { signal })).data;
export const updateActivities = async (id: number, payload: { revision: number; venueEnabled: boolean; tournamentEnabled: boolean }) =>
    (await apiClient.put<OrganizationCapabilities>(`/organizations/${id}/activities`, payload)).data;
export const getOperators = async (id: number, signal?: AbortSignal) =>
    (await apiClient.get<Delegation>(`/organizations/${id}/venue-operators`, { signal })).data;
export const inviteOperator = async (id: number, email: string) =>
    (await apiClient.post<Delegation>(`/organizations/${id}/venue-operators/invitations`, { email })).data;
export const cancelInvitation = async (id: number, inviteId: number) =>
    (await apiClient.post<Delegation>(`/organizations/${id}/venue-operators/invitations/${inviteId}/cancel`)).data;
export const revokeOperator = async (id: number, membershipId: number) =>
    (await apiClient.post<Delegation>(`/organizations/${id}/venue-operators/${membershipId}/revoke`)).data;
export const getInvitations = async (signal?: AbortSignal) =>
    (await apiClient.get<OrganizationInvitation[]>('/organizations/invitations/mine', { signal })).data;
export const respondToInvitation = async (id: number, action: 'ACCEPT' | 'DECLINE') =>
    apiClient.post(`/organizations/invitations/${id}/response`, { action });
