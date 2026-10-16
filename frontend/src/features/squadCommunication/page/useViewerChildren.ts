import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { fetchJoiningChildren, type JoiningChild } from '../../parents/api';
import type * as api from '../api';

/**
 * The viewer's own children in this squad, for the parent controls on the squad page (a parent who is also the
 * coach sees both). Only asked for people with a linked child; the server still decides who may answer for whom.
 */
export function useViewerChildren(space: api.SquadOverview | null) {
    const { user, sessionId } = useAuth();
    const parent = hasNavigationCapability(user?.navigationCapabilities, 'parent.hub');
    const [children, setChildren] = useState<JoiningChild[]>([]);
    useEffect(() => {
        if (!parent) return;
        const abort = new AbortController();
        void fetchJoiningChildren(sessionId, abort.signal).then(result => { if (!abort.signal.aborted) setChildren(result.children); }).catch(() => { /* Parent controls stay off. */ });
        return () => abort.abort();
    }, [parent, sessionId]);
    const ids = new Set(space?.players.map(player => player.id) ?? []);
    return parent ? children.filter(child => ids.has(child.playerId)) : [];
}
