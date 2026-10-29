import { apiClient } from '../../api/axiosConfig';
import type { WorkComment, WorkMedia } from '../../components/work/types';

// ── A club's projects (step 4 of the club plan): Team work's planner, narrowed for clubs ──
// One goal the club is working towards: steps that each wait on one person, photos and files, one talk thread, and
// optionally a fundraiser as its money part. Everyone on a project sees the same project; `can` says which buttons work.

export type ProjectStatus = 'NOW' | 'LATER' | 'IDEA' | 'DONE';
/** Only fills in the first steps; never kept. */
export type ProjectKind = 'RAISE_MONEY' | 'BUY_SOMETHING' | 'FIND_SPONSOR' | 'FIX_OR_BUILD';
export type Currency = 'GEL' | 'EUR' | 'GBP' | 'USD';

export interface ProjectPerson { id: number; name: string; avatarUrl: string | null }
export interface ProjectSquad { id: number; name: string }
export interface Money { amount: number; currency: Currency }
export interface ProjectCan { change: boolean; addPeople: boolean; talk: boolean; startFundraiser: boolean; publish: boolean }

/** A line in the list. Progress comes from the money when there is a target, otherwise from the steps. */
export interface ProjectSummary {
    id: number; goal: string; status: ProjectStatus; squad: ProjectSquad | null; dueOn: string | null;
    target: Money | null; raised: number | null; progress: number; progressFromMoney: boolean;
    stepsDone: number; stepsTotal: number; nextStep: string | null; people: ProjectPerson[];
    waitingOnMe: number; fundraiserStatus: string | null; updatedAt: string;
}
export interface WaitingStep { projectId: number; project: string; stepId: number; step: string; day: string | null }
export interface ProjectClub { id: number; name: string; crestUrl: string | null }
/** What a project or a step can be given to: the club's squads and the people on its staff. */
export interface ProjectChoices { squads: ProjectSquad[]; people: ProjectPerson[] }
/** Who the person is at the club, for the side bar: their club role and open jobs; neither for someone only on a project. */
export interface ProjectYou { role: string | null; jobs: string[] }
export interface ProjectBoard { club: ProjectClub; needsYou: WaitingStep[]; projects: ProjectSummary[]; canStart: boolean; choices: ProjectChoices | null; you?: ProjectYou }
/** A club where this person has projects, or may start one. */
export interface MyProjects { club: ProjectClub; open: number; waitingOnMe: number; canStart: boolean }

export interface ProjectStep { id: number; title: string; done: boolean; person: ProjectPerson | null; day: string | null; mine: boolean; canChange: boolean; version: number }
export interface HistoryLine { at: string; by: ProjectPerson | null; byDola: boolean; text: string }

/** The money part. The amount is always the club's own report, with who reported it and when. */
export interface ProjectFundraiser {
    id: number; status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED'; phase: string; donateUrl: string | null;
    goal: Money | null; reportedAmount: number | null; reportedNote: string; reportedBy: ProjectPerson | null; reportedAt: string | null;
    publishedBy: ProjectPerson | null; publishedAt: string | null; clubVerified: boolean; publicNow: boolean; version: number;
    /** What the editor changes, as it is now. */
    currency: Currency; summary: string; description: string; beneficiary: string; useOfFunds: string; category: string;
    startsOn: string | null; endsOn: string | null; images: string[];
}

export interface ProjectDetail {
    summary: ProjectSummary; purpose: string | null; version: number; startedBy: ProjectPerson | null;
    steps: ProjectStep[]; talk: WorkComment[]; files: WorkMedia[]; history: HistoryLine[];
    fundraiser: ProjectFundraiser | null; can: ProjectCan; club: ProjectClub | null;
    /** For those who change the project: what it and its steps can be given to. */
    choices: ProjectChoices | null;
    you?: ProjectYou;
}

export interface NewProject { goal: string; kind?: ProjectKind; squadId?: number | null; dueOn?: string | null; purpose?: string | null; status?: Exclude<ProjectStatus, 'DONE'>; steps?: string[]; language?: 'en' | 'ka' }
/** Absent fields stay as they are; the clear flags empty one. */
export interface ProjectChange {
    version: number; goal?: string; purpose?: string; squadId?: number; clearSquad?: boolean; dueOn?: string; clearDueOn?: boolean;
    target?: Money; clearTarget?: boolean; status?: ProjectStatus;
}
export interface StepChange { version: number; title?: string; personId?: number; clearPerson?: boolean; day?: string; clearDay?: boolean; done?: boolean }
export interface PasteLine { line: number; title: string; person: ProjectPerson | null; day: string | null; problem: string | null }
export interface PasteResult { steps: PasteLine[]; problems: string[]; project: ProjectDetail | null }
export interface FundraiserInput {
    version?: number; summary?: string; description?: string; beneficiary?: string; useOfFunds?: string;
    category?: string; donateUrl?: string; startsOn?: string | null; endsOn?: string | null; images?: string[];
}

const base = (clubId: number) => `/clubs/${clubId}/projects`;
const data = <T>(request: Promise<{ data: T }>) => request.then(response => response.data);
// A command sent twice with the same words within a few seconds (a double click, a retry after a lost answer) carries
// the same Idempotency-Key, so the server does it once and answers both with the project as it is.
const recent = new Map<string, { key: string; at: number }>();
const once = (url: string, body: unknown) => {
    const what = `${url} ${JSON.stringify(body)}`, now = Date.now();
    for (const [sent, { at }] of recent) if (now - at > 10_000) recent.delete(sent);
    const key = recent.get(what)?.key ?? crypto.randomUUID();
    recent.set(what, { key, at: recent.get(what)?.at ?? now });
    return { headers: { 'Idempotency-Key': key } };
};
const command = <T>(url: string, body: unknown, method: 'post' | 'put' = 'post') => data(apiClient[method]<T>(url, body, once(url, body)));

export const fetchMyProjects = (signal?: AbortSignal) => data(apiClient.get<MyProjects[]>('/projects/mine', { signal }));
/** A project by its id alone, as the Inbox opens it. */
export const fetchProjectById = (id: number, signal?: AbortSignal) => data(apiClient.get<ProjectDetail>(`/projects/${id}`, { signal }));
/** Where a fundraiser's project is, for its old manager links. */
export const fetchFundraiserPlace = (campaignId: number, signal?: AbortSignal) => data(apiClient.get<{ clubId: number; projectId: number }>(`/projects/fundraisers/${campaignId}`, { signal }));
export const fetchProjects = (clubId: number, signal?: AbortSignal) => data(apiClient.get<ProjectBoard>(base(clubId), { signal }));
export const fetchProject = (clubId: number, id: number, signal?: AbortSignal) => data(apiClient.get<ProjectDetail>(`${base(clubId)}/${id}`, { signal }));
/** start_project */
export const startProject = (clubId: number, request: NewProject) => command<ProjectDetail>(base(clubId), request);
/** change_project */
export const changeProject = (clubId: number, id: number, change: ProjectChange) => data(apiClient.patch<ProjectDetail>(`${base(clubId)}/${id}`, change));
/** add_step */
export const addStep = (clubId: number, id: number, step: { title: string; personId?: number | null; day?: string | null }) => command<ProjectDetail>(`${base(clubId)}/${id}/steps`, step);
/** change_step, finish_step */
export const changeStep = (clubId: number, id: number, stepId: number, change: StepChange) => data(apiClient.patch<ProjectDetail>(`${base(clubId)}/${id}/steps/${stepId}`, change));
export const removeStep = (clubId: number, id: number, stepId: number) => data(apiClient.delete<ProjectDetail>(`${base(clubId)}/${id}/steps/${stepId}`));
export const orderSteps = (clubId: number, id: number, order: number[]) => data(apiClient.put<ProjectDetail>(`${base(clubId)}/${id}/steps/order`, { order }));
export const addPerson = (clubId: number, id: number, userId: number) => data(apiClient.post<ProjectDetail>(`${base(clubId)}/${id}/people`, { userId }));
/** A parent or volunteer just added: a claim link for an account this request made (the same on a retry), or none. */
export interface HelperAdded { userId: number | null; name: string; link: string | null; linkExpiresAt: string | null; invitationPending: boolean; project: ProjectDetail }
/** add_helper: a parent or volunteer on this project, by name and email, as a squad's session helpers are added. */
export const addHelper = (clubId: number, id: number, helper: { name: string; email: string; requestId: string }) =>
    command<HelperAdded>(`${base(clubId)}/${id}/helpers`, helper);
/** A project a parent or volunteer helps on, with the steps waiting on them: their Home card. */
export interface HelpingProject { projectId: number; goal: string; club: ProjectClub | null; steps: WaitingStep[] }
export const fetchHelping = (signal?: AbortSignal) => data(apiClient.get<HelpingProject[]>('/projects/helping', { signal }));
export const removePerson = (clubId: number, id: number, userId: number) => data(apiClient.delete<ProjectDetail>(`${base(clubId)}/${id}/people/${userId}`));
/** talk */
export const talk = (clubId: number, id: number, body: string) => command<ProjectDetail>(`${base(clubId)}/${id}/talk`, { body });
export const editTalk = (clubId: number, id: number, commentId: number, body: string) => data(apiClient.patch<ProjectDetail>(`${base(clubId)}/${id}/talk/${commentId}`, { body }));
export const removeTalk = (clubId: number, id: number, commentId: number) => data(apiClient.delete<ProjectDetail>(`${base(clubId)}/${id}/talk/${commentId}`));
export const addPicture = (clubId: number, id: number, file: File) => { const form = new FormData(); form.append('file', file); return data(apiClient.post<ProjectDetail>(`${base(clubId)}/${id}/pictures`, form)); };
/** A quote, a PDF, a spreadsheet: the request body is the file, streamed to storage. */
export const addFile = (clubId: number, id: number, file: File, onProgress?: (share: number) => void) => data(apiClient.post<ProjectDetail>(`${base(clubId)}/${id}/files`, file, {
    params: { name: file.name }, headers: { 'Content-Type': 'application/octet-stream' }, timeout: 0, onUploadProgress: event => { if (event.total) onProgress?.(event.loaded / event.total); },
}));
export const removeFile = (clubId: number, id: number, fileId: number) => data(apiClient.delete<ProjectDetail>(`${base(clubId)}/${id}/files/${fileId}`));
/** paste_plan: `apply: false` previews. */
export const pastePlan = (clubId: number, id: number, text: string, apply: boolean) => apply
    ? command<PasteResult>(`${base(clubId)}/${id}/paste`, { text, apply }) : data(apiClient.post<PasteResult>(`${base(clubId)}/${id}/paste`, { text, apply }));
/** start_fundraiser */
export const startFundraiser = (clubId: number, id: number, input: FundraiserInput) => command<ProjectDetail>(`${base(clubId)}/${id}/fundraiser`, input);
/** change_fundraiser */
export const changeFundraiser = (clubId: number, id: number, input: FundraiserInput & { version: number }) => command<ProjectDetail>(`${base(clubId)}/${id}/fundraiser`, input, 'put');
/** report_amount; a new currency changes the fundraiser's (and the target's) with it. */
export const reportAmount = (clubId: number, id: number, version: number, amount: number, note?: string, currency?: Currency, target?: number) =>
    command<ProjectDetail>(`${base(clubId)}/${id}/fundraiser/amount`, { version, amount, note, currency, target });
/** post_fundraiser_update: news for the supporters on the public page. */
export const postFundraiserUpdate = (clubId: number, id: number, version: number, title: string, body: string) => command<ProjectDetail>(`${base(clubId)}/${id}/fundraiser/updates`, { version, title, body });
/** publish_fundraiser, or pause or close it. */
export const moveFundraiser = (clubId: number, id: number, version: number, status: 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED') => command<ProjectDetail>(`${base(clubId)}/${id}/fundraiser/state`, { version, status });

/** The example "Paste a plan" offers: one step a line, a person and a day after "|". */
export const PASTE_PLAN_EXAMPLE = `- Ask families for sizes | Nana
- Get two quotes | Irakli | ends 2026-11-07
- Choose a quote
- Order and pay | Giorgi
- Hand out at training`;
