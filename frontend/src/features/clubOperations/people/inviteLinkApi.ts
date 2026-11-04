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

/** `emailProof`: from the link in the invitation email, which confirms the address; a link passed on by hand has none. */
export const claimClubInvite = async (claim: { token: string; name: string; dateOfBirth: string; password: string; emailProof?: string }) =>
    (await apiClient.post<{ email: string; confirmationSent: boolean; emailConfirmed?: boolean }>('/auth/club-invite/claim', claim)).data;

/**
 * Signing in remounts the whole app under the new session (AuthSessionBoundary), so what the page still has to do after
 * the claim can't live in the page. A full reload loses it: the link is used by then, and the job waits in the Inbox.
 */
interface ClaimedLink { token: string; invites: LinkInvite[]; emailConfirmed: boolean; started: boolean }
let claimed: ClaimedLink | null = null;
export const rememberClaimedLink = (link: Omit<ClaimedLink, 'started'>) => { claimed = { ...link, started: false }; };
export const claimedLink = (token: string) => claimed?.token === token ? claimed : null;
export const forgetClaimedLink = () => { claimed = null; };

export const declineClubInvite = async (token: string) => (await apiClient.post<{ declined: number }>('/auth/club-invite/decline', { token })).data;

/** Signs in with the password just chosen; null when the sign-in asks for more (then the person signs in normally). */
export const signInAfterClaim = async (email: string, password: string) => {
    const response = await apiClient.post<{ accessToken?: string; twoFactorRequired?: boolean }>('/auth/login', { email, password });
    return response.data?.twoFactorRequired || typeof response.data?.accessToken !== 'string' ? null : response.data.accessToken;
};

/** Coaches and team managers work with their squads. */
export const squadJob = (job: string) => job === 'COACH' || job === 'TEAM_MANAGER' || job.endsWith('_COACH');
const leading = (job: string) => job === 'ADMIN' || job === 'CLUB_ADMIN';

/**
 * Where a job starts: squad work in My squads, an Admin in Club office. Current server permissions choose the desk for
 * any other job; a scoped appointment need not be a squad job.
 */
export const jobHome = (clubId: number, job: string) =>
    squadJob(job) ? '/my-squads' : leading(job) ? `/clubs/${clubId}/office` : `/clubs/${clubId}/work`;

export const landingFor = (accepted: LinkInvite[]) => {
    const jobs = accepted.filter(invite => invite.kind === 'APPOINTMENT' || invite.kind === 'MEMBERSHIP');
    const clubs = [...new Set(jobs.map(invite => invite.clubId))];
    // Jobs at two clubs have no one home: the Inbox shows both.
    if (clubs.length > 1) return '/requests?view=updates';
    if (clubs.length === 1) return jobHome(clubs[0], (jobs.find(invite => leading(invite.job)) ?? jobs.find(invite => squadJob(invite.job)) ?? jobs[0]).job);
    return accepted.length === 1 && accepted[0].kind === 'PROJECT_HELPER' ? `/projects/${accepted[0].id}` : '/home';
};

/** Accepts one job the normal, signed-in way: the appointment's own accept, or the club invitation's. */
export const acceptClubInvite = async (invite: LinkInvite) => {
    if (invite.kind === 'HELPER' || invite.kind === 'PROJECT_HELPER') return;
    if (invite.kind === 'APPOINTMENT') await apiClient.post(`/clubs/${invite.clubId}/operations/appointments/${invite.id}/transition`, { status: 'ACTIVE', revision: invite.revision });
    else await apiClient.post(`/club-memberships/invites/${invite.id}/accept`);
};

/**
 * The staff link page (`/staff-invite/{code}`, from a QR code or a group chat): one job for many people. The preview is
 * open without signing in; joining needs the person's own account and gives the job at once (fnd-access-b).
 */
export interface StaffInvitePreview {
    clubId: number; clubName: string; clubLogoUrl: string | null; job: string; title: string; clubWide: boolean; squads: string[];
    invitedBy: string | null; status: 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'REVOKED'; expiresAt: string;
}
export interface StaffInviteJoined { appointmentId: number; clubId: number; clubName: string; title: string; squads: string[]; alreadyJoined: boolean }
export const previewStaffInvite = async (code: string, signal?: AbortSignal) =>
    (await apiClient.get<StaffInvitePreview>(`/staff-invite/${encodeURIComponent(code)}`, { signal })).data;
export const joinStaffInvite = async (code: string) => (await apiClient.post<StaffInviteJoined>(`/staff-invite/${encodeURIComponent(code)}`)).data;
