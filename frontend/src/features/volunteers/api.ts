import { apiClient } from '../../api/axiosConfig';

export interface VolunteerTask { id: number; label: string; completed: boolean; canToggle: boolean }
export interface VolunteerSignup { id: number; userId: number; name: string; signedUpAt: string }
export interface VolunteerSource { id: number; kind: 'EVENT' | 'TOURNAMENT'; title: string; visibility: string }
export interface VolunteerShift {
  id: number; eventId: number | null; tournamentId: number | null; sourceTitle: string;
  title: string; description: string; meetingPoint: string; startsAt: string; endsAt: string;
  capacity: number; signupCount: number; status: 'OPEN' | 'CANCELLED'; cancellationReason: string | null;
  signedUp: boolean; canManage: boolean; canJoin: boolean; tasks: VolunteerTask[]; volunteers: VolunteerSignup[];
}
export interface SaveVolunteerShift {
  eventId: number | null; tournamentId: number | null; title: string; description: string;
  meetingPoint: string; startsAt: string; endsAt: string; capacity: number; tasks: string[];
}
export type VolunteerView = 'discover' | 'mine' | 'manage';
export interface VolunteerPageResult { items: VolunteerShift[]; hasMore: boolean }
export const listShifts = async (view: VolunteerView, page: number, eventId?: number, tournamentId?: number, signal?: AbortSignal) =>
  (await apiClient.get<VolunteerPageResult>('/volunteer-shifts', { params: { view, page, eventId, tournamentId }, signal })).data;
export const getShift = async (id: number, signal?: AbortSignal) => (await apiClient.get<VolunteerShift>(`/volunteer-shifts/${id}`, { signal })).data;
export const getSources = async (signal?: AbortSignal) => (await apiClient.get<VolunteerSource[]>('/volunteer-shifts/sources', { signal })).data;
export const saveShift = async (body: SaveVolunteerShift, id?: number) => id
  ? (await apiClient.put<VolunteerShift>(`/volunteer-shifts/${id}`, body)).data
  : (await apiClient.post<VolunteerShift>('/volunteer-shifts', body)).data;
export const joinShift = async (id: number) => (await apiClient.post<VolunteerShift>(`/volunteer-shifts/${id}/signup`)).data;
export const withdrawShift = async (id: number) => (await apiClient.delete<VolunteerShift>(`/volunteer-shifts/${id}/signup`)).data;
export const cancelShift = async (id: number, reason: string) => (await apiClient.post<VolunteerShift>(`/volunteer-shifts/${id}/cancel`, { reason })).data;
export const setTaskComplete = async (id: number, taskId: number, completed: boolean) =>
  (await apiClient.put<VolunteerShift>(`/volunteer-shifts/${id}/tasks/${taskId}`, { completed })).data;
