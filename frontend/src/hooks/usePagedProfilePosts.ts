import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/axiosConfig';
import type { FeedPostDto } from '../components/feed/FeedPost';
import { normalizeFeedPost } from '../utils/normalizeFeedPost';
import { extractApiErrorMessage } from '../utils/apiError';

/** Retain one page of post/media data; earlier pages are fetched on demand. */
export function usePagedProfilePosts(endpoint: string) {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [paging, setPaging] = useState<{ endpoint: string; cursors: (number | undefined)[]; index: number }>({ endpoint, cursors: [undefined], index: 0 });
    const active = paging.endpoint === endpoint ? paging : { endpoint, cursors: [undefined], index: 0 };
    const cursor = active.cursors[active.index];
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [finishedKey, setFinishedKey] = useState('');
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const requestKey = `${endpoint}:${cursor || 'first'}:${revision}`;
    const loading = finishedKey !== requestKey;
    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<{ posts: FeedPostDto[]; nextCursor?: number | null }>(endpoint, { signal: controller.signal, params: { limit: 20, ...(cursor ? { cursor } : {}) } })
            .then(response => {
                if (controller.signal.aborted) return;
                const values = (response.data.posts || []).slice(0, 20).map(normalizeFeedPost);
                setPosts(values); setError('');
                const next = response.data.nextCursor;
                setNextCursor(typeof next === 'number' && next > 0 && next !== cursor ? next : null);
            }).catch(failure => { if (!controller.signal.aborted) { setPosts([]); setNextCursor(null); setError(extractApiErrorMessage(failure, 'Posts could not load. Please try again.')); } })
            .finally(() => { if (!controller.signal.aborted) setFinishedKey(requestKey); });
        return () => controller.abort();
    }, [endpoint, cursor, revision, requestKey]);
    const refresh = useCallback(() => { setPaging({ endpoint, cursors: [undefined], index: 0 }); setRevision(value => value + 1); }, [endpoint]);
    const older = () => { if (!loading && nextCursor) setPaging({ endpoint, cursors: [...active.cursors.slice(0, active.index + 1), nextCursor], index: active.index + 1 }); };
    const newer = () => { if (!loading && active.index) setPaging({ ...active, index: active.index - 1 }); };
    return { posts: loading ? [] : posts, setPosts, loading, error: loading ? '' : error, refresh, retry: () => setRevision(value => value + 1), older, newer, hasOlder: !loading && nextCursor != null, hasNewer: active.index > 0, page: active.index + 1, pageKey: `${endpoint}:${cursor || 'first'}` };
}
