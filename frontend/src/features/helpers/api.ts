import { apiClient } from '../../api/axiosConfig';

/**
 * Helpers, added to a session (decision 3, 29 October 2026): a parent or volunteer gets no page and no job. The squad's
 * head coach adds them to one session or every date of a repeating one; they see that session on Home with its
 * register; admins see them in Club office's Staff and remove them.
 */
export interface SessionHelper { id: number; name: string; repeating: boolean; since: string; waiting: boolean }
/** `link`: a new account's claim link, which the coach sends by email or WhatsApp; null when they have an account. */
export interface AddedHelper { id: number | null; name: string; link: string | null; linkExpiresAt: string | null }
export interface HelpingPlayer { id: number; firstName: string; response: string; register: string | null }
export interface Helping {
    helperId: number; sessionId: number; squadId: number; squadName: string; clubId: number; clubName: string; title: string; kind: string;
    startsAt: string; endsAt: string; location: string | null; coach: string | null; registerOpen: boolean; players: HelpingPlayer[];
}
export interface ClubHelper { id: number; name: string; squadId: number; squadName: string; session: string | null; startsAt: string | null; repeating: boolean; addedBy: string; since: string }

const squadRoot = (squad: number) => `/squad-communication/${squad}`;

export const sessionHelpers = async (squad: number, session: number, signal?: AbortSignal) =>
    (await apiClient.get<SessionHelper[]>(`${squadRoot(squad)}/sessions/${session}/helpers`, { signal })).data;
export const addHelper = async (squad: number, session: number, body: { name: string; email: string; repeating: boolean; requestId: string }) =>
    (await apiClient.post<AddedHelper>(`${squadRoot(squad)}/sessions/${session}/helpers`, body)).data;
export const removeHelper = async (squad: number, helper: number) => { await apiClient.delete(`${squadRoot(squad)}/helpers/${helper}`); };

export const helping = async (signal?: AbortSignal) => (await apiClient.get<Helping[]>('/me/helping', { signal })).data;
export const saveRegister = async (session: number, came: number[], requestId: string) =>
    (await apiClient.put<HelpingPlayer[]>(`/me/helping/sessions/${session}/register`, { came, requestId })).data;
export const stopHelping = async (helper: number) => { await apiClient.delete(`/me/helping/${helper}`); };

export const clubHelpers = async (club: number, signal?: AbortSignal) => (await apiClient.get<ClubHelper[]>(`/clubs/${club}/helpers`, { signal })).data;
export const removeClubHelper = async (club: number, helper: number) => { await apiClient.delete(`/clubs/${club}/helpers/${helper}`); };
