import { isAxiosError } from 'axios';
import { apiClient } from './axiosConfig';

/**
 * The one rule-checker (F3): "may this person do this action to this thing?", answered by the server from jobs, links,
 * age and GrassKickZ staff. Screens only show or hide buttons with it; the server still refuses on its own.
 * GAP (26 Oct 2026): built against fnd-people-f's proposal (`GET /access/can`) before fnd-access-b's handover existed.
 */
export type AccessSubject = `club:${number}` | `squad:${number}`;
export type AccessAction =
    | 'invite_staff' | 'invite_admin' | 'change_job' | 'end_job' | 'suggest_assistant' | 'edit_club' | 'see_people'
    | 'join_squad' | 'join_squad_for_child' | 'approve_join_requests' | 'invite_squad_link';
export interface AccessDecision { allowed: boolean; reason?: string | null; askAdmin?: boolean }
/** `admins`: who "Ask the admin" writes to (the Owner and Admins of the club the subject belongs to). */
export interface AccessRules { subject: AccessSubject; actions: Partial<Record<AccessAction, AccessDecision>>; admins?: { userId: number; name: string }[] }

/** The rules for one subject, or null when the server does not have the checker yet (404), so screens keep their old flags. */
export const fetchAccess = async (subject: AccessSubject, signal?: AbortSignal): Promise<AccessRules | null> => {
    try {
        return (await apiClient.get<AccessRules>('/access/can', { params: { subject }, signal })).data;
    } catch (failure) {
        if (isAxiosError(failure) && failure.response?.status === 404) return null;
        throw failure;
    }
};

/** The chat that "Ask the admin" opens: a direct message to one of the club's admins. */
export const askAdminPath = (admin: { userId: number }) => `/messages?chatWith=${admin.userId}`;
