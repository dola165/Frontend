import { apiClient } from '../../../api/axiosConfig';
import type { Match } from '../../matchExchange/api';

/** A called-up player and the family's answer, as the match's participants list has them. */
export interface CallUp { id: number; name: string; selected: boolean; response: string; revision: number; canRespond: boolean; waiting?: boolean }
export type Fitness = 'FIT' | 'DOUBTFUL' | 'OUT';

/**
 * A squad's next match, the same card for everyone on the squad (step 3, 29 October 2026): the fixture as its own page
 * shows it, call-ups with answers, the preparation record (the checklist and what to bring), the trip, and who's fit as
 * Fit, Doubtful or Out only. `can` holds the buttons this person's tools give. `match: null` when nothing is arranged.
 */
export interface MatchCard {
    squadId: number; squadName: string; match: Match | null;
    callUps?: CallUp[];
    fitness?: { fit: number; doubtful: number; out: number; players: { id: number; state: Fitness }[] };
    preparation?: { recordId: number; status: string; revision: number; referees: string | null; pitch: string | null; medical: string | null; bring: string[] } | null;
    trip?: { recordId: number; status: string; departsAt: string | null; meetingPoint: string | null; destination: string | null } | null;
    lastReminder?: string | null;
    can?: { callUps: boolean; remind: boolean; checklist: boolean; bus: boolean };
}

export const nextMatch = async (squad: number, signal?: AbortSignal) =>
    (await apiClient.get<MatchCard>(`/squad-communication/${squad}/next-match`, { signal })).data;

/** Remind the families of called-up players who haven't answered; at most every two hours (REMINDED_RECENTLY). */
export const remindCallUps = async (event: number, squad: number) =>
    (await apiClient.post<{ reminded: number }>(`/match-arrangements/${event}/squads/${squad}/remind`)).data;

/** The squad's staff room in the app's chats, made the first time someone on the squad opens it. */
export const openStaffRoom = async (squad: number) =>
    (await apiClient.post<{ conversationId: number; name: string }>(`/squad-communication/${squad}/staff-room`)).data;

/**
 * Want to join, the applications' part: player applications this person decides (the squad's head or assistant coach,
 * the head of coaching, admins), waiting or answered in the last two weeks, with who answered.
 */
export interface WaitingApplication {
    id: number; clubId: number; squadId: number | null; squadName: string | null; status: string; createdAt: string;
    position: string | null; ageGroup: string | null; applicantName: string; age: number | null; answeredBy: string | null; answeredAt: string | null;
}
export const waitingApplications = async (club: number, squad: number | null, signal?: AbortSignal) =>
    (await apiClient.get<WaitingApplication[]>('/recruitment/applications/waiting', { params: { clubId: club, ...(squad ? { squadId: squad } : {}) }, signal })).data;

/** Invite to a trial: the club's offer of a player trial in the squad the family applied for. */
export const inviteToTrial = async (application: number) => (await apiClient.post(`/recruitment/applications/${application}/offer`, {})).data;

/** Not now. A second answer is refused with ALREADY_ANSWERED, naming who answered first. */
export const notNow = async (application: number) => (await apiClient.post(`/recruitment/applications/${application}/decline`, {})).data;
