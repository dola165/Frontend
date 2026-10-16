
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
export type { JoiningChild, ChildDirectory, ChildClub, ChildFees } from '../joining-contract/types';
