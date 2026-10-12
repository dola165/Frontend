import { useAuth } from '../../../../context/AuthContext';
import { usePlayerEntryEligibility } from '../../../competitions/usePlayerEntryEligibility';
import { entryGate } from '../../../tournaments/entryGates';
import { useArrangeableSquadsState } from '../../compose/useArrangeableSquads';
import { zoned } from '../../scoreboard/standings';
import { useNow } from '../../scoreboard/useNow';
import type { TournamentPaneData } from './tournamentPane';

const instant = (value?: string | null) => { const at = zoned(value); return at ? Date.parse(at) : null; };

/**
 * What the person can do about entering this tournament now (`entryGate`), with the squads it was decided from: read once
 * by the pane, so its head and its step never say the same fact twice.
 */
export function useTournamentGate(data: TournamentPaneData) {
    const { status, user } = useAuth();
    const { squads } = useArrangeableSquadsState();
    const signedIn = status === 'authenticated';
    const player = usePlayerEntryEligibility(user?.id ?? null, signedIn && data.detail.participantScope === 'PLAYER' && data.detail.status === 'PLANNING');
    const now = useNow();
    const gate = entryGate({
        detail: data.detail, signedIn, userId: user?.id ?? null, canManage: data.canManage, squads, invitation: data.invitation, time: instant, now,
        playerEligible: player.status === 'ready' ? player.eligible : player.status === 'error' ? false : undefined,
    });
    return { gate, squads, now };
}

export type TournamentGate = ReturnType<typeof useTournamentGate>;
