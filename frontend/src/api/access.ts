import { isAxiosError } from 'axios';
import { apiClient } from './axiosConfig';

/**
 * The one rule-checker (F3): "may this person do this action to this thing?", answered by the server from jobs, links,
 * age and GrassKickZ staff (fnd-access-b, `GET /access/clubs/{id}` and `/access/squads/{id}`). `me` asks about the
 * person anywhere (`GET /access/me`): starting a club, adding a child, joining, following, and arranging, reporting,
 * inviting or adding a helper in at least one club or squad. Screens only show or hide buttons with it; the server checks
 * again on every action.
 */
export type AccessSubject = 'me' | `club:${number}` | `squad:${number}`;
export type AccessAction =
    | 'see_people' | 'see_staff' | 'invite_staff' | 'make_admin' | 'change_job' | 'end_job' | 'add_helper' | 'confirm_assistant'
    | 'add_child' | 'arrange_match' | 'report_score' | 'start_club' | 'follow'
    | 'join_squad' | 'manage_join_link' | 'approve_join_requests' | 'link_parent'
    | 'leave_club' | 'hand_over' | 'close_club' | 'ask_handover';
/**
 * `pending`: the checker has not answered yet; the screen's own flag stands in, shown disabled. `code`: the refusal's
 * reason (BIRTH_DATE_NEEDED, ADULTS_ONLY …), for a door that offers the fix.
 */
export interface AccessDecision { allowed: boolean; reason?: string | null; code?: string; askAdmin?: boolean; pending?: boolean }
/** `admins`: who "Ask the admin" writes to, the Owner first (active accounts only). */
export interface AccessRules { subject: AccessSubject; actions: Partial<Record<AccessAction, AccessDecision>>; admins?: { userId: number; name: string; owner?: boolean }[] }

interface AccessAnswer {
    allowed: string[];
    refused: { action: string; reason: string; message: string | null }[];
    admins?: { userId: number; name: string; owner?: boolean }[];
}
/** Refusals an admin can lift by giving a job; the rest (age, a confirmed email, the Owner staying) are not theirs to change. */
const ADMIN_DECIDES = new Set(['ONLY_ADMINS', 'ONLY_ADMINS_AND_HEAD_COACHES', 'ONLY_HEAD_COACHES', 'ADMINS_INVITE_DIRECTLY', 'STAFF_BY_INVITATION', 'ONLY_SQUAD_COACHES', 'ONLY_SQUAD_MATCH_STAFF']);

const path = (subject: AccessSubject) => {
    if (subject === 'me') return '/access/me';
    const [kind, id] = subject.split(':');
    return kind === 'club' ? `/access/clubs/${id}` : `/access/squads/${id}`;
};

/** The rules for one subject, or null when the server has no checker for it (404), so screens keep their old flags. */
export const fetchAccess = async (subject: AccessSubject, signal?: AbortSignal): Promise<AccessRules | null> => {
    try {
        const answer = (await apiClient.get<AccessAnswer>(path(subject), { signal })).data;
        const actions: AccessRules['actions'] = {};
        for (const action of answer.allowed ?? []) actions[action as AccessAction] = { allowed: true };
        for (const refusal of answer.refused ?? []) actions[refusal.action as AccessAction] = { allowed: false, reason: refusal.message, code: refusal.reason, askAdmin: ADMIN_DECIDES.has(refusal.reason) };
        return { subject, actions, admins: answer.admins };
    } catch (failure) {
        if (isAxiosError(failure) && failure.response?.status === 404) return null;
        throw failure;
    }
};

/** The chat that "Ask the admin" opens: a direct message to one of the club's admins. */
export const askAdminPath = (admin: { userId: number }) => `/messages?chatWith=${admin.userId}`;
