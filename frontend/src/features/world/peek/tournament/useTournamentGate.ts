import { useAuth } from '../../../../context/AuthContext';
import { usePlayerEntryEligibility } from '../../../competitions/usePlayerEntryEligibility';
import { entryGate } from '../../../tournaments/entryGates';
import { useArrangeableSquadsState } from '../../compose/useArrangeableSquads';
import { zoned } from '../../scoreboard/standings';
import { useNow } from '../../scoreboard/useNow';
import { useWorldCopy } from '../../copy';
import { useWorldData } from '../../useWorldData';
import { loadTournamentPane, type TournamentPaneData } from './tournamentPane';
import { useTournamentChoiceBoundary, useTournamentChoiceObservation } from './tournamentChoice';

const instant = (value?: string | null) => { const at = zoned(value); return at ? Date.parse(at) : null; };

/**
 * What the person can do about entering this tournament now (`entryGate`), with the squads it was decided from: read once
 * by the pane, so its head and its step never say the same fact twice.
 */
export function useTournamentGate(data: TournamentPaneData) {
    const { status, user } = useAuth();
    const squadAccess = useArrangeableSquadsState();
    const { squads } = squadAccess;
    const signedIn = status === 'authenticated';
    const player = usePlayerEntryEligibility(user?.id ?? null, signedIn && data.detail.participantScope === 'PLAYER' && data.detail.status === 'PLANNING');
    const now = useNow();
    const gate = entryGate({
        detail: data.detail, signedIn, userId: user?.id ?? null, canManage: data.canManage, squads, invitation: data.invitation, time: instant, now,
        playerEligible: player.status === 'ready' ? player.eligible : player.status === 'error' ? false : undefined,
    });
    useTournamentChoiceObservation(data, squads, gate);
    // A players' tournament whose eligibility could not be read says so with a retry, never "not eligible".
    return { gate, squads, now, player, squadAccess };
}

export type TournamentGate = ReturnType<typeof useTournamentGate>;

/** The tournament as World's pane reads it, under one key, so the pane and the full page share one read. */
export function useTournamentPane(tournamentId: number) {
    useTournamentChoiceBoundary(tournamentId);
    const t = useWorldCopy();
    const { sessionId, user } = useAuth();
    const valid = Number.isInteger(tournamentId) && tournamentId > 0;
    return useWorldData(valid ? `tournament-pane:${sessionId}:${user?.id ?? ''}:${tournamentId}` : null,
        () => loadTournamentPane(tournamentId, sessionId, user?.id ?? null), t('This tournament could not load.'));
}
