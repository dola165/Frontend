import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { AuthSessionId } from '../../../utils/authStorage';

/** Where a job waits to be answered. */
export const INBOX = '/requests?view=needs-you';

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
 * What accepting came to. `session`: the one it ran in, which a retry stays in. `helping`: what a new helper sees once
 * their email is confirmed (a project by name, or their session).
 */
export interface AcceptOutcome {
    session: AuthSessionId; failures: string[]; next: string; waitsOnEmail: string | null; helping: { what: string | null; session: boolean; next: string } | null;
    other: { clubId: number; name: string } | null; blocked: LinkInvite[];
}

/**
 * Signing in remounts the whole app under the new session (AuthSessionBoundary), so what the page still has to do after
 * the claim can't live in the page. Accepting runs once; whichever page is on screen when it ends shows `outcome`, null
 * if the session ended midway. A full reload loses it: the link is used by then, and the job waits in the Inbox.
 */
interface ClaimedLink { token: string; invites: LinkInvite[]; emailConfirmed: boolean; outcome: Promise<AcceptOutcome | null> | null }
let claimed: ClaimedLink | null = null;
export const rememberClaimedLink = (link: Omit<ClaimedLink, 'outcome'>) => { claimed = { ...link, outcome: null }; };
export const claimedLink = (token: string) => claimed?.token === token ? claimed : null;
export const forgetClaimedLink = () => { claimed = null; };

export const declineClubInvite = async (token: string) => (await apiClient.post<{ declined: number }>('/auth/club-invite/decline', { token })).data;

/** Signs in with the password just chosen; null when the sign-in asks for more (then the person signs in normally). */
export const signInAfterClaim = async (email: string, password: string) => {
    const response = await apiClient.post<{ accessToken?: string; twoFactorRequired?: boolean }>('/auth/login', { email, password });
    return response.data?.twoFactorRequired || typeof response.data?.accessToken !== 'string' ? null : response.data.accessToken;
};

/**
 * The jobs on squads (backend `ClubWorkspaceRoles.SQUAD_JOBS`), the specialist coaches' own codes, and a club
 * invitation's Coach. A rehabilitation coach works from player files and an equipment manager is on no squad.
 */
const SQUAD_JOBS = new Set(['COACH', 'HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'HEAD_OF_COACHING', 'TRAVEL_COORDINATOR',
    'SPECIALIST_COACH', 'GOALKEEPER_COACH', 'STRENGTH_CONDITIONING', 'TECHNICAL_COACH', 'TACTICAL_COACH', 'SET_PIECE_COACH']);
export const squadJob = (job: string) => SQUAD_JOBS.has(job);
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
    // Jobs at two clubs have no one home: Needs you shows both.
    if (clubs.length > 1) return INBOX;
    if (clubs.length === 1) return jobHome(clubs[0], (jobs.find(invite => leading(invite.job)) ?? jobs.find(invite => squadJob(invite.job)) ?? jobs[0]).job);
    return accepted.length === 1 && accepted[0].kind === 'PROJECT_HELPER' ? `/projects/${accepted[0].id}` : '/home';
};

/** Accepts one job the normal, signed-in way: the appointment's own accept, or the club invitation's. Refused once `session` has ended. */
export const acceptClubInvite = async (invite: LinkInvite, session: AuthSessionId) => {
    if (invite.kind === 'HELPER' || invite.kind === 'PROJECT_HELPER') return;
    const config = { _authSessionId: session } as AuthSessionRequestConfig;
    if (invite.kind === 'APPOINTMENT') await apiClient.post(`/clubs/${invite.clubId}/operations/appointments/${invite.id}/transition`, { status: 'ACTIVE', revision: invite.revision }, config);
    else await apiClient.post(`/club-memberships/invites/${invite.id}/accept`, undefined, config);
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
