import { apiClient } from '../../../api/axiosConfig';

/** The club invite link page (backend `ClubInviteLinkController`, open without signing in; the token goes in the body). */
export interface LinkInvite {
    /**
     * HELPER: added to a session (step 3); PROJECT_HELPER: added to a club's project (step 4), `id` the project's. Nothing
     * to accept for either: it waits on Home once the account is set up.
     */
    kind: 'APPOINTMENT' | 'MEMBERSHIP' | 'HELPER' | 'PROJECT_HELPER'; id: number; revision: number | null; clubId: number; clubName: string; clubLogoUrl: string | null;
    invitedBy: string | null; job: string; title: string; clubWide: boolean; squads: string[]; unavailableReason: string | null;
}
export interface ClubInvitePreview { email: string; invitedName: string | null; hasPassword: boolean; invites: LinkInvite[] }

export const previewClubInvite = async (token: string, signal?: AbortSignal) =>
    (await apiClient.post<ClubInvitePreview>('/auth/club-invite/preview', { token }, { signal })).data;

export const claimClubInvite = async (claim: { token: string; name: string; dateOfBirth: string; password: string }) =>
    (await apiClient.post<{ email: string; confirmationSent: boolean }>('/auth/club-invite/claim', claim)).data;

export const declineClubInvite = async (token: string) => (await apiClient.post<{ declined: number }>('/auth/club-invite/decline', { token })).data;

/** Signs in with the password just chosen; null when the sign-in asks for more (then the person signs in normally). */
export const signInAfterClaim = async (email: string, password: string) => {
    const response = await apiClient.post<{ accessToken?: string; twoFactorRequired?: boolean }>('/auth/login', { email, password });
    return response.data?.twoFactorRequired || typeof response.data?.accessToken !== 'string' ? null : response.data.accessToken;
};

/** Current server permissions choose job destinations; a scoped appointment need not be a coaching job. */
export const landingFor = (accepted: LinkInvite[]) => {
    const jobs = accepted.filter(invite => invite.kind === 'APPOINTMENT' || invite.kind === 'MEMBERSHIP');
    const clubs = [...new Set(jobs.map(invite => invite.clubId))];
    if (clubs.length > 1) return '/workspaces';
    if (clubs.length === 1) return `/clubs/${clubs[0]}/${jobs.some(invite => invite.kind === 'APPOINTMENT') ? 'work' : 'office'}`;
    return accepted.length === 1 && accepted[0].kind === 'PROJECT_HELPER' ? `/projects/${accepted[0].id}` : '/home';
};

/** Accepts one job the normal, signed-in way: the appointment's own accept, or the club invitation's. */
export const acceptClubInvite = async (invite: LinkInvite) => {
    if (invite.kind === 'HELPER' || invite.kind === 'PROJECT_HELPER') return;
    if (invite.kind === 'APPOINTMENT') await apiClient.post(`/clubs/${invite.clubId}/operations/appointments/${invite.id}/transition`, { status: 'ACTIVE', revision: invite.revision });
    else await apiClient.post(`/club-memberships/invites/${invite.id}/accept`);
};

/**
 * The staff link page (`/staff-invite/{code}`, from a QR code or a chat): one job for the person it names. The preview is
 * open without signing in; joining needs the person's own account and their proof, and gives the job at once.
 */
export interface StaffInvitePreview {
    clubId: number; clubName: string; clubLogoUrl: string | null; job: string; title: string; clubWide: boolean; squads: string[];
    invitedBy: string | null; status: 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'REVOKED'; expiresAt: string;
    /** Who it names, and how they show it is them: a code to this (mostly hidden) email, or the phone the club has. */
    invitedName: string | null; proof: { by: 'EMAIL' | 'PHONE'; email: string | null } | null;
}
export interface StaffInviteJoined { appointmentId: number; clubId: number; clubName: string; title: string; squads: string[]; alreadyJoined: boolean; waitingForYes: boolean }
export const previewStaffInvite = async (code: string, signal?: AbortSignal) =>
    (await apiClient.get<StaffInvitePreview>(`/staff-invite/${encodeURIComponent(code)}`, { signal })).data;
export const joinStaffInvite = async (code: string, proof?: { code?: string; phone?: string }) =>
    (await apiClient.post<StaffInviteJoined>(`/staff-invite/${encodeURIComponent(code)}`, proof)).data;
/** Emails the code to the address the link names. */
export const sendStaffInviteCode = async (code: string) => { await apiClient.post(`/staff-invite/${encodeURIComponent(code)}/code`); };
