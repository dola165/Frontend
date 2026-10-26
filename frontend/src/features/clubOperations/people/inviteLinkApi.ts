import { apiClient } from '../../../api/axiosConfig';

/** The club invite link page (backend `ClubInviteLinkController`, open without signing in; the token goes in the body). */
export interface LinkInvite {
    kind: 'APPOINTMENT' | 'MEMBERSHIP'; id: number; revision: number | null; clubId: number; clubName: string; clubLogoUrl: string | null;
    invitedBy: string | null; job: string; title: string; clubWide: boolean; squads: string[]; unavailableReason: string | null;
}
export interface ClubInvitePreview { email: string; invitedName: string | null; hasPassword: boolean; invites: LinkInvite[] }

export const previewClubInvite = async (token: string, signal?: AbortSignal) =>
    (await apiClient.post<ClubInvitePreview>('/auth/club-invite/preview', { token }, { signal })).data;

export const claimClubInvite = async (claim: { token: string; name: string; dateOfBirth: string; password: string }) =>
    (await apiClient.post<{ email: string }>('/auth/club-invite/claim', claim)).data;

export const declineClubInvite = async (token: string) => (await apiClient.post<{ declined: number }>('/auth/club-invite/decline', { token })).data;

/** Signs in with the password just chosen; null when the sign-in asks for more (then the person signs in normally). */
export const signInAfterClaim = async (email: string, password: string) => {
    const response = await apiClient.post<{ accessToken?: string; twoFactorRequired?: boolean }>('/auth/login', { email, password });
    return response.data?.twoFactorRequired || typeof response.data?.accessToken !== 'string' ? null : response.data.accessToken;
};

/** Where accepted jobs land: a squad job in My squads, anything else in the club's workspace. */
export const landingFor = (accepted: LinkInvite[]) => accepted.some(i => i.kind === 'APPOINTMENT' && !i.clubWide) ? '/my-squads'
    : accepted.length ? `/clubs/${accepted[0].clubId}/workspace` : '/home';

/** Accepts one job the normal, signed-in way: the appointment's own accept, or the club invitation's. */
export const acceptClubInvite = async (invite: LinkInvite) => {
    if (invite.kind === 'APPOINTMENT') await apiClient.post(`/clubs/${invite.clubId}/operations/appointments/${invite.id}/transition`, { status: 'ACTIVE', revision: invite.revision });
    else await apiClient.post(`/club-memberships/invites/${invite.id}/accept`);
};
