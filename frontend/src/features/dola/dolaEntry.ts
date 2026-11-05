import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { agentDolaStatus } from './agentDola';
import { dolaStatus } from './api';

/**
 * Where the header's Agent Dola link goes, decided from what is actually switched on:
 * - `agent-dola`: Agent Dola answers for this person (every signed-in customer; each role gets its own Dola), so the
 *   link opens its panel over the page they are on;
 * - `assistant`: the old site-wide assistant is on, so the link opens it as before;
 * - `null`: neither answers (or it is still being checked), so there is no link: never a working-looking link to
 *   something that is off.
 */
export type DolaEntry = 'agent-dola' | 'assistant' | null;
/** Where the link points when opened in a new tab: Team work for the team, Home for everyone else (both open the panel). */
export const TEAM_WORK_DOLA_PATH = '/team-work?dola=open';
export const HOME_DOLA_PATH = '/home?dola=open';

/** Checked once per signed-in account and session: the two status reads are cheap and never call a model. */
export function useDolaEntry(userId: number): DolaEntry {
    const { sessionId } = useAuth();
    // The answer belongs to the account and session it was read for; another account sees nothing until its own arrives.
    const key = `${userId}:${String(sessionId)}`;
    const [found, setFound] = useState<{ key: string; entry: DolaEntry }>({ key: '', entry: null });

    useEffect(() => {
        const controller = new AbortController();
        // A failed check (an older server answering 404) is an answer ("not here"), not an error to show.
        void agentDolaStatus(controller.signal).then(status => status.available, () => false)
            .then(async on => on ? 'agent-dola' as const
                : await dolaStatus(sessionId, controller.signal).then(status => status.available ? 'assistant' as const : null, () => null))
            .then(entry => { if (!controller.signal.aborted) setFound({ key, entry }); });
        return () => controller.abort();
    }, [key, sessionId]);

    return found.key === key ? found.entry : null;
}
