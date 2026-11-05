import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { AuthSessionId } from '../../../utils/authStorage';

export interface PlatformSeller { contactEmail: string; whatsapp: string; website: string; arrangement: string; version: number }
export const fetchPlatformAccess = async (signal: AbortSignal) => (await apiClient.get<{ canManage: boolean }>('/store/platform/access', { signal })).data;
export const fetchPlatformSeller = async (signal: AbortSignal) => (await apiClient.get<PlatformSeller>('/store/platform/seller', { signal })).data;
export const savePlatformSeller = async (input: PlatformSeller, sessionId: AuthSessionId) =>
    (await apiClient.put<PlatformSeller>('/store/platform/seller', input, { _authSessionId: sessionId } as AuthSessionRequestConfig)).data;
