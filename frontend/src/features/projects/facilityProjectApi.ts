import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, getAuthSessionId } from '../../utils/authStorage';
import type { ProjectDetail } from './api';

export interface FacilityProjectEntry { projectId: number | null; canStart: boolean }
export interface ProjectFacilitySource {
    id: number; title: string; status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; outcome: string | null;
    revision: number; canRecordOutcome: boolean; href: string;
}
const base = (club: number) => `/clubs/${club}/projects`;
export const fetchFacilityProject = async (club: number, task: number, signal: AbortSignal) =>
    (await apiClient.get<FacilityProjectEntry>(`${base(club)}/facility-tasks/${task}`, { signal })).data;
export const fetchProjectFacilitySource = async (club: number, project: number, signal: AbortSignal) =>
    (await apiClient.get<ProjectFacilitySource | null>(`${base(club)}/${project}/facility-task`, { signal })).data;

// Only a command identity, never the source's title, body or outcome. Canonical uniqueness on the
// server also survives blocked storage, expiry, a different tab or a different actor's retry.
const keys = new Map<string, string>();
export async function openFacilityProject(club: number, task: number, language: 'en' | 'ka') {
    const session = getAuthSessionId();
    // Existing auth cleanup removes record-create recovery metadata on sign-out/account change.
    const identity = `gk-record-create:project-facility:${session}:${club}:${task}`;
    let key = keys.get(identity);
    try { key ??= sessionStorage.getItem(identity) ?? undefined; } catch { /* Memory fallback. */ }
    key ??= crypto.randomUUID();
    keys.set(identity, key);
    try { sessionStorage.setItem(identity, key); } catch { /* The source is also unique in the DB. */ }
    assertCurrentAuthSession(session);
    const config: AuthSessionRequestConfig = { _authSessionId: session, headers: { 'Idempotency-Key': key } };
    const result = await apiClient.post<ProjectDetail>(`${base(club)}/facility-tasks/${task}`, { language }, config);
    assertCurrentAuthSession(session);
    return result.data;
}
