import { useState, type ReactNode } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../../../api/axiosConfig';
import { useAuth } from '../../../../context/AuthContext';
import { useWorldData } from '../../useWorldData';
import { FollowingContext, loadFollowing } from './following';

/**
 * Who the signed-in person follows, for every card on the page. Following is a toggle on the server, so Follow is
 * offered only when the current state is known: a card never unfollows someone by mistake.
 */
export function FollowingProvider({ children }: { children: ReactNode }) {
    const { user, sessionId } = useAuth();
    const loaded = useWorldData(user ? `following:${sessionId}:${user.id}` : null, signal => loadFollowing(user!.id, sessionId, signal));
    const [changed, setChanged] = useState(() => new Map<number, boolean>());
    const follows = (id: number) => {
        if (!user || id === user.id) return undefined;
        if (changed.has(id)) return changed.get(id);
        if (!loaded.data) return undefined;
        return loaded.data.ids.has(id) ? true : loaded.data.complete ? false : undefined;
    };
    const toggle = async (id: number) => {
        const now = follows(id);
        if (now === undefined) return;
        setChanged(map => new Map(map).set(id, !now));
        try {
            const { data } = await apiClient.post<{ following?: boolean }>(`/users/${id}/follow`, undefined, { _authSessionId: sessionId } as AuthSessionRequestConfig);
            if (typeof data?.following === 'boolean') setChanged(map => new Map(map).set(id, data.following!));
        } catch (error) {
            setChanged(map => new Map(map).set(id, now));
            throw error;
        }
    };
    return <FollowingContext.Provider value={{ follows, toggle }}>{children}</FollowingContext.Provider>;
}
