import { useCallback } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { fetchAdmissionHome } from '../../../admissions/api';
import { useAdmissionData } from '../../../admissions/applicant/useAdmissionData';
import { usePlayerSelection } from '../../../parents/playerSelection';

/**
 * The player a parent or player is finding a group for (`player` in the URL). A linked id is
 * used only once this account can read that player card; the child's details never leave
 * the device except as the birth year and gender the group search needs.
 */
export function useApplicant() {
    const { isAuthenticated, sessionId } = useAuth();
    const { requestedPlayerId, selectPlayer } = usePlayerSelection();
    const home = useAdmissionData(useCallback((signal: AbortSignal) => isAuthenticated ? fetchAdmissionHome(sessionId, signal) : Promise.resolve({ participants: [], cases: [] }), [isAuthenticated, sessionId]), isAuthenticated ? sessionId : undefined);
    const participants = (home.data?.participants ?? []).filter(p => p.dateOfBirth);
    const player = requestedPlayerId ? participants.find(p => p.id === requestedPlayerId) : undefined;
    return {
        participants,
        loading: isAuthenticated && home.loading,
        error: home.error,
        player: player ? { id: player.id, name: player.name, birthYear: Number(player.dateOfBirth!.slice(0, 4)), gender: player.gender ?? null, minor: player.minor } : undefined,
        select: selectPlayer,
    };
}
export type Applicant = ReturnType<typeof useApplicant>;
