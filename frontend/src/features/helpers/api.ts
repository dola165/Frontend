import { apiClient } from '../../api/axiosConfig';

/**
 * Helpers, added to a session (decision 3, 29 October 2026): a parent or volunteer gets no page and no job. The squad's
 * head coach adds them to one session or every date of a repeating one; they see that session on Home with its
 * register; admins see them in Club office's Staff and remove them.
 */
export interface SessionHelper { id: number; name: string; repeating: boolean; since: string; waiting: boolean }
/**
 * `link`: the claim link of an account this request made, which the coach sends by email or WhatsApp; null when the
 * person has an account. `invitationPending`: the address already has an invitation waiting, which stays as it is.
 */
export interface AddedHelper { id: number | null; name: string; link: string | null; linkExpiresAt: string | null; invitationPending: boolean }
/** `lastInitial`: the last name's first letter, for telling two players with the same first name apart. */
export interface HelpingPlayer { id: number; firstName: string; lastInitial: string | null; response: string; register: string | null }
export interface Helping {
    helperId: number; sessionId: number; squadId: number; squadName: string; clubId: number; clubName: string; title: string; kind: string;
    startsAt: string; endsAt: string; location: string | null; coach: string | null; registerOpen: boolean; registerRevision: string; players: HelpingPlayer[];
}
/** A session's register and its revision, which a save sends back unchanged (409 REGISTER_CHANGED otherwise). */
export interface RegisterView { revision: string; players: HelpingPlayer[] }
export interface ClubHelper { id: number; name: string; squadId: number; squadName: string; session: string | null; startsAt: string | null; repeating: boolean; addedBy: string; since: string }

const squadRoot = (squad: number) => `/squad-communication/${squad}`;

export const sessionHelpers = async (squad: number, session: number, signal?: AbortSignal) =>
    (await apiClient.get<SessionHelper[]>(`${squadRoot(squad)}/sessions/${session}/helpers`, { signal })).data;
export const addHelper = async (squad: number, session: number, body: { name: string; email: string; repeating: boolean; requestId: string }) =>
    (await apiClient.post<AddedHelper>(`${squadRoot(squad)}/sessions/${session}/helpers`, body)).data;
export const removeHelper = async (squad: number, helper: number) => { await apiClient.delete(`${squadRoot(squad)}/helpers/${helper}`); };

export const helping = async (signal?: AbortSignal) => (await apiClient.get<Helping[]>('/me/helping', { signal })).data;
export const register = async (session: number) => (await apiClient.get<RegisterView>(`/me/helping/sessions/${session}/register`)).data;
export const saveRegister = async (session: number, body: { came: number[]; requestId: string; revision: string }) =>
    (await apiClient.put<RegisterView>(`/me/helping/sessions/${session}/register`, body)).data;
export const stopHelping = async (helper: number) => { await apiClient.delete(`/me/helping/${helper}`); };

export const clubHelpers = async (club: number, signal?: AbortSignal) => (await apiClient.get<ClubHelper[]>(`/clubs/${club}/helpers`, { signal })).data;
export const removeClubHelper = async (club: number, helper: number) => { await apiClient.delete(`/clubs/${club}/helpers/${helper}`); };
