import { useState, type ReactNode } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { useWorldData } from '../../useWorldData';
import { FollowingContext, loadFollowing } from './following';

/**
 * Who the signed-in person follows, for every card on the page. Following is a toggle on the server, so Follow
 * (`FollowButton`) is offered only when the current state is known: a card never unfollows someone by mistake.
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
    const set = (id: number, following: boolean) => setChanged(map => new Map(map).set(id, following));
    return <FollowingContext.Provider value={{ follows, set }}>{children}</FollowingContext.Provider>;
}
