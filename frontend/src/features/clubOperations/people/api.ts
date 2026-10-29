import { apiClient } from '../../../api/axiosConfig';
import { cancelClubInvitation, removeClubMember } from '../../clubs/api';
import { extractApiErrorCode } from '../../../utils/apiError';

/** Club office's Staff: person → jobs → where, with contacts and today's duties (backend `ClubPeopleController`; step 2, 28 October 2026). */
export interface PeopleSquad { id: number; name: string }
export type JobKind = 'APPOINTMENT' | 'OWNER' | 'ADMIN' | 'COACH' | 'ADMIN_INVITE' | 'COACH_INVITE';
/** SUGGESTED: a head coach's suggestion waiting for an admin. */
export type JobStatus = 'ACTIVE' | 'INVITED' | 'SUGGESTED' | 'UPCOMING' | 'EXPIRED' | 'UNAVAILABLE';
export interface PersonJob {
    kind: JobKind; id: number; job: string; title: string; clubWide: boolean; squads: PeopleSquad[]; status: JobStatus;
    unavailableReason: string | null; revision: number | null;
    /** Who gave it (after a confirmed suggestion, the admin who confirmed). */
    addedById: number | null; addedByName: string | null;
    source?: 'INVITE' | 'STAFF_LINK' | 'SUGGESTION' | null; staffLinkId?: number | null;
    suggestedById?: number | null; suggestedByName?: string | null;
    startsOn?: string | null; endsOn?: string | null;
    /** What the viewer may do with this job, from the rule-checker. */
    canChange?: boolean; canEnd?: boolean; canConfirm?: boolean;
    tools: string[];
    /**
     * Who last changed it (the last CHANGED event) and the story, oldest first; memberships and invites have none.
     */
    changedByName?: string | null; changedAt?: string | null; history?: JobEvent[];
}
export interface JobEvent { at: string; byName: string; action: 'GIVEN' | 'SUGGESTED' | 'CONFIRMED' | 'DECLINED' | 'ACCEPTED' | 'CHANGED' | 'JOINED_BY_LINK' | 'ENDED'; summary: string | null }
/** A duty someone has today, from Staff duties. */
export interface Duty { id: number; title: string; startsAt: string; endsAt: string | null; location: string | null }
/**
 * `email` and `phone`: how fellow staff reach them, null when they hid it or it isn't the viewer's to see (admins
 * always see emails; nobody sees an invitee's phone). `onDuty`: their duties today.
 */
export interface Person { userId: number; name: string; email: string | null; phone?: string | null; avatarUrl: string | null; needsLink: boolean; jobs: PersonJob[]; onDuty?: Duty[] }
/** An outside specialist the club works with now, from Specialists. */
export interface Specialist { id: number; name: string; specialisation: string | null; contact: string | null; startsAt: string | null; endsAt: string | null }
export interface NameCheck { id: number; userId: number; invitedName: string; acceptedName: string; at: string }
export interface JobChoice { key: string; title: string; description: string; tools: string[]; family?: string; home?: string; views?: string[]; titles?: string[] }
export interface PeopleView {
    /** `leader`: the Owner or an Admin. `hideEmail`, `hidePhone`: the viewer's own choice of what fellow staff see. */
    viewer: { userId: number; leader: boolean; owner: boolean; headCoachSquads: number[]; hideEmail?: boolean; hidePhone?: boolean };
    people: Person[]; nameChecks: NameCheck[]; squads: PeopleSquad[]; jobs: JobChoice[]; moreJobs: JobChoice[]; tools: string[];
    specialists?: Specialist[];
}
/** A staff link: one job (never Admin), 7 days or 10 uses, and who joined through it. `code` and `path` only while ACTIVE. */
export interface StaffLink {
    tools?: string[];
    id: number; job: string; title: string; clubWide: boolean; squads: PeopleSquad[];
    status: 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'REVOKED'; code: string | null; path: string | null;
    uses: number; maxUses: number; expiresAt: string; createdAt: string; createdById: number | null; createdByName: string | null;
    joined: { appointmentId: number; userId: number; name: string; avatarUrl: string | null; joinedAt: string; status: string; revision: number | null }[];
}
export interface InviteLink { token: string; expiresAt: string }
/**
 * `name` is always the name the inviter typed and `userId` may be null: the answer never says whether the address
 * already has an account. `status`: INVITED, SUGGESTED (a head coach's; no link until an admin confirms) or ADMIN_INVITED.
 */
export interface InviteResult { userId: number | null; name: string; inApp: boolean; link: InviteLink | null; status?: 'INVITED' | 'SUGGESTED' | 'ADMIN_INVITED' }
export interface SuggestionAnswer { appointmentId: number; outcome: 'CONFIRMED' | 'DECLINED'; answeredBy: string | null; link: InviteLink | null }
/** A job and where it applies, as the forms edit it. `job` is a main job, another bundle's key or CUSTOM. */
export interface JobDraft { job: string; title: string; tools: string[]; clubWide: boolean; squadIds: number[] }

export const mainJobs = (view: PeopleView) => view.jobs.map(job => job.key);
export const linkJobs = (view: PeopleView) => mainJobs(view).filter(job => job !== 'ADMIN');
/** Link identity includes the title; legacy Custom links also retain their exact tools. */
export const staffLinkMatches = (link: StaffLink, draft: JobDraft, view: PeopleView) => {
    const choice = [...view.jobs, ...view.moreJobs].find(job => job.key === draft.job);
    const title = draft.title.trim() || choice?.titles?.[0] || choice?.title || '';
    const sameTools = (a: string[], b: string[]) => a.every(t => b.includes(t)) && b.every(t => a.includes(t));
    return link.job === draft.job && link.title === title && link.clubWide === draft.clubWide
        && (link.clubWide || link.squads.length === draft.squadIds.length && link.squads.every(s => draft.squadIds.includes(s.id)))
        && (draft.job !== 'CUSTOM' || sameTools(link.tools ?? [], draft.tools));
};

const base = (club: number) => `/clubs/${club}/people`;
const where = (draft: Pick<JobDraft, 'job' | 'clubWide' | 'squadIds'>) => ['ADMIN', 'HEAD_OF_COACHING'].includes(draft.job) ? { clubWide: true, squadIds: [] }
    : { clubWide: draft.clubWide, squadIds: draft.clubWide ? [] : [...draft.squadIds].sort((a, b) => a - b) };
const custom = (draft: Pick<JobDraft, 'job' | 'title' | 'tools'>) => ({ title: draft.title.trim() || null, tools: draft.job === 'CUSTOM' || draft.tools.length ? draft.tools : null });

export const fetchPeople = async (club: number, signal?: AbortSignal) => (await apiClient.get<PeopleView>(base(club), { signal })).data;

/** A new person by name and email, or someone already listed by id. From a head coach it is a suggestion an admin confirms. */
export const invitePerson = async (club: number, person: { name?: string; email?: string; userId?: number }, draft: JobDraft) =>
    (await apiClient.post<InviteResult>(`${base(club)}/invites`, { ...person, job: draft.job, ...custom(draft), ...where(draft) })).data;

/** An Owner's or Admin's change applies at once and is kept in the job's history. */
export const changeJob = async (club: number, job: PersonJob, draft: JobDraft) => {
    await apiClient.put(`${base(club)}/jobs/${job.id}`, { job: draft.job, ...custom(draft), ...where(draft), revision: job.revision });
};

export const newInviteLink = async (club: number, userId: number) => (await apiClient.post<InviteLink>(`${base(club)}/${userId}/link`)).data;

/** What you share with fellow staff: whether they see your email and the phone you added on your profile. */
export interface ContactChoice { hideEmail: boolean; hidePhone: boolean }

/** Your own choice, in every club you work at, sent whole each time. Admins still see emails. */
export const setContactSharing = async (club: number, choice: ContactChoice) => {
    await apiClient.put(`${base(club)}/me/contact`, choice);
};

export const settleNameCheck = async (club: number, check: number, outcome: 'keep' | 'undo') => {
    await apiClient.post(`${base(club)}/name-checks/${check}/${outcome}`);
};

/** Ends a job at once through what it is: a job ends, an Admin stops being one, an invitation is cancelled, a membership is removed. */
export const endJob = async (club: number, userId: number, job: PersonJob) => {
    if (job.kind === 'APPOINTMENT') await apiClient.post(`${base(club)}/jobs/${job.id}/end`, { revision: job.revision });
    else if (job.kind === 'ADMIN') await apiClient.post(`${base(club)}/admins/${userId}/end`);
    else if (job.kind === 'ADMIN_INVITE' || job.kind === 'COACH_INVITE') await cancelClubInvitation(club, job.id);
    else if (job.kind === 'COACH') await removeClubMember(club, userId);
};

/** An admin's answer to a head coach's suggestion; the first answer counts (409 ALREADY_ANSWERED after it). */
export const answerSuggestion = async (club: number, job: Pick<PersonJob, 'id' | 'revision'>, confirm: boolean) =>
    (await apiClient.post<SuggestionAnswer>(`${base(club)}/suggestions/${job.id}`, { confirm, revision: job.revision })).data;

/* Staff links (`/clubs/{club}/staff-links`, Owner and Admins). */
const links = (club: number) => `/clubs/${club}/staff-links`;
export const fetchStaffLinks = async (club: number, signal?: AbortSignal) => (await apiClient.get<StaffLink[]>(links(club), { signal })).data;
export const makeStaffLink = async (club: number, draft: JobDraft, requestId: string) =>
    (await apiClient.post<StaffLink>(links(club), { requestId, job: draft.job, ...custom(draft), ...where(draft) })).data;
export const stopStaffLink = async (club: number, link: number) => (await apiClient.delete<StaffLink>(`${links(club)}/${link}`)).data;
/** Remove someone who joined through a link: their job ends at once. */
export const removeJoined = async (club: number, joined: { appointmentId: number; revision: number | null }) => {
    await apiClient.post(`${base(club)}/jobs/${joined.appointmentId}/end`, { revision: joined.revision });
};

export const inviteUrl = (token: string) => `${window.location.origin}/club-invite?token=${encodeURIComponent(token)}`;
export const staffLinkUrl = (link: Pick<StaffLink, 'code' | 'path'>) => `${window.location.origin}${link.path ?? `/staff-invite/${encodeURIComponent(link.code ?? '')}`}`;
export const whatsAppUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** The job a person holds or is invited to, as a draft the forms can change. */
export const draftOf = (job: PersonJob): JobDraft => ({
    job: job.job, title: job.title, tools: job.job === 'CUSTOM' ? job.tools : [],
    clubWide: job.clubWide, squadIds: job.squads.map(s => s.id),
});

export type Suggestion = { person: Person; job: PersonJob };
/** Head coaches' suggestions waiting for an admin: jobs with status SUGGESTED. */
export const suggestionsIn = (people: Person[]): Suggestion[] =>
    people.flatMap(person => person.jobs.filter(job => job.status === 'SUGGESTED').map(job => ({ person, job })));

/** A link was refused because the person has their own account: they get the invitation in the app, never a link. */
export const isOwnAccount = (failure: unknown) => extractApiErrorCode(failure) === 'NOT_AN_INVITE_ACCOUNT';
