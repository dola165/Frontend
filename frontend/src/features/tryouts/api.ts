import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export type PostingStatus = 'OPEN' | 'CLOSED' | 'FILLED' | 'EXPIRED' | 'CANCELLED' | 'UNAVAILABLE';
export interface TryoutPosting {
  id: number; title: string; description: string | null; position: string | null; ageGroup: string | null;
  gender: string | null; tryoutDate: string | null; deadline: string | null; clubId: number; clubName: string;
  location: string | null; status: PostingStatus; destination: string;
}
export interface PostingPage { items: TryoutPosting[]; total: number; page: number; size: number; hasMore: boolean }
export interface ApplicationReceipt {
  id: number; tryoutId: number; tryoutTitle: string; status: string; appliedAt: string; reviewedAt: string | null;
  message: string | null; decisionMessage: string | null; tryoutLifecycleStatus: string;
}
export interface ApplicationContext {
  canApply: boolean; reason: 'ALREADY_APPLIED' | 'NOT_OPEN' | 'PLAYER_IDENTITY_REQUIRED' | 'ALREADY_AFFILIATED' | null;
  postingStatus: PostingStatus; application: ApplicationReceipt | null; minorConsentRequired: boolean; canManage: boolean;
}
const config = (sessionId: AuthSessionId, signal: AbortSignal): AuthSessionRequestConfig => ({ _authSessionId: sessionId, signal });
export const fetchTryout = (id: number, signal: AbortSignal) => apiClient.get<TryoutPosting>(`/tryouts/${id}`, { signal }).then(r => r.data);
export const searchTryouts = (params: Record<string, string | number | undefined>, signal: AbortSignal) =>
  apiClient.get<PostingPage>('/tryouts/discovery', { params, signal }).then(r => r.data);
export const applicationContext = (id: number, sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.get<ApplicationContext>(`/tryouts/${id}/application`, config(sessionId, signal)).then(r => r.data);
export const submitApplication = (id: number, message: string, sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.post(`/tryouts/${id}/apply`, { message: message.trim() || undefined }, config(sessionId, signal));
export const withdrawApplication = (id: number, sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.post(`/tryouts/applications/${id}/withdraw`, {}, config(sessionId, signal));
export const closePosting = (id: number, reason: 'CLOSED' | 'FILLED', sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.post(`/tryouts/${id}/close`, { reason }, config(sessionId, signal));
