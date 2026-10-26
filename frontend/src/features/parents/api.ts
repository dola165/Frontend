import { apiClient } from '../../api/axiosConfig';
import type { OwnAccount } from '../joining-contract/types';

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

export { fetchJoiningChildren, createPlayerLinkCode } from '../joining-contract/api';
export type { JoiningChild, ChildDirectory, ChildClub, ChildFees, OwnAccount } from '../joining-contract/types';

/** Sends the child the link to their own account (again, or to a corrected email). The recorded birth date goes along while the server still asks for it. */
export const giveOwnAccount = (childId: number, email: string, dateOfBirth: string | null) =>
    apiClient.post<Partial<OwnAccount>>(`/family/children/${childId}/activation`, { email, ...(dateOfBirth ? { dateOfBirth } : {}) }).then(r => r.data);
