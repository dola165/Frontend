import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { onAccessRefresh } from '../../hooks/accessRefresh';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';

/**
 * Someone the person may post as besides themselves (step 7): a club (`squadId` null) or one of its squads, as the one
 * rule-checker answers it (`GET /posts/authors`). The composer offers only these, so the server never refuses what the
 * screen offered: the Owner, Admins and the Media officer for the whole club; coaches and team managers for their squads.
 * `leadership` (on a club's entry) is whether they may also post to Club leadership: its Owner and Admins only.
 */
export interface PostAuthor { clubId: number; clubName: string; crestUrl?: string | null; squadId?: number | null; name: string; leadership?: boolean }

export const authorKey = (author: PostAuthor) => author.squadId ? `squad:${author.squadId}` : `club:${author.clubId}`;

const cache = new Map<string, Promise<PostAuthor[]>>();
// Someone's jobs changed (accepted, ended, handed over; or new workspaces from /users/me): ask again everywhere.
onAccessRefresh(() => cache.clear());

/**
 * One answer per session, asked again when someone's responsibilities change. An error answers "nobody else", so the
 * composer still posts as the person; the server decides every post either way.
 */
export function usePostAuthors(enabled = true): { authors: PostAuthor[]; loaded: boolean } {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [round, setRound] = useState(0);
    useEffect(() => onAccessRefresh(() => setRound(value => value + 1)), []);
    const [state, setState] = useState<{ session: string | null; authors: PostAuthor[] } | null>(null);
    useEffect(() => {
        if (!enabled || !session) return;
        let live = true;
        let found = cache.get(session);
        if (!found) {
            found = apiClient.get<PostAuthor[]>('/posts/authors').then(response => Array.isArray(response.data) ? response.data : []);
            const asked = found;
            asked.catch(() => { if (cache.get(session) === asked) cache.delete(session); });
            cache.set(session, found);
        }
        found.then(authors => { if (live) setState({ session, authors }); }, () => { if (live) setState({ session, authors: [] }); });
        return () => { live = false; };
    }, [enabled, session, round]);
    const current = state && state.session === session ? state.authors : null;
    return { authors: current ?? [], loaded: current !== null };
}
