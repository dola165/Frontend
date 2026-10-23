import { apiClient } from '../../api/axiosConfig';
import type { Commit, Repo } from './upToDate';

/** The pipeline: planned → in progress → needs your look → accepted → live; blocked sits beside it. */
export const STATUSES = ['PLANNED', 'IN_PROGRESS', 'NEEDS_LOOK', 'ACCEPTED', 'LIVE', 'BLOCKED'] as const;
export type WorkStatus = typeof STATUSES[number];
/** What moves first, for lists. */
export const LIST_ORDER: WorkStatus[] = ['IN_PROGRESS', 'NEEDS_LOOK', 'BLOCKED', 'PLANNED', 'ACCEPTED', 'LIVE'];
/** Accepted or live: nothing left to do on it. */
export const isDone = (status: WorkStatus) => status === 'ACCEPTED' || status === 'LIVE';
export const PRIORITIES = ['NOW', 'NEXT', 'LATER'] as const;
export type Priority = typeof PRIORITIES[number];
export type LinkKind = 'BLOCKED_BY' | 'BLOCKS' | 'RELATED';
export type EndKind = 'DATE' | 'ABOUT' | 'POSSIBLY' | 'UNKNOWN';
export type EndUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

/** When a task is expected to end: an exact day, about N units from the start, possibly a month, or not known. */
export interface WorkEnd { kind: EndKind; date?: string | null; amount?: number | null; unit?: EndUnit | null }
export interface Person { id: number | null; name: string | null }
/** Another task named from this one. */
export interface WorkRef { id: number; key: string; title: string; status: WorkStatus }
export interface WorkLink { kind: LinkKind; task: WorkRef }
/** A question for the owner: quick answers (none means yes/no) plus a free one; the answer stays with it. */
export interface WorkQuestion { id: number; text: string; options: string[]; askedBy: Person | null; at: string; answer: string | null; answeredBy: Person | null; answeredAt: string | null }
/**
 * A task, or a step of one (`parentId` set). The brief: done means, priority, who asked, links. The report: tested,
 * branch, commits, questions. `percent` is null when nobody estimates it; `waitingOn` names the blockers not done.
 */
export interface WorkItem {
    id: number; key: string; title: string; area: string | null; status: WorkStatus; percent: number | null; step: string | null; notes: string | null;
    branch: string | null; prUrl: string | null; version: number; updatedBy: Person | null; updatedAt: string; createdAt: string;
    parentId: number | null; description: string | null; startedOn: string | null; end: WorkEnd; percentFromSteps: boolean;
    people: Person[]; mediaCount: number; commentCount: number; small: boolean;
    doneMeans: string | null; tested: string | null; commits: string | null; priority: Priority | null; requestedBy: Person | null;
    links: WorkLink[]; waitingOn: WorkRef[]; openQuestions: number;
}
export interface WorkUpdate {
    id: number; author: Person | null; at: string; previousStatus: WorkStatus | null; status: WorkStatus | null;
    previousPercent: number | null; percent: number | null; message: string | null;
    /** Done by Agent Dola for the author, after they approved its preview. */
    byDola?: boolean;
}
export interface WorkMedia { id: number; kind: 'IMAGE' | 'VIDEO'; url: string; contentType: string; sizeBytes: number; uploadedBy: Person | null; createdAt: string; canDelete: boolean }
export interface WorkComment { id: number; author: Person | null; body: string; createdAt: string; editedAt: string | null; canEdit: boolean; byDola?: boolean }
export interface WorkSwitch { itemId: number; title: string; at: string }
export interface Board { items: WorkItem[]; trail: WorkSwitch[]; canManageTeam: boolean }
/** A task opened: its history, steps, questions, the live commits naming its key, files and comments. */
export interface Detail { item: WorkItem; updates: WorkUpdate[]; steps: WorkItem[]; questions: WorkQuestion[]; foundCommits: Commit[]; media: WorkMedia[]; comments: WorkComment[] }
/** Whether a plan is being worked on now, comes later, or is finished. */
export type PlanStatus = 'NOW' | 'LATER' | 'FINISHED';
/** A plan, with what its box shows. */
export interface Plan {
    id: number; name: string; copiedFrom: number | null; copiedFromName: string | null; version: number; taskCount: number; updatedBy: Person | null; updatedAt: string; createdAt: string;
    status: PlanStatus; percent: number; inProgress: number; toDo: number; done: number; needsYou: number; nextTask: string | null;
}
export interface PlanChange { id: number; author: Person | null; at: string; message: string; byDola?: boolean }
export interface WorkNode { item: WorkItem; steps: WorkItem[] }
export interface PlanView { plan: Plan; tasks: WorkNode[]; changes: PlanChange[]; trail: WorkSwitch[]; team: Person[]; canManageTeam: boolean }
export interface Member { userId: number; name: string | null; email: string; admin: boolean; addedAt: string | null; pending: boolean }
export interface Invite { userId: number; email: string; token: string; expiresAt: string }
export interface PasteLine { line: number; action: 'NEW' | 'UPDATED' | 'MOVED' | 'UNCHANGED' | 'DELETED'; title: string; parent: string | null; detail: string | null }
export interface PasteResult { created: number; updated: number; moved: number; unchanged: number; deleted: number; lines: PasteLine[]; problems: string[]; applied: boolean; view: PlanView | null }
/** One thing a report sets: the field, what happens to it and the value. */
export interface ReportLine { field: 'status' | 'branch' | 'pr' | 'commits' | 'percent' | 'tested' | 'question' | 'summary'; action: 'SET' | 'SAME' | 'ADDED'; detail: string }
export interface ReportResult { lines: ReportLine[]; problems: string[]; applied: boolean; detail: Detail | null }

export interface NewWork {
    title: string; area?: string; status: WorkStatus; percent?: number | null; step?: string; notes?: string; branch?: string; prUrl?: string; planId?: number; parentId?: number;
    description?: string; startedOn?: string; end?: WorkEnd; people?: number[]; small?: boolean;
    doneMeans?: string; tested?: string; commits?: string; priority?: Priority | null; requestedBy?: number | null; blockedBy?: number[]; related?: number[];
}
/**
 * Fields left out stay as they are; an empty text clears one, `percent` -1 clears the percent, `priority` '' and
 * `requestedBy` 0 clear those. `version` is the one on screen. `blockedBy` and `related` are the full lists.
 */
export interface WorkChange extends Partial<Omit<NewWork, 'status' | 'planId' | 'parentId' | 'priority' | 'requestedBy'>> {
    version: number; status?: WorkStatus; update?: string; percentFromSteps?: boolean; priority?: Priority | ''; requestedBy?: number;
}

const base = '/team-work';
const data = <T>(request: Promise<{ data: T }>) => request.then(response => response.data);
export const fetchBoard = (signal?: AbortSignal) => data(apiClient.get<Board>(base, { signal }));
export const fetchDetail = (id: number, signal?: AbortSignal) => data(apiClient.get<Detail>(`${base}/items/${id}`, { signal }));
export const createWork = (work: NewWork) => data(apiClient.post<Detail>(`${base}/items`, work));
export const changeWork = (id: number, change: WorkChange) => data(apiClient.patch<Detail>(`${base}/items/${id}`, change));
/** Deletes a task with its steps, history, comments and files; the plans that held it keep a line saying so. */
export const deleteWork = (id: number) => apiClient.delete(`${base}/items/${id}`).then(() => undefined);
export const fetchPlans = (signal?: AbortSignal) => data(apiClient.get<Plan[]>(`${base}/plans`, { signal }));
export const fetchPlan = (id: number, signal?: AbortSignal) => data(apiClient.get<PlanView>(`${base}/plans/${id}`, { signal }));
export const createPlan = (name: string, copyFrom?: number) => data(apiClient.post<PlanView>(`${base}/plans`, { name, copyFrom }));
export const changePlan = (id: number, change: { version: number; name?: string; order?: number[]; status?: PlanStatus }) => data(apiClient.patch<PlanView>(`${base}/plans/${id}`, change));
export const pasteIntoPlan = (id: number, text: string, apply: boolean) => data(apiClient.post<PasteResult>(`${base}/plans/${id}/paste`, { text, apply }));
/** A worker's report onto a task: a preview first, then apply. */
export const pasteReport = (itemId: number, text: string, apply: boolean) => data(apiClient.post<ReportResult>(`${base}/items/${itemId}/report`, { text, apply }));
export const askQuestion = (itemId: number, text: string, options: string[]) => data(apiClient.post<Detail>(`${base}/items/${itemId}/questions`, { text, options }));
/** An option or free words; '' takes the answer back. */
export const answerQuestion = (questionId: number, answer: string) => data(apiClient.patch<Detail>(`${base}/questions/${questionId}`, { answer }));
export const deleteQuestion = (questionId: number) => data(apiClient.delete<Detail>(`${base}/questions/${questionId}`));
export const addComment = (itemId: number, body: string) => data(apiClient.post<WorkComment[]>(`${base}/items/${itemId}/comments`, { body }));
export const editComment = (id: number, body: string) => data(apiClient.patch<WorkComment[]>(`${base}/comments/${id}`, { body }));
export const deleteComment = (id: number) => data(apiClient.delete<WorkComment[]>(`${base}/comments/${id}`));
export const addPicture = (itemId: number, file: File) => { const form = new FormData(); form.append('file', file); return data(apiClient.post<Detail>(`${base}/items/${itemId}/pictures`, form)); };
/** The video is the request body, streamed to storage; MP4 or WebM up to 90 MB. */
export const addVideo = (itemId: number, file: File, onProgress?: (share: number) => void) => data(apiClient.post<Detail>(`${base}/items/${itemId}/videos`, file, {
    headers: { 'Content-Type': file.type }, timeout: 0, onUploadProgress: event => { if (event.total) onProgress?.(event.loaded / event.total); },
}));
export const deleteMedia = (itemId: number, mediaId: number) => data(apiClient.delete<Detail>(`${base}/items/${itemId}/media/${mediaId}`));
/** A ten-minute link a video element can stream from. */
export const playLink = (itemId: number, mediaId: number) => data(apiClient.get<{ url: string; expiresAt: string }>(`${base}/items/${itemId}/media/${mediaId}/play`));
/** The commits baked into the running backend (the web app carries its own, see upToDate.ts). */
export const fetchVersions = (signal?: AbortSignal) => data(apiClient.get<{ backend: Repo }>(`${base}/versions`, { signal }));
export const fetchTeam = (signal?: AbortSignal) => data(apiClient.get<Member[]>(`${base}/team`, { signal }));
export const addMember = (email: string) => data(apiClient.post<{ members: Member[]; invite: Invite | null }>(`${base}/team`, { email }));
export const newInvite = (userId: number) => data(apiClient.post<Invite>(`${base}/team/${userId}/invite`));
export const removeMember = (userId: number) => data(apiClient.delete<Member[]>(`${base}/team/${userId}`));

export const VIDEO_LIMIT_MB = 90;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];

/** What the paste box accepts, shown as its example. */
export const PASTE_EXAMPLE = `plan: Registration and roles
- [in progress, now] GK-12 User registration | started 20 Oct | ends ~2 weeks | Beqa, Gio | 60% | done: a new person signs up with a code
  - [live] Email codes
  - [in progress] Ages 13–15 with a parent | ends possibly November
- [planned, next] Define roles and what each can do | desc: Player, parent, coach, club admin | requested by Beqa | blocked by GK-12
- [planned] The flow after sign-up | ends don't know | related GK-12
- [planned, small] Fix the Save button on phones`;

/** What Paste report accepts, shown as its example. */
export const REPORT_EXAMPLE = `report: GK-12
status: needs your look
branch: golive/registration-f
pr: https://github.com/dola165/Frontend/pull/12
commits: 1b682702 Registration: the code step; e7975c31 ages 13–15
percent: 80
summary: Sign-up with a code works; the parent step is next.
tested: unit tests and npm run check green; signed up on a phone.
  Not run: the e-mail provider in test mode (no key on this PC).
question: Should the code expire after 10 minutes or 30? | 10 | 30
question: Is the parent step needed for 16–17 too?`;

/** The tasks of the week the board opened with, approximate; a system admin loads them once. */
export const STARTER_WORK: NewWork[] = [
    { title: 'Registration', area: 'Sign-up · 6-digit email codes, ages 13–15', status: 'IN_PROGRESS', percent: 30, step: 'Waiting for email provider' },
    { title: 'Page creation', area: 'Create-a-page step', status: 'BLOCKED', percent: 45 },
    { title: 'Branding and landing', area: 'Landing · founders’ design', status: 'IN_PROGRESS', percent: 70, step: 'Cloudflare lock' },
    { title: 'Sign-in loop fix', area: 'Sign-in · CSRF and login limit', status: 'IN_PROGRESS', percent: 80 },
    { title: 'One schedule everywhere', area: 'Schedules', status: 'LIVE', percent: 100 },
    { title: 'Club page facilities', area: 'Club page', status: 'LIVE', percent: 100 },
    { title: 'Set up your profile dialog', area: 'Welcome', status: 'LIVE', percent: 100 },
    { title: 'Parent Hub → Family', area: 'Parents', status: 'PLANNED' },
    { title: 'Agent Dola on live', area: 'Agent Dola', status: 'PLANNED' },
];
