import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { isAndroidApp } from '../../android/bridge';

export interface DolaStatus { name: string; available: boolean; mode: string; maxMessageLength: number; capabilities: string[] }
export interface DolaRequest { conversationId?: string; requestId: string; message: string; includePersonalContext: boolean; timeZone?: string; workspaceContext?: string; venueId?: number }
export interface DolaAnswer {
    conversationId: string; requestId: string; answer: string;
    destinations: { id: string; title: string; path: string }[];
    sources: { id: string; title: string; text: string; reviewedAt: string }[];
    toolsUsed: string[]; modelCalls: number; totalTokens: number;
    actions?: DolaAction[];
    followUps?: string[];
}
export interface DolaAction {
    id: string; kind: 'COACH_UPDATE' | 'ACKNOWLEDGE_UPDATE' | 'CANCEL_SESSION' | 'SESSION_RESPONSE' | 'OPEN_CHALLENGE' | 'REFEREE_DECISION' | 'REFEREE_AVAILABILITY' | 'MATCH_PROPOSAL' | 'MATCH_PROPOSAL_DECISION' | 'VENUE_BOOKING' | 'VENUE_DECISION';
    state: 'PENDING' | 'COMPLETED' | 'DISCARDED' | 'SUPERSEDED' | 'EXPIRED';
    title: string; body: string; details: { label: string; value: string }[];
    confirmLabel: string; expiresAt: string; receipt: string;
    destination: DolaAnswer['destinations'][number];
}
export interface DolaTurn { question: string; result?: DolaAnswer; partial?: string }
export interface DolaSnapshot { conversationId: string; expiresAt: string; turns: DolaTurn[] }
export type DolaStreamEvent = { type: 'ready' | 'delta' | 'reset' | 'complete' | 'error'; text?: string; answer?: DolaAnswer; code?: string; error?: string };
const config = (sessionId: AuthSessionId, signal: AbortSignal): AuthSessionRequestConfig => ({ _authSessionId: sessionId, signal, timeout: 150000 });
export const dolaStatus = async (sessionId: AuthSessionId, signal: AbortSignal): Promise<DolaStatus> =>
    (await apiClient.get<DolaStatus>('/assistant/dola/status', config(sessionId, signal))).data;
export const dolaWelcome = async (sessionId: AuthSessionId, signal: AbortSignal): Promise<{ contexts: unknown }> =>
    (await apiClient.get<{ contexts: unknown }>('/assistant/dola/welcome', config(sessionId, signal))).data;
export const askDola = async (request: DolaRequest, sessionId: AuthSessionId, signal: AbortSignal): Promise<DolaAnswer> =>
    (await apiClient.post<DolaAnswer>('/assistant/dola/messages', request, config(sessionId, signal))).data;
export const clearDola = async (id: string, sessionId: AuthSessionId, signal: AbortSignal) =>
    apiClient.delete(`/assistant/dola/conversations/${encodeURIComponent(id)}`, config(sessionId, signal));
export const latestDola = async (sessionId: AuthSessionId, signal: AbortSignal): Promise<DolaSnapshot | null> => {
    const response = await apiClient.get<DolaSnapshot>('/assistant/dola/conversations/latest', config(sessionId, signal));
    return response.status === 204 ? null : response.data;
};
export const resolveDolaAction = async (conversationId: string, actionId: string, decision: 'confirm' | 'discard', sessionId: AuthSessionId, signal: AbortSignal): Promise<DolaAction> =>
    (await apiClient.post<DolaAction>(`/assistant/dola/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/${decision}`, {}, config(sessionId, signal))).data;
export async function streamDola(request: DolaRequest, sessionId: AuthSessionId, signal: AbortSignal, onEvent: (event: DolaStreamEvent) => void): Promise<DolaAnswer> {
    if (isAndroidApp) return askDola(request, sessionId, signal);
    const response = await apiClient.post<ReadableStream<Uint8Array>>('/assistant/dola/messages/stream', request,
        { ...config(sessionId, signal), adapter: 'fetch', responseType: 'stream', headers: { Accept: 'application/x-ndjson, application/json' } });
    const reader = response.data.getReader(); const decoder = new TextDecoder(); let buffer = ''; let answer: DolaAnswer | undefined;
    const consume = (line: string) => {
        assertCurrentAuthSession(sessionId);
        if (!line.trim()) return;
        const event: DolaStreamEvent = JSON.parse(line);
        if (event.type === 'error') throw Object.assign(new Error(event.error || 'Dola could not finish this answer.'), { response: { data: { code: event.code, error: event.error } } });
        if (event.type === 'complete') answer = event.answer;
        onEvent(event);
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
            buffer += decoder.decode(value, { stream: !done });
            if (buffer.length > 256000) throw new Error('Dola returned an oversized response.');
            let newline: number;
            while ((newline = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
            if (done) { consume(buffer); break; }
        }
        assertCurrentAuthSession(sessionId);
        if (!answer) throw new Error('The connection ended before Dola finished. Your last completed chat is still available.');
        return answer;
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

// Only verified application destinations become clickable, even if the response is malformed.
const destinations: Record<string, string> = {
    home: '/home', clubs: '/clubs', my_club: '/my-club', parent_hub: '/parent', my_squads: '/squads',
    my_schedule: '/calendar?scope=personal', match_exchange: '/match-exchange', referees: '/referees/me',
    stadiums: '/stadiums', tournaments: '/tournaments', jobs: '/jobs', account: '/account', football_roles: '/account/roles', agent_hub: '/agent',
};
export const safeDolaDestination = (destination: DolaAnswer['destinations'][number]) => {
    const venue = /^venue_workspace:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (venue) return destination.path === `/stadiums/${venue[1]}/manage?view=calendar`;
    const organization = /^organization:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (organization) return destination.path === `/organizations/${organization[1]}`;
    const tournament = /^tournament_workspace:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (tournament) return destination.path === `/tournaments/${tournament[1]}/workspace`;
    const challenge = /^match_challenge:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (challenge) return destination.path === `/match-exchange/${challenge[1]}`;
    const job = /^job:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (job) return destination.path === `/jobs/${job[1]}`;
    const squad = /^squad_schedule:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (squad) return destination.path === `/squads/${squad[1]}?tab=sessions`;
    const updates = /^squad_updates:([1-9][0-9]{0,14})$/.exec(destination.id);
    if (updates) return destination.path === `/squads/${updates[1]}`;
    return Object.hasOwn(destinations, destination.id) && destinations[destination.id] === destination.path;
};
