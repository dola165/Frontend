import { useEffect, useLayoutEffect, useRef } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { normalizeFeedPost } from '../../utils/normalizeFeedPost';
import type { CommentDto, FeedPostDto } from './FeedPost';

/** Reconcile acknowledged creates/replays and confirmed edits/deletions/reactions in every mounted view, with server counts. */
export function useCommentRefresh(accepts: (id: number) => boolean, saved: (post: FeedPostDto, comments: CommentDto[] | undefined) => void, unavailable: (id: number) => void) {
    const callbacks = useRef({ accepts, saved, unavailable });
    useLayoutEffect(() => { callbacks.current = { accepts, saved, unavailable }; }, [accepts, saved, unavailable]);
    useEffect(() => {
        const requests = new Map<number, AbortController>();
        const refresh = (event: Event) => {
            const id = (event as CustomEvent<number>).detail;
            if (!callbacks.current.accepts(id)) return;
            requests.get(id)?.abort();
            const abort = new AbortController(), session = getAuthSessionId(); requests.set(id, abort);
            const current = () => !abort.signal.aborted && isCurrentAuthSession(session) && callbacks.current.accepts(id);
            const postRead = apiClient.get<FeedPostDto>(`/posts/${id}`, { signal: abort.signal }).then(post => {
                // The count remains authoritative even if the separate comment-list read fails or waits.
                if (current() && post.data.id === id) callbacks.current.saved(normalizeFeedPost(post.data), undefined);
                return post;
            });
            void Promise.all([postRead, apiClient.get<CommentDto[]>(`/posts/${id}/comments`, { signal: abort.signal })]).then(([post, comments]) => {
                if (current() && post.data.id === id) callbacks.current.saved(normalizeFeedPost(post.data), comments.data);
            }).catch(error => {
                if (current() && [401, 403, 404].includes(error?.response?.status)) { abort.abort(); callbacks.current.unavailable(id); }
            });
        };
        window.addEventListener('gk-post-comments-changed', refresh);
        window.addEventListener('gk-post-comment-created', refresh);
        return () => { window.removeEventListener('gk-post-comments-changed', refresh); window.removeEventListener('gk-post-comment-created', refresh); requests.forEach(request => request.abort()); };
    }, []);
}
