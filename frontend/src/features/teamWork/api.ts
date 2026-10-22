import { apiClient } from '../../api/axiosConfig';

/** Where a piece of work stands, in the order the page lists them. */
export const STATUSES = ['IN_PROGRESS', 'ON_HOLD', 'PLANNED', 'FINISHED'] as const;
export type WorkStatus = typeof STATUSES[number];

export interface Person { id: number | null; name: string | null }
export interface WorkItem {
    id: number; title: string; area: string | null; status: WorkStatus; percent: number; step: string | null; notes: string | null;
    branch: string | null; prUrl: string | null; version: number; updatedBy: Person | null; updatedAt: string; createdAt: string;
}
export interface WorkUpdate {
    id: number; author: Person | null; at: string; previousStatus: WorkStatus | null; status: WorkStatus | null;
    previousPercent: number | null; percent: number | null; message: string | null;
}
export interface WorkSwitch { itemId: number; title: string; at: string }
export interface Board { items: WorkItem[]; trail: WorkSwitch[]; canManageTeam: boolean }
export interface Detail { item: WorkItem; updates: WorkUpdate[] }
export interface Member { userId: number; name: string | null; email: string; admin: boolean; addedAt: string | null }

export interface NewWork { title: string; area?: string; status: WorkStatus; percent?: number; step?: string; notes?: string; branch?: string; prUrl?: string }
/** Fields left out stay as they are; an empty text clears one. `version` is the one on screen. */
export interface WorkChange extends Partial<Omit<NewWork, 'status'>> { version: number; status?: WorkStatus; update?: string }

const base = '/team-work';
export const fetchBoard = (signal?: AbortSignal) => apiClient.get<Board>(base, { signal }).then(response => response.data);
export const fetchDetail = (id: number, signal?: AbortSignal) => apiClient.get<Detail>(`${base}/items/${id}`, { signal }).then(response => response.data);
export const createWork = (work: NewWork) => apiClient.post<Detail>(`${base}/items`, work).then(response => response.data);
export const changeWork = (id: number, change: WorkChange) => apiClient.patch<Detail>(`${base}/items/${id}`, change).then(response => response.data);
export const fetchTeam = (signal?: AbortSignal) => apiClient.get<Member[]>(`${base}/team`, { signal }).then(response => response.data);
export const addMember = (email: string) => apiClient.post<Member[]>(`${base}/team`, { email }).then(response => response.data);
export const removeMember = (userId: number) => apiClient.delete<Member[]>(`${base}/team/${userId}`).then(response => response.data);

/** The pieces of work of the week the board opened with, approximate; a system admin loads them once. */
export const STARTER_WORK: NewWork[] = [
    { title: 'Registration', area: 'Sign-up · 6-digit email codes, ages 13–15', status: 'IN_PROGRESS', percent: 30, step: 'Waiting for email provider' },
    { title: 'Page creation', area: 'Create-a-page step', status: 'ON_HOLD', percent: 45 },
    { title: 'Branding and landing', area: 'Landing · founders’ design', status: 'IN_PROGRESS', percent: 70, step: 'Cloudflare lock' },
    { title: 'Sign-in loop fix', area: 'Sign-in · CSRF and login limit', status: 'IN_PROGRESS', percent: 80 },
    { title: 'One schedule everywhere', area: 'Schedules', status: 'FINISHED', percent: 100 },
    { title: 'Club page facilities', area: 'Club page', status: 'FINISHED', percent: 100 },
    { title: 'Set up your profile dialog', area: 'Welcome', status: 'FINISHED', percent: 100 },
    { title: 'Parent Hub → Family', area: 'Parents', status: 'PLANNED', percent: 0 },
    { title: 'Agent Dola on live', area: 'Agent Dola', status: 'PLANNED', percent: 0 },
];
