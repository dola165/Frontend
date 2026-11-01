import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../../squadCommunication/api';
import type { JoiningChild } from '../api';
import { playingClubs } from './childFacts';

type Loaded = { squads: Map<number, api.SquadOverview[]>; error: string; failedSquads: string[] };

/**
 * The squads each child plays in, as the squad spaces the parent can open at the children's clubs that list the child.
 * The server decides who may open a squad; this only narrows to the children. One request per squad, shared by siblings.
 */
async function loadChildrenSquads(children: { playerId: number; clubs: number[] }[], signal: AbortSignal): Promise<Loaded> {
    const clubs = [...new Set(children.flatMap(child => child.clubs))];
    const rows = (await api.spaces(signal)).filter(row => clubs.includes(row.club_id));
    const found = await Promise.allSettled(rows.map(async row => {
        const squad = await api.overview(row.id, signal);
        if (squad.id !== row.id || squad.club_id !== row.club_id || !Array.isArray(squad.players)) throw new Error('The squad details could not be confirmed.');
        return squad;
    }));
    const squads = new Map(children.map(child => [child.playerId, found.flatMap(result => result.status === 'fulfilled' && child.clubs.includes(result.value.club_id) && result.value.players.some(player => player.id === child.playerId) ? [result.value] : [])]));
    // A squad the server refuses the parent (403, 404) is simply not theirs to see; anything else failed and says so.
    const failed = (result: PromiseSettledResult<unknown>): result is PromiseRejectedResult => result.status === 'rejected'
        && ![403, 404].includes((result.reason as { response?: { status?: number } } | undefined)?.response?.status ?? 0);
    const failure = found.find(failed);
    // Keep only fresh, matching authorised overviews. Never reuse a failed or removed roster row.
    return { squads, failedSquads: rows.filter((_, index) => failed(found[index])).map(row => row.name), error: failure ? extractApiErrorMessage(failure.reason, 'The squads could not load.') : '' };
}

/** The squads of several children at once (the family's week), keyed by child. */
export function useFamilySquads(children: JoiningChild[], revision = 0, sessionId?: AuthSessionId) {
    const members = children.map(child => ({ playerId: child.playerId, clubs: playingClubs(child).map(club => club.clubId) })).filter(child => child.clubs.length);
    const scope = JSON.stringify([sessionId ?? 'legacy', members]);
    const [retryCount, setRetryCount] = useState(0);
    const key = `${scope}:${revision}:${retryCount}`;
    const [state, setState] = useState<(Loaded & { key: string; scope: string }) | null>(null);
    useEffect(() => {
        const wanted = JSON.parse(scope)[1] as typeof members;
        if (!wanted.length) return;
        const abort = new AbortController();
        void loadChildrenSquads(wanted, abort.signal).then(loaded => { if (!abort.signal.aborted) setState({ ...loaded, key, scope }); })
            .catch(e => { if (!abort.signal.aborted) setState({ squads: new Map(), failedSquads: [], error: extractApiErrorMessage(e, 'The squads could not load.'), key, scope }); });
        return () => abort.abort();
    }, [key, scope]);
    const retry = useCallback(() => setRetryCount(value => value + 1), []);
    if (!members.length) return { squads: new Map<number, api.SquadOverview[]>(), loading: false, error: '', failedSquads: [] as string[], retry };
    const visible = state?.scope === scope ? state : null;
    return { squads: visible?.squads ?? new Map<number, api.SquadOverview[]>(), loading: visible?.key !== key, error: visible?.error ?? '', failedSquads: visible?.failedSquads ?? [], retry };
}

/** The squads one child plays in, as their squad pages. */
export function useChildSquads(child: JoiningChild | undefined, revision = 0, sessionId?: AuthSessionId) {
    const [state, setState] = useState<{ scope: string; key: string; squads: api.SquadOverview[]; error: string; failedSquads: string[] } | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const clubs = child ? playingClubs(child).map(club => club.clubId) : [];
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
        void loadChildrenSquads([{ playerId, clubs: currentClubs }], abort.signal)
            .then(loaded => { if (current()) setState({ scope, key, squads: loaded.squads.get(playerId) ?? [], failedSquads: loaded.failedSquads, error: loaded.error }); })
            .catch(e => { if (current()) setState({ scope, key, squads: [], failedSquads: [], error: extractApiErrorMessage(e, 'The squads could not load.') }); });
        return () => abort.abort();
    }, [clubScope, key, playerId, scope]);
    if (playerId == null || !clubs.length) return { squads: [] as api.SquadOverview[], loading: false, error: '', failedSquads: [] as string[], retry };
    // Only this exact child/login/club scope may keep its last confirmed view while refreshing.
    const visible = state?.scope === scope ? state : null;
    return { squads: visible?.squads ?? [], loading: visible?.key !== key, error: visible?.error ?? '', failedSquads: visible?.failedSquads ?? [], retry };
}
