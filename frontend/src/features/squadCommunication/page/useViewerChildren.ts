import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchJoiningChildren, type JoiningChild } from '../../parents/api';
import type * as api from '../api';

/**
 * The viewer's own children in this squad, for the parent controls on the squad page (a parent who is also the
 * coach sees both). Only asked for people with a linked child; the server still decides who may answer for whom.
 */
export function useViewerChildren(space: api.SquadOverview | null) {
    return useViewerFamily(space).children;
}

/**
 * The viewer's children in this squad, and whether that is known yet (a parent's list may still be loading). A list
 * that failed to load is not "no children": `error` says so and `retry` asks again; the parent controls stay off.
 */
export function useViewerFamily(space: api.SquadOverview | null) {
    const { user, sessionId } = useAuth();
    const parent = hasNavigationCapability(user?.navigationCapabilities, 'parent.hub');
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<{ sessionId: string | null; children: JoiningChild[]; error: string } | null>(null);
    useEffect(() => {
        if (!parent) return;
        const abort = new AbortController();
        void fetchJoiningChildren(sessionId, abort.signal).then(result => { if (!abort.signal.aborted) setLoaded({ sessionId, children: result.children, error: '' }); })
            .catch(cause => { if (!abort.signal.aborted) setLoaded({ sessionId, children: [], error: extractApiErrorMessage(cause, 'Your children could not load.') }); });
        return () => abort.abort();
    }, [parent, sessionId, attempt]);
    const retry = useCallback(() => setAttempt(value => value + 1), []);
    const ids = new Set(space?.players.map(player => player.id) ?? []);
    const current = loaded?.sessionId === sessionId ? loaded : null;
    const error = parent && current?.error ? current.error : '';
    return { children: parent && current ? current.children.filter(child => ids.has(child.playerId)) : [], known: !parent || (current !== null && !error), error, retry };
}
