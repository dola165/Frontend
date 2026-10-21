import { useAuth } from '../../../context/AuthContext';
import type { Squad } from '../../matchExchange/api';
import { mySquads } from '../../matchExchange/arrange/api';
import { detached, shared } from '../cache';
import { useWorldData } from '../useWorldData';

/**
 * The squads the person may arrange matches for (`GET /match-exchange/squads`), the real permission behind "Arrange a
 * match", "Propose a match", offering to play and answering an invitation, never the role picked in World. One request
 * for every row that asks, kept a minute. `squads` is undefined while unknown (loading, or the request failed: `error`
 * says so and `retry` asks again); none when signed out.
 */
export function useArrangeableSquadsState(): { squads: Squad[] | undefined; error: string; retry: () => void } {
    const { status, sessionId } = useAuth();
    const loaded = useWorldData(status === 'authenticated' ? `arrange-squads:${sessionId}` : null, () => shared(`arrange-squads:${sessionId}`, () => mySquads(detached())));
    if (status !== 'authenticated') return { squads: status === 'bootstrapping' ? undefined : [], error: '', retry: loaded.retry };
    return { squads: loaded.data, error: loaded.error, retry: loaded.retry };
}

/** The squads the person may arrange matches for; undefined while that is not known. */
export const useArrangeableSquads = () => useArrangeableSquadsState().squads;
