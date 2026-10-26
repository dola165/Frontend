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

/** Sends the child the link to their own account (again, or to a corrected email); the card's birth date stands. */
export const giveOwnAccount = (childId: number, email: string) =>
    apiClient.post<OwnAccount>(`/family/children/${childId}/activation`, { email }).then(r => r.data);
