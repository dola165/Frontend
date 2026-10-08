import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const key = (userId: number | undefined, sessionId: string | null) => `family-player:${userId}:${sessionId}`;
export function readSelectedPlayer(userId: number | undefined, sessionId: string | null) {
    try { return positivePlayerId(sessionStorage.getItem(key(userId, sessionId))); } catch { return undefined; }
}
export function positivePlayerId(value: string | null) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
export function playerPath(path: string, playerId?: number | null) {
    if (!playerId) return path;
    const [pathname, search = ''] = path.split('?');
    const params = new URLSearchParams(search); params.set('player', String(playerId));
    return `${pathname}?${params}`;
}

/** Remember context within this account session. Server responses still decide authorization. */
export function usePlayerSelection() {
    const { user, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const requestedPlayerId = params.has('player') ? positivePlayerId(params.get('player')) : readSelectedPlayer(user?.id, sessionId);
    const selectPlayer = (playerId?: number) => {
        const next = new URLSearchParams(params);
        if (playerId) next.set('player', String(playerId)); else next.delete('player');
        try {
            if (playerId) sessionStorage.setItem(key(user?.id, sessionId), String(playerId));
            else sessionStorage.removeItem(key(user?.id, sessionId));
        } catch { /* URL context remains usable when storage is unavailable. */ }
        setParams(next, { replace: true });
    };
    return { requestedPlayerId, selectPlayer };
}
