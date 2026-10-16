import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../../squadCommunication/api';
import type { JoiningChild } from '../api';

/**
 * The squads a child plays in, as their squad pages: every squad space the parent can open at the child's clubs
 * that lists the child. The server decides who may open a squad; this only narrows to the selected child.
 */
export function useChildSquads(child: JoiningChild | undefined, revision = 0) {
    const [state, setState] = useState<{ key: string; squads: api.SquadOverview[]; error: string } | null>(null);
    const clubs = child?.clubs.filter(club => ['ACTIVE', 'TRIALIST'].includes(club.affiliationStatus ?? '')).map(club => club.clubId) ?? [];
    const key = `${child?.playerId}:${clubs.join(',')}:${revision}`;
    useEffect(() => {
        if (!child || !clubs.length) return;
        const abort = new AbortController();
        void api.spaces(abort.signal).then(async rows => {
            const found = await Promise.all(rows.filter(row => clubs.includes(row.club_id)).map(row => api.overview(row.id, abort.signal)));
            if (!abort.signal.aborted) setState({ key, squads: found.filter(squad => squad.players.some(player => player.id === child.playerId)), error: '' });
        }).catch(e => { if (!abort.signal.aborted) setState({ key, squads: [], error: extractApiErrorMessage(e, 'The squads could not load.') }); });
        return () => abort.abort();
        // `key` names the child, their clubs and the revision.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    if (!child || !clubs.length) return { squads: [] as api.SquadOverview[], loading: false, error: '' };
    // A refresh keeps the child's squads in view until the new answer arrives.
    return state?.key.startsWith(`${child.playerId}:`) ? { squads: state.squads, error: state.error, loading: false } : { squads: [] as api.SquadOverview[], loading: true, error: '' };
}
