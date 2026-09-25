import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';

export type ClubApproachStatus = 'PENDING_PLAYER' | 'PENDING_CLUB' | 'ACTIVE' | 'DECLINED' | 'CANCELLED' | 'ENDED' | 'REVOKED';
export type ClubApproachAction = 'APPROVE' | 'ACCEPT' | 'DECLINE' | 'CANCEL' | 'END' | 'REVOKE';

export interface ClubApproach {
    id: number; agentId: number; agentName: string; playerId: number; playerName: string;
    clubId: number; clubName: string; scope: string; message?: string | null;
    status: ClubApproachStatus; version: number; createdAt: string; updatedAt: string;
    allowedActions: string[];
}
export interface ClubApproachPage { items: ClubApproach[]; total: number; page: number; size: number; }
export interface ClubApproachOption { representationRequestId: number; representationId: number; playerId: number; playerName: string; }
export interface ClubApproachMessage { id: number; authorId: number; authorName: string; kind?: string | null; body?: string | null; createdAt: string; }
export interface ClubApproachMessagePage { items: ClubApproachMessage[]; total: number; page: number; size: number; }

export const fetchClubApproaches = async (params: { clubId?: number; view: 'OPEN' | 'HISTORY' | 'ALL'; page?: number; size?: number }, config?: AuthSessionRequestConfig) =>
    (await apiClient.get<ClubApproachPage>('/club-approaches', { ...config, params })).data;
export const fetchClubApproach = async (id: number, config?: AuthSessionRequestConfig) =>
    (await apiClient.get<ClubApproach>(`/club-approaches/${id}`, config)).data;
export const fetchClubApproachOptions = async (config?: AuthSessionRequestConfig) =>
    (await apiClient.get<ClubApproachOption[]>('/club-approaches/options', config)).data;
export const createClubApproach = async (payload: { representationRequestId: number; clubId: number; scope: string; message?: string }, config?: AuthSessionRequestConfig) =>
    (await apiClient.post<ClubApproach>('/club-approaches', payload, config)).data;
export const actOnClubApproach = async (id: number, payload: { action: ClubApproachAction; version: number; note?: string }, config?: AuthSessionRequestConfig) =>
    (await apiClient.patch<ClubApproach>(`/club-approaches/${id}`, payload, config)).data;
export const fetchClubApproachMessages = async (id: number, page = 0, size = 20, config?: AuthSessionRequestConfig) =>
    (await apiClient.get<ClubApproachMessagePage>(`/club-approaches/${id}/messages`, { ...config, params: { page, size } })).data;
export const postClubApproachMessage = async (id: number, body: string, config?: AuthSessionRequestConfig) =>
    (await apiClient.post<ClubApproachMessage>(`/club-approaches/${id}/messages`, { body }, config)).data;
