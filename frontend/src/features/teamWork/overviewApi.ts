import { apiClient } from '../../api/axiosConfig';
import type { Person, WorkQuestion, WorkRef, WorkStatus } from './api';

/** What happened to a task: added, moved to a status, a question asked or answered. */
export type EventKind = 'ADDED' | 'STATUS' | 'ASKED' | 'ANSWERED';
/**
 * One line of the agenda. `status` is the status the event set; for a question, the task's status now. `text` says
 * what changed: the author's update, the task's description, the question or the answer. `parentId` marks a step.
 */
export interface WorkEvent {
    id: string; kind: EventKind; at: string; task: WorkRef; parentId: number | null; status: WorkStatus; previousStatus: WorkStatus | null;
    by: Person | null; text: string | null; question: string | null;
}
export interface Timeline { events: WorkEvent[]; more: boolean }
/** A question nobody has answered yet, with its task. */
export interface OpenQuestion { question: WorkQuestion; task: WorkRef; parentId: number | null }
/** A plan or a task kept on top of your own Overview. */
export interface WorkPin { id: number; planId: number | null; itemId: number | null; at: string }

const base = '/team-work';
const data = <T>(request: Promise<{ data: T }>) => request.then(response => response.data);
/** Events older than `before` (the newest when left out), newest first. */
export const fetchTimeline = (before: string | null, signal?: AbortSignal) => data(apiClient.get<Timeline>(`${base}/timeline`, { params: before ? { before } : {}, signal }));
export const fetchOpenQuestions = (signal?: AbortSignal) => data(apiClient.get<OpenQuestion[]>(`${base}/open-questions`, { signal }));
export const fetchPins = (signal?: AbortSignal) => data(apiClient.get<WorkPin[]>(`${base}/pins`, { signal }));
export const addPin = (target: { planId: number } | { itemId: number }) => data(apiClient.post<WorkPin[]>(`${base}/pins`, target));
export const removePin = (id: number) => data(apiClient.delete<WorkPin[]>(`${base}/pins/${id}`));
