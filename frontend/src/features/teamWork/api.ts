import { apiClient } from '../../api/axiosConfig';
import type { Commit, Repo } from './upToDate';

/** The pipeline: planned → in progress → needs your look → accepted → live; blocked sits beside it, cancelled after its end. */
export const STATUSES = ['PLANNED', 'IN_PROGRESS', 'NEEDS_LOOK', 'ACCEPTED', 'LIVE', 'BLOCKED', 'CANCELLED'] as const;
export type WorkStatus = typeof STATUSES[number];
/** What moves first, for lists. */
export const LIST_ORDER: WorkStatus[] = ['IN_PROGRESS', 'NEEDS_LOOK', 'BLOCKED', 'PLANNED', 'ACCEPTED', 'LIVE', 'CANCELLED'];
/** Accepted or live: nothing left to do on it. */
export const isDone = (status: WorkStatus) => status === 'ACCEPTED' || status === 'LIVE';
/** Work nobody does any more: live, or cancelled (decided not to do, kept instead of deleted). These sink to the quiet grey rows at the bottom. */
export const isGone = (status: WorkStatus) => status === 'LIVE' || status === 'CANCELLED';
/** A short name reads at a glance; longer words belong in “What it’s for”. Only a hint: longer names still save. */
export const NAME_LIMIT = 30;
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
    /** The task's team chat, if it has one, and how many messages it holds; `chatPrivate`: its chat is for chosen people you are not in. */
    chatId?: number | null; chatMessages?: number; chatPrivate?: boolean;
}
export interface WorkUpdate {
    id: number; author: Person | null; at: string; previousStatus: WorkStatus | null; status: WorkStatus | null;
    previousPercent: number | null; percent: number | null; message: string | null;
    /** Done by Agent Dola for the author, after they approved its preview. */
    byDola?: boolean;
}
/** A picture, a video or any other file; `name` is the file's own name (files only); `title` and `tags` what people named and tagged it. */
export interface WorkMedia {
    id: number; kind: 'IMAGE' | 'VIDEO' | 'FILE'; url: string; contentType: string; sizeBytes: number; uploadedBy: Person | null; createdAt: string; canDelete: boolean;
    name?: string | null; title?: string | null; tags?: string[]; labelledBy?: Person | null; labelledAt?: string | null;
}
export interface WorkComment { id: number; author: Person | null; body: string; createdAt: string; editedAt: string | null; canEdit: boolean; byDola?: boolean }
export interface WorkSwitch { itemId: number; title: string; at: string }
/** Every task, the trail, and the team with each person's responsibility. */
export interface Board { items: WorkItem[]; trail: WorkSwitch[]; canManageTeam: boolean; team: Member[] }
/** What a plan or a task is for, changed: the old purpose stays beside the new one. */
export interface PurposeChange { id: number; author: Person | null; at: string; previous: string | null; purpose: string | null; byDola?: boolean }
/** A task opened: its history, steps, questions, the live commits naming its key, files, comments and how its purpose changed. */
export interface Detail { item: WorkItem; updates: WorkUpdate[]; steps: WorkItem[]; questions: WorkQuestion[]; foundCommits: Commit[]; media: WorkMedia[]; comments: WorkComment[]; purposeChanges: PurposeChange[] }
/** Whether a plan is being worked on now, comes later, or is finished. */
export type PlanStatus = 'NOW' | 'LATER' | 'FINISHED';
/** The plan another plan is part of. */
export interface PlanRef { id: number; name: string; purpose: string | null }
/**
 * A plan, with what its box shows: what it is for, its progress (tasks and the plans that are its steps), the plan it
 * is part of, and `live` when it is finished or every task that is not cancelled is live (as a step of another plan
 * it is then complete). A cancelled task counts in no percent.
 */
export interface Plan {
    id: number; name: string; purpose: string | null; copiedFrom: number | null; copiedFromName: string | null; version: number; taskCount: number; updatedBy: Person | null; updatedAt: string; createdAt: string;
    status: PlanStatus; percent: number; inProgress: number; toDo: number; done: number; cancelled?: number; needsYou: number; nextTask: string | null; partOf: PlanRef | null; live: boolean;
}
/** How many of a plan's tasks are still open: not done and not cancelled. */
export const openCount = (plan: Plan) => plan.taskCount - plan.done - (plan.cancelled ?? 0);
export interface PlanChange { id: number; author: Person | null; at: string; message: string; byDola?: boolean }
export interface WorkNode { item: WorkItem; steps: WorkItem[] }
/** A plan opened: its tasks, the plans that are its steps (in order), its history and how its purpose changed. */
export interface PlanView { plan: Plan; tasks: WorkNode[]; steps: Plan[]; changes: PlanChange[]; purposeChanges: PurposeChange[]; trail: WorkSwitch[]; team: Person[]; canManageTeam: boolean }
/** Someone on the team, with their one-line responsibility ("Agent Dola") and their Now note, with when they changed it. */
export interface Member { userId: number; name: string | null; email: string; admin: boolean; addedAt: string | null; pending: boolean; responsibility?: string | null; now?: string | null; nowAt?: string | null }
/** What a person is doing, in their own words (only they change it), with teammates' comments under it, oldest first. */
export interface NowNote { person: Person; body: string | null; updatedAt: string | null; canEdit: boolean; comments: WorkComment[] }
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
export const createPlan = (name: string, copyFrom?: number, purpose?: string) => data(apiClient.post<PlanView>(`${base}/plans`, { name, copyFrom, purpose }));
/** `purpose` '' clears what the plan is for; the old purpose stays in its history. */
export const changePlan = (id: number, change: { version: number; name?: string; order?: number[]; status?: PlanStatus; purpose?: string }) => data(apiClient.patch<PlanView>(`${base}/plans/${id}`, change));
/** A plan as a step of another: one parent at most, never a cycle. */
export const addPlanStep = (id: number, planId: number) => data(apiClient.post<PlanView>(`${base}/plans/${id}/steps`, { planId }));
export const removePlanStep = (id: number, childId: number) => data(apiClient.delete<PlanView>(`${base}/plans/${id}/steps/${childId}`));
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
/** Where a thread of comments saves (a task's, a Now note's); each call answers with the whole thread. */
export interface CommentActions { add: (body: string) => Promise<WorkComment[]>; edit: (id: number, body: string) => Promise<WorkComment[]>; remove: (id: number) => Promise<WorkComment[]> }
/** The thread under a task. */
export const itemComments = (itemId: number): CommentActions => ({ add: body => addComment(itemId, body), edit: editComment, remove: deleteComment });
export const addPicture = (itemId: number, file: File) => { const form = new FormData(); form.append('file', file); return data(apiClient.post<Detail>(`${base}/items/${itemId}/pictures`, form)); };
/** The video is the request body, streamed to storage; MP4 or WebM up to 90 MB. */
export const addVideo = (itemId: number, file: File, onProgress?: (share: number) => void) => data(apiClient.post<Detail>(`${base}/items/${itemId}/videos`, file, {
    headers: { 'Content-Type': file.type }, timeout: 0, onUploadProgress: event => { if (event.total) onProgress?.(event.loaded / event.total); },
}));
/** Any other file (PDF, text, spreadsheet…) up to 25 MB, kept under its own name: the request body is the file, streamed to storage. */
export const addFile = (itemId: number, file: File, onProgress?: (share: number) => void) => data(apiClient.post<Detail>(`${base}/items/${itemId}/files`, file, {
    params: { name: file.name }, headers: { 'Content-Type': 'application/octet-stream' }, timeout: 0, onUploadProgress: event => { if (event.total) onProgress?.(event.loaded / event.total); },
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
/** One line of responsibility for a team member; '' takes it off. Anyone on the team writes anyone's. */
export const setResponsibility = (userId: number, line: string) => data(apiClient.put<Member[]>(`${base}/team/${userId}/responsibility`, { line }));
export const fetchNow = (userId: number, signal?: AbortSignal) => data(apiClient.get<NowNote>(`${base}/team/${userId}/now`, { signal }));
/** Your own Now note; '' clears it and the comments stay. */
export const writeNow = (userId: number, body: string) => data(apiClient.put<NowNote>(`${base}/team/${userId}/now`, { body }));
/** A teammate's comment tells the note's person; their own reply tells everyone who commented. */
export const addNowComment = (userId: number, body: string) => data(apiClient.post<NowNote>(`${base}/team/${userId}/now/comments`, { body }));
export const editNowComment = (id: number, body: string) => data(apiClient.patch<NowNote>(`${base}/now-comments/${id}`, { body }));
export const deleteNowComment = (id: number) => data(apiClient.delete<NowNote>(`${base}/now-comments/${id}`));

export const VIDEO_LIMIT_MB = 90;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const FILE_LIMIT_MB = 25;
/** What "Add file" takes besides pictures and videos, by extension. */
export const FILE_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'log', 'json', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

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
