import { apiClient } from '../../api/axiosConfig';

/** Mirrors the backend's TeamSearchDto. */
export type SearchGroup = 'WORK' | 'CHATS' | 'FILES';
export type HitKind = 'TASK' | 'STEP' | 'IDEA' | 'WAITING' | 'PLAN' | 'NOW' | 'MESSAGE' | 'CHAT_FILE' | 'TASK_FILE';
/** Matched words: `text.slice(start, end)`. */
export interface SearchMark { start: number; end: number }
/** Why it matched: the part that matched best (NAME, PURPOSE, COMMENT, SENT_WITH, MEANING…), who wrote it, the words. */
export interface SearchWhy { field: string; by: string | null; text: string; marks: SearchMark[] }
export interface SearchRef { id: number; name: string | null }
export interface SearchTaskRef { id: number; key: string; title: string; status: string }
/** Where it is: key and status, plan, the task a step belongs to, chat, person, when, the tasks it is about. */
export interface SearchWhere {
    key: string | null; status: string | null; plan: SearchRef | null; parent: SearchTaskRef | null; chat: SearchRef | null;
    person: SearchRef | null; at: string | null; tasks: SearchTaskRef[] | null; openTasks: number | null;
}
/** What to open: a task (and its step), an idea or waiting item, a plan, a Now note, or a chat message. */
export interface SearchOpen {
    task: number | null; step: number | null; plan: number | null; view: 'ideas' | 'waiting' | null; who: number | null;
    message: number | null; conversation: number | null;
}
export interface SearchFile { kind: 'IMAGE' | 'VIDEO' | 'FILE'; name: string | null; url: string; thumbUrl: string | null; contentType: string; width: number | null; height: number | null }
/** `deleted`: from a chat in Recently deleted (only when asked for; always after the live results, shown grey). */
export interface SearchHit { kind: HitKind; id: number; title: string | null; why: SearchWhy | null; where: SearchWhere; open: SearchOpen; file: SearchFile | null; deleted: boolean }
export interface SearchGroupHits { group: SearchGroup; hits: SearchHit[]; more: boolean }
/** The groups that found something, the best first; `askBest`: vague enough to ask for the best matches. */
export interface SearchResults { query: string; words: string[]; groups: SearchGroupHits[]; askBest: boolean }
export type BestStatus = 'PICKED' | 'NONE' | 'SURE' | 'OFF' | 'LIMIT_YOU' | 'LIMIT_TEAM' | 'FAILED';
export interface BestMatches { status: BestStatus; hits: SearchHit[] }
/** A result as a reference, for "Not what I was looking for". */
export interface ResultRef { kind: HitKind; id: number }
export interface MissedSearch { id: number; query: string; by: SearchRef; at: string; shown: number; opened: SearchHit | null; openedAt: string | null }
/** What the box offers this person: "What search missed" (team admins and those named for it), and the deleted-chats switch. */
export interface SearchOptions { seesMissed: boolean; deletedChats: number }

const base = '/team-work/search';
const data = <T>(request: Promise<{ data: T }>) => request.then(response => response.data);

/** `deleted`: also the person's chats in Recently deleted. */
export const searchTeam = (q: string, signal?: AbortSignal, page?: { group: SearchGroup; offset: number; limit: number }, deleted = false) =>
    data(apiClient.get<SearchResults>(base, { params: { q, ...page, ...(deleted ? { deleted: true } : {}) }, signal }));
export const fetchSearchOptions = (signal?: AbortSignal) => data(apiClient.get<SearchOptions>(`${base}/options`, { signal }));
/** One paid call at most, only for a vague search; the server decides and caps it. */
export const fetchBestMatches = (q: string, signal?: AbortSignal) => data(apiClient.post<BestMatches>(`${base}/best`, { q }, { signal }));
export const reportMiss = (q: string, shown: ResultRef[]) => data(apiClient.post<{ id: number }>(`${base}/feedback`, { q, shown }));
export const reportOpened = (id: number, opened: ResultRef) => apiClient.put(`${base}/feedback/${id}/opened`, opened).then(() => undefined);
export const fetchMissed = (signal?: AbortSignal) => data(apiClient.get<{ items: MissedSearch[] }>(`${base}/feedback`, { params: { limit: 30 }, signal })).then(page => page.items);
