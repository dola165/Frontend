import { apiClient } from '../../../api/axiosConfig';
import { cancelClubInvitation, removeClubMember } from '../../clubs/api';

/** The club's People screen: person → jobs → where, given with the Team work invite (backend `ClubPeopleController`). */
export interface PeopleSquad { id: number; name: string }
export type JobKind = 'APPOINTMENT' | 'OWNER' | 'ADMIN' | 'COACH' | 'ADMIN_INVITE' | 'COACH_INVITE';
export type JobStatus = 'ACTIVE' | 'INVITED' | 'UPCOMING' | 'EXPIRED' | 'UNAVAILABLE';
export interface PersonJob {
    kind: JobKind; id: number; job: string; title: string; clubWide: boolean; squads: PeopleSquad[]; status: JobStatus;
    unavailableReason: string | null; revision: number | null; addedById: number | null; addedByName: string | null;
    addedByHeadCoach: boolean; tools: string[];
    /** Who last changed it and the whole story; absent from servers before the foundation (26 Oct). */
    changedByName?: string | null; changedAt?: string | null; history?: JobEvent[];
}
export interface JobEvent { at: string; byName: string; action: 'GIVEN' | 'CHANGED' | 'ENDED' | 'CONFIRMED' | 'JOINED_BY_LINK'; summary: string }
export interface Person { userId: number; name: string; email: string | null; avatarUrl: string | null; needsLink: boolean; jobs: PersonJob[] }
export interface NameCheck { id: number; userId: number; invitedName: string; acceptedName: string; at: string }
export interface JobChoice { key: string; title: string; description: string; tools: string[] }
export interface PeopleView {
    /** `leader`: the Owner or an Admin. */
    viewer: { userId: number; leader: boolean; owner: boolean; headCoachSquads: number[] };
    people: Person[]; nameChecks: NameCheck[]; squads: PeopleSquad[]; jobs: JobChoice[]; moreJobs: JobChoice[]; tools: string[];
    /** Head coaches' suggested assistants still waiting for an admin. */
    suggestions?: AssistantSuggestion[];
}
export interface AssistantSuggestion {
    id: number; name: string; email: string | null; userId: number | null; squads: PeopleSquad[];
    suggestedById: number; suggestedByName: string; createdAt: string;
}
/** A staff link: one job (never Admin), 7 days or 10 uses, and who joined through it. */
export interface StaffLink {
    id: number; token: string; job: string; clubWide: boolean; squads: PeopleSquad[]; expiresAt: string; uses: number; maxUses: number;
    createdByName: string | null; createdAt: string;
    joined: { userId: number; jobId: number; name: string; avatarUrl: string | null; joinedAt: string }[];
}
export interface InviteLink { token: string; expiresAt: string }
export interface InviteResult { userId: number; name: string; inApp: boolean; link: InviteLink | null }
/** A job and where it applies, as the forms edit it. `job` is a main job, another bundle's key or CUSTOM. */
export interface JobDraft { job: string; title: string; tools: string[]; clubWide: boolean; squadIds: number[] }

export const MAIN_JOBS = ['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'FEES', 'ADMIN'] as const;
/** What a staff link can give: never Admin or Owner (admins are invited one by one). */
export const LINK_JOBS = ['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'FEES'] as const;

const base = (club: number) => `/clubs/${club}/people`;
const where = (draft: Pick<JobDraft, 'job' | 'clubWide' | 'squadIds'>) => draft.job === 'ADMIN' ? { clubWide: true, squadIds: [] }
    : { clubWide: draft.clubWide, squadIds: draft.clubWide ? [] : [...draft.squadIds].sort((a, b) => a - b) };
const custom = (draft: JobDraft) => draft.job === 'CUSTOM' ? { title: draft.title.trim(), tools: draft.tools } : { title: null, tools: null };

export const fetchPeople = async (club: number, signal?: AbortSignal) => (await apiClient.get<PeopleView>(base(club), { signal })).data;

/** A new person by name and email, or someone already listed by id. */
export const invitePerson = async (club: number, person: { name?: string; email?: string; userId?: number }, draft: JobDraft) =>
    (await apiClient.post<InviteResult>(`${base(club)}/invites`, { ...person, job: draft.job, ...custom(draft), ...where(draft) })).data;

/** An Owner's or Admin's change applies at once and is signed in the job's history. */
export const changeJob = async (club: number, job: PersonJob, draft: JobDraft) => {
    await apiClient.put(`${base(club)}/jobs/${job.id}`, { job: draft.job, ...custom(draft), ...where(draft), revision: job.revision });
};

export const newInviteLink = async (club: number, userId: number) => (await apiClient.post<InviteLink>(`${base(club)}/${userId}/link`)).data;

export const settleNameCheck = async (club: number, check: number, outcome: 'keep' | 'undo') => {
    await apiClient.post(`${base(club)}/name-checks/${check}/${outcome}`);
};

/** Ends a job through what it is: an appointment ends, an invitation is cancelled, a membership is removed. */
export const endJob = async (club: number, userId: number, job: PersonJob, note: string) => {
    if (job.kind === 'APPOINTMENT') await apiClient.post(`/clubs/${club}/operations/appointments/${job.id}/transition`, { status: 'ENDED', revision: job.revision, note });
    else if (job.kind === 'ADMIN_INVITE' || job.kind === 'COACH_INVITE') await cancelClubInvitation(club, job.id);
    else if (job.kind === 'ADMIN' || job.kind === 'COACH') await removeClubMember(club, userId);
};

/* Staff links and suggested assistants. GAP (26 Oct 2026): built on fnd-people-f's proposal before fnd-access-b's handover. */
export const fetchStaffLinks = async (club: number, signal?: AbortSignal) => (await apiClient.get<StaffLink[]>(`${base(club)}/staff-links`, { signal })).data;
/** A link for this job and where; it replaces the active one with the same job and where. */
export const makeStaffLink = async (club: number, draft: Pick<JobDraft, 'job' | 'clubWide' | 'squadIds'>) =>
    (await apiClient.post<StaffLink>(`${base(club)}/staff-links`, { job: draft.job, ...where(draft) })).data;
export const stopStaffLink = async (club: number, link: number) => { await apiClient.delete(`${base(club)}/staff-links/${link}`); };
export const removeJoined = async (club: number, link: number, userId: number) => { await apiClient.delete(`${base(club)}/staff-links/${link}/joined/${userId}`); };

export const suggestAssistant = async (club: number, squadIds: number[], person: { name: string; email: string } | { userId: number }) =>
    (await apiClient.post<AssistantSuggestion>(`${base(club)}/suggestions`, { squadIds, ...person })).data;
/** Confirm returns the invite (with a one-time link for a new account); the others return nothing. */
export const decideSuggestion = async (club: number, suggestion: number, decision: 'confirm' | 'decline' | 'withdraw') =>
    (await apiClient.post<InviteResult | ''>(`${base(club)}/suggestions/${suggestion}/${decision}`)).data || null;

export const inviteUrl = (token: string) => `${window.location.origin}/club-invite?token=${encodeURIComponent(token)}`;
export const staffLinkUrl = (token: string) => `${window.location.origin}/staff-link?token=${encodeURIComponent(token)}`;
export const whatsAppUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** The job a person holds or is invited to, as a draft the forms can change. */
export const draftOf = (job: PersonJob): JobDraft => ({
    job: job.job, title: job.job === 'CUSTOM' ? job.title : '', tools: job.job === 'CUSTOM' ? job.tools : [],
    clubWide: job.clubWide, squadIds: job.squads.map(s => s.id),
});
