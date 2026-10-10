import { createContext, useContext } from 'react';
import type { ClubMembershipContext } from '../clubs/domain';

export interface WorldSession {
    /** The signed-in person's club membership: undefined while loading, null when unknown or signed out. */
    membership: ClubMembershipContext | null | undefined;
}
export const WorldSessionContext = createContext<WorldSession>({ membership: null });
export const useWorldSession = () => useContext(WorldSessionContext);
