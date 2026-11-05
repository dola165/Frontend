import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { AuthSessionId } from '../../../utils/authStorage';

export interface SearchSpec { kind: 'CLUBS' | 'GROUPS' | 'TRIALS' | 'TOURNAMENTS'; filters: Record<string, string[]> }
export interface SearchWatch { id: number; query: SearchSpec; returnPath: string; childId: number | null; active: boolean }
export function searchSpec(kind: SearchSpec['kind'], params: URLSearchParams): SearchSpec {
    const filters: Record<string, string[]> = {};
    for (const key of [...new Set(params.keys())].sort()) {
        if (['page', 'size', 'sort'].includes(key)) continue;
        const values = [...new Set(params.getAll(key).map(value => value.trim()).filter(Boolean))].sort();
        if (values.length) filters[key] = values;
    }
    return { kind, filters };
}
const config = (sessionId: AuthSessionId, signal: AbortSignal): AuthSessionRequestConfig => ({ _authSessionId: sessionId, signal });
export const listSearchWatches = (sessionId: AuthSessionId, signal: AbortSignal) => apiClient.get<SearchWatch[]>('/world/search-watches', config(sessionId, signal)).then(r => r.data);
export const readSearchWatch = (id: string, sessionId: AuthSessionId, signal: AbortSignal) => apiClient.get<SearchWatch>(`/world/search-watches/${id}`, config(sessionId, signal)).then(r => r.data);
export const keepSearch = (query: SearchSpec, returnPath: string, childId: number | undefined, sessionId: AuthSessionId, signal: AbortSignal) =>
    apiClient.post<SearchWatch>('/world/search-watches', { query, returnPath, childId }, config(sessionId, signal)).then(r => r.data);
export const stopSearch = (id: number, sessionId: AuthSessionId, signal: AbortSignal) => apiClient.delete(`/world/search-watches/${id}`, config(sessionId, signal));
