import { createContext, useContext } from 'react';
import type { Participant } from '../admissions/types';
import type { ClubMembershipContext } from '../clubs/domain';

export interface WorldSession {
    /** The signed-in person's club membership: undefined while loading, null when unknown or signed out. */
    membership: ClubMembershipContext | null | undefined;
    /** People this account acts for (itself and any children): undefined while loading, empty when signed out. */
    participants: Participant[] | undefined;
}
export const WorldSessionContext = createContext<WorldSession>({ membership: null, participants: [] });
export const useWorldSession = () => useContext(WorldSessionContext);
