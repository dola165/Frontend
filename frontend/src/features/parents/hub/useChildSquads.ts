import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../../squadCommunication/api';
import type { JoiningChild } from '../api';

/**
 * The squads a child plays in, as their squad pages: every squad space the parent can open at the child's clubs
 * that lists the child. The server decides who may open a squad; this only narrows to the selected child.
 */
export function useChildSquads(child: JoiningChild | undefined, revision = 0, sessionId?: AuthSessionId) {
    const [state, setState] = useState<{ scope: string; key: string; squads: api.SquadOverview[]; error: string; failedSquads: string[] } | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const clubs = child?.clubs.filter(club => ['ACTIVE', 'TRIALIST'].includes(club.affiliationStatus ?? '')).map(club => club.clubId) ?? [];
    const playerId = child?.playerId, clubScope = JSON.stringify(clubs);
    const scope = JSON.stringify([sessionId ?? 'legacy', playerId, clubs]);
    const key = `${scope}:${revision}:${retryCount}`;
    const liveKey = useRef(key);
    useLayoutEffect(() => { liveKey.current = key; }, [key]);
    const retry = useCallback(() => setRetryCount(value => value + 1), []);
    useEffect(() => {
        const currentClubs = JSON.parse(clubScope) as number[];
        if (playerId == null || !currentClubs.length) return;
        const abort = new AbortController();
        const current = () => !abort.signal.aborted && liveKey.current === key;
        void api.spaces(abort.signal).then(async rows => {
            if (!current()) return;
            const selected = rows.filter(row => currentClubs.includes(row.club_id));
            const found = await Promise.allSettled(selected.map(async row => {
                const squad = await api.overview(row.id, abort.signal);
                if (squad.id !== row.id || squad.club_id !== row.club_id || !Array.isArray(squad.players)) throw new Error('The squad details could not be confirmed.');
                return squad.players.some(player => player.id === playerId) ? squad : null;
            }));
            if (!current()) return;
            const squads = found.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
            const failedSquads = selected.filter((_, index) => found[index].status === 'rejected').map(row => row.name);
            const failure = found.find((result): result is PromiseRejectedResult => result.status === 'rejected');
            // Keep only fresh, matching authorised overviews. Never reuse a failed or removed roster row.
            setState({ scope, key, squads, failedSquads, error: failure ? extractApiErrorMessage(failure.reason, 'The squads could not load.') : '' });
        }).catch(e => { if (current()) setState({ scope, key, squads: [], failedSquads: [], error: extractApiErrorMessage(e, 'The squads could not load.') }); });
        return () => abort.abort();
    }, [clubScope, key, playerId, scope]);
    if (playerId == null || !clubs.length) return { squads: [] as api.SquadOverview[], loading: false, error: '', failedSquads: [] as string[], retry };
    // Only this exact child/login/club scope may keep its last confirmed view while refreshing.
    const visible = state?.scope === scope ? state : null;
    return { squads: visible?.squads ?? [], loading: visible?.key !== key, error: visible?.error ?? '', failedSquads: visible?.failedSquads ?? [], retry };
}
