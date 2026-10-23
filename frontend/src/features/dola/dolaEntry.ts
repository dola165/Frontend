import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { agentDolaStatus } from './agentDola';
import { dolaStatus } from './api';

/**
 * Where the header's Agent Dola link goes, decided from what is actually switched on:
 * - `team-work`: Agent Dola answers for this team member, so the link opens Team work with the Dola panel open;
 * - `assistant`: the old site-wide assistant is on, so the link opens it as before;
 * - `null`: neither answers (or it is still being checked), so there is no link: never a working-looking link to
 *   something that is off.
 */
export type DolaEntry = 'team-work' | 'assistant' | null;
export const TEAM_WORK_DOLA_PATH = '/team-work?dola=open';

/** Checked once per signed-in account and session: the two status reads are cheap and never call a model. */
export function useDolaEntry(userId: number): DolaEntry {
    const { sessionId } = useAuth();
    // The answer belongs to the account and session it was read for; another account sees nothing until its own arrives.
    const key = `${userId}:${String(sessionId)}`;
    const [found, setFound] = useState<{ key: string; entry: DolaEntry }>({ key: '', entry: null });

    useEffect(() => {
        const controller = new AbortController();
        // Anyone off the team gets a 404 from Agent Dola; that is an answer ("not for you"), not an error to show.
        void agentDolaStatus(controller.signal).then(status => status.available, () => false)
            .then(async team => team ? 'team-work' as const
                : await dolaStatus(sessionId, controller.signal).then(status => status.available ? 'assistant' as const : null, () => null))
            .then(entry => { if (!controller.signal.aborted) setFound({ key, entry }); });
        return () => controller.abort();
    }, [key, sessionId]);

    return found.key === key ? found.entry : null;
}
