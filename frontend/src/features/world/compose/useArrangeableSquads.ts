import { useAuth } from '../../../context/AuthContext';
import type { Squad } from '../../matchExchange/api';
import { mySquads } from '../../matchExchange/arrange/api';
import { detached, shared } from '../cache';
import { useWorldData } from '../useWorldData';

/**
 * The squads the person may arrange matches for (`GET /match-exchange/squads`): the real permission behind "Arrange a
 * match" and "Propose a match", never the role picked in World. One request for every row that asks, kept a minute.
 * `undefined` while it loads; none when signed out.
 */
export function useArrangeableSquads(): Squad[] | undefined {
    const { status, sessionId } = useAuth();
    const squads = useWorldData(status === 'authenticated' ? `arrange-squads:${sessionId}` : null, () => shared(`arrange-squads:${sessionId}`, () => mySquads(detached())));
    if (status !== 'authenticated') return status === 'bootstrapping' ? undefined : [];
    return squads.loading ? undefined : squads.data ?? [];
}
