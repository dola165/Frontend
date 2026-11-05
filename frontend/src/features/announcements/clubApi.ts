import { apiClient } from '../../api/axiosConfig';

/** A club announcement (M14): `squadIds` empty is the whole club; `told` only for those who may write. */
export interface ClubAnnouncement {
    id: number; clubId: number; clubName: string; title: string; body: string; squadIds: number[]; squadNames: string[];
    authorName: string; createdAt: string; expiresAt: string; pinned: boolean; told: number | null; canEnd: boolean;
}

/** The club page's announcements: what the viewer may write and the announcements they see. */
export interface ClubAnnouncements { canWrite: boolean; wholeClub: boolean; squads: { id: number; name: string }[]; announcements: ClubAnnouncement[] }

export const clubAnnouncements = async (clubId: number, signal?: AbortSignal) =>
    (await apiClient.get<ClubAnnouncements>(`/clubs/${clubId}/announcements`, { signal })).data;
export const announceToClub = async (clubId: number, data: { requestId: string; title: string; body: string; squadIds: number[]; expiresAt: string }) =>
    (await apiClient.post<{ id: number; told: number }>(`/clubs/${clubId}/announcements`, data)).data;
export const endClubAnnouncement = (clubId: number, id: number) => apiClient.post(`/clubs/${clubId}/announcements/${id}/end`);
export const myClubAnnouncements = async (signal?: AbortSignal) =>
    (await apiClient.get<ClubAnnouncement[]>('/me/club-announcements', { signal })).data;
