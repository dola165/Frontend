import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';

export type Broadcast = {
  id: string; eventId: number; clubId: number; squadId: number; title: string; audience: 'MATCH_VIEWERS';
  state: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'INTERRUPTED' | 'REPLAY_READY' | 'REMOVED';
  revision: number; sourceRevision: number; canManage: boolean; streamingEnabled: boolean;
  setupName: string | null; checkedAt: string | null;
  recordings: { id: string; state: string; createdAt: string }[];
};
export type Workspace = { broadcasts: Broadcast[]; manageableSquads: { id: number; name: string }[] };
export type Playback = { iframeUrl: string; expiresAt: string };
export async function broadcastRequest<T>(method: 'get' | 'post' | 'put', path: string, sessionId: AuthSessionId, signal: AbortSignal, data?: unknown) {
  assertCurrentAuthSession(sessionId);
  const config: AuthSessionRequestConfig = { method, url: path, data, signal, _authSessionId: sessionId, timeout: 30000 };
  const response = await apiClient.request<T>(config);
  assertCurrentAuthSession(sessionId);
  return response.data;
}
export function safePlayerUrl(playback: Playback) {
  const url = new URL(playback.iframeUrl);
  const expiry = new Date(playback.expiresAt).getTime();
  if (url.protocol !== 'https:' || !/^customer-[a-zA-Z0-9-]+\.cloudflarestream\.com$/.test(url.hostname)
      || url.port || url.username || url.password || url.search || url.hash
      || url.pathname.length > 8200 || !/^\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\/iframe$/.test(url.pathname)
      || !Number.isFinite(expiry) || expiry < Date.now() + 10000 || expiry > Date.now() + 310000) {
    throw new Error('The player address is invalid or expired. Please retry.');
  }
  return url.href;
}
