import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { pendingRequests, type RequestItem } from '../requests/api';
import type { SquadJoinDecision, SquadJoinOutcome, SquadJoinRequest } from '../squadCommunication/api';

export async function loadHomePending(session: AuthSessionId, signal: AbortSignal) {
    const items = new Map<string, RequestItem>();
    const result = await pendingRequests(session, signal);
    if (signal.aborted || !isCurrentAuthSession(session)) throw new Error('Session changed');
    for (const item of result.items) if (item.actionable) items.set(item.key, item);
    const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.MAX_SAFE_INTEGER;
    return { items: [...items.values()].sort((a, b) => time(a.updatedAt) - time(b.updatedAt) || a.key.localeCompare(b.key)), partial: result.unavailableSources.length > 0 };
}

const config = (session: AuthSessionId, signal: AbortSignal): AuthSessionRequestConfig => ({ _authSessionId: session, signal });
export const readHomeJoins = (squad: number, session: AuthSessionId, signal: AbortSignal) =>
    apiClient.get<SquadJoinRequest[]>(`/squad-communication/${squad}/join-requests`, config(session, signal)).then(r => r.data);
export const answerHomeJoin = (squad: number, item: SquadJoinRequest, body: SquadJoinDecision, session: AuthSessionId, signal: AbortSignal) =>
    apiClient.post<SquadJoinOutcome>(`/squad-communication/${squad}/join-requests/${['GROUP', 'VISIT'].includes(item.source) ? 'cases/' : ''}${item.id}`, body, config(session, signal)).then(r => r.data);
export const answerHomeHelper = (item: RequestItem, accept: boolean, session: AuthSessionId, signal: AbortSignal) => {
    const endpoint = item.family === 'SESSION_HELPER' ? `/me/helping/${item.id}` : `/projects/${item.id}/helping`;
    return item.family === 'SESSION_HELPER' && !accept
        ? apiClient.delete(endpoint, config(session, signal))
        : apiClient.post(`${endpoint}/${accept ? 'accept' : 'decline'}`, undefined, config(session, signal));
};
