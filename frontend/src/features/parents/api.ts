import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export interface ParentEvent {
    eventId: number;
    occurrenceId: string;
    title: string | null;
    eventType: string | null;
    startsAt: string;
    endsAt: string;
    locationName: string | null;
    status: string | null;
}

export interface ParentChild {
    cardId: number;
    userId: number;
    fullName: string | null;
    birthYear: number | null;
    photoUrl: string | null;
    position: string | null;
    registered: boolean;
    activationEligible: boolean;
    clubId: number;
    clubName: string;
    squadNames: string[];
    affiliationStatus: string;
    consentStatus: string | null;
    trialEndsOn: string | null;
    publicEvents: ParentEvent[];
}

export interface ParentHub {
    children: ParentChild[];
    scheduleFrom: string;
    scheduleTo: string;
}

export async function fetchParentHub(sessionId: AuthSessionId, signal: AbortSignal) {
    const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
    return (await apiClient.get<ParentHub>('/parents/hub', config)).data;
}

export async function activateChild(cardId: number, dateOfBirth: string, email: string, sessionId: AuthSessionId) {
    const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
    return (await apiClient.post<{ username: string; email: string; status: string }>(
        `/player-cards/${cardId}/activate`, { dateOfBirth, email }, config,
    )).data;
}

export { fetchJoiningChildren, createPlayerLinkCode } from '../joining-contract/api';
export type { JoiningChild, ChildDirectory, ChildClub } from '../joining-contract/types';
