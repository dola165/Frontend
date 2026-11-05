import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';

export interface Scope { clubWide: boolean; squads: { id: number; name: string }[] }
export interface Candidate { personId: number; name: string; applicationId: number | null; sourceStatus: string }
export interface Person { id: number; fullName: string; position?: string; city?: string }
export interface Prospect {
    id: number; squadId: number | null; personId: number | null; name: string;
    source: 'PUBLIC_ADULT' | 'FAMILY_APPLICATION' | 'RESTRICTED'; applicationId: number | null;
    sourceStatus: string; status: string; outcome: string | null; revision: number; restricted: boolean;
    actions: string[];
    observations: { id: number; summary: string; source: string; observedOn: string; recordedAt: string }[];
    history: { id: number; action: string; fromStatus: string | null; toStatus: string | null; note: string | null; actor: string; recordedAt: string }[];
}
export interface Page { items: Prospect[]; page: number; hasMore: boolean }
export interface Adults { items: Person[]; page: number; hasMore: boolean }
export interface Command { requestId: string; revision: number; action: string; note?: string; source?: string; observedOn?: string }

export function scoutingApi(club: number, session: AuthSessionId) {
    const root = `/clubs/${club}/scouting`;
    const config = (signal?: AbortSignal): AuthSessionRequestConfig => ({ signal, _authSessionId: session });
    const read = async <T,>(suffix: string, signal?: AbortSignal) => {
        assertCurrentAuthSession(session);
        const result = await apiClient.get<T>(root + suffix, config(signal));
        assertCurrentAuthSession(session);
        return result.data;
    };
    const write = async <T,>(suffix: string, body: unknown) => {
        assertCurrentAuthSession(session);
        const result = await apiClient.post<T>(root + suffix, body, config());
        assertCurrentAuthSession(session);
        return result.data;
    };
    const query = (squad: number | null, rest: Record<string, string> = {}) => '?' + new URLSearchParams({ ...(squad === null ? {} : { squad: String(squad) }), ...rest });
    return {
        scope: (signal?: AbortSignal) => read<Scope>('/scope', signal),
        list: (squad: number | null, page: number, signal?: AbortSignal) => read<Page>(query(squad, { page: String(page) }), signal),
        adults: (squad: number | null, q: string, page: number, signal?: AbortSignal) => read<Adults>('/adults' + query(squad, { q, page: String(page) }), signal),
        applications: (squad: number | null, signal?: AbortSignal) => read<Candidate[]>('/applications' + query(squad), signal),
        get: (id: number, signal?: AbortSignal) => read<Prospect>('/' + id, signal),
        watch: (squadId: number | null, personId: number, applicationId: number | null, requestId: string) =>
            write<Prospect>('', { squadId, personId, applicationId, requestId }),
        command: (id: number, command: Command) => write<Prospect>(`/${id}/commands`, command),
        contact: (id: number, command: Command) => write<{ conversationId: number }>(`/${id}/contact`, command),
    };
}
export type ScoutingApi = ReturnType<typeof scoutingApi>;
