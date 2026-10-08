import { MediaImage } from '../../ui/MediaImage';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Camera, Loader2, PlayCircle, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession, type AuthSessionId } from '../../../utils/authStorage';
import type { FeedPostDto } from '../../feed/FeedPost';

export type ClubMediaType = 'pictures' | 'videos';
const isVideoUrl = (url: string) => /\.(mp4|mov|webm)(?:\?|$)/i.test(url);
type FeedPage = { posts?: FeedPostDto[]; nextCursor?: number | null };
type GalleryNavigation = { cursor: number | null; page: number; direction: 'older' | 'newer' };
type GalleryState = { posts: FeedPostDto[]; cursor: number | null; pageStarts: (number | null)[]; page: number; retryNavigation?: GalleryNavigation; loading: boolean; error: string | null };

export const TabMedia = ({ clubId, mediaType }: { clubId: number; mediaType: ClubMediaType }) => {
    const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return <ClubMediaGallery key={`${sessionId ?? 'guest'}:${clubId}:${mediaType}`} clubId={clubId} mediaType={mediaType} sessionId={sessionId} />;
};

const ClubMediaGallery = ({ clubId, mediaType, sessionId }: { clubId: number; mediaType: ClubMediaType; sessionId: AuthSessionId }) => {
    const [state, setState] = useState<GalleryState>({ posts: [], cursor: null, pageStarts: [null], page: 0, loading: true, error: null });
    const active = useRef(true);
    const request = useRef<AbortController | null>(null);
    const generation = useRef(0);
    const isVideos = mediaType === 'videos';
    const load = useCallback(async (navigation?: GalleryNavigation) => {
        if (!active.current || !isCurrentAuthSession(sessionId)) return;
        const cursor = navigation?.cursor ?? null;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const visit = ++generation.current;
        const current = () => active.current && visit === generation.current && isCurrentAuthSession(sessionId);
        setState(previous => ({ ...previous, loading: true, error: null }));
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: sessionId, signal: controller.signal, params: { cursor: cursor ?? undefined, limit: 20 } };
            const response = await apiClient.get<FeedPage>(`/posts/club/${clubId}`, config);
            if (!current()) return;
            if (!Array.isArray(response.data.posts)) throw new Error('The media page could not be read.');
            const next = response.data.nextCursor ?? null;
            if (next !== null && (!Number.isSafeInteger(next) || next <= 0 || (cursor !== null && next >= cursor))) throw new Error('The media page did not advance. Please retry.');
            const posts = response.data.posts.filter(post => Number.isSafeInteger(post.id) && post.id > 0 && (post.clubId == null || post.clubId === clubId));
            setState(previous => {
                const seen = new Set(navigation?.direction === 'older' ? previous.posts.map(post => post.id) : []);
                const uniquePosts = posts.filter(post => {
                    if (seen.has(post.id)) return false;
                    seen.add(post.id);
                    return true;
                });
                return { posts: uniquePosts, cursor: next,
                    pageStarts: navigation?.direction === 'older' ? [...previous.pageStarts.slice(0, navigation.page), cursor] : navigation ? previous.pageStarts : [null],
                    page: navigation?.page ?? 0, retryNavigation: undefined, loading: false, error: null };
            });
        } catch (error) {
            if (current() && !controller.signal.aborted) setState(previous => ({ ...previous, loading: false, retryNavigation: navigation, error: extractApiErrorMessage(error, 'Club media could not load. Please try again.') }));
        } finally {
            if (current()) request.current = null;
        }
    }, [clubId, sessionId]);

    useEffect(() => {
        active.current = true;
        void load();
        return () => { active.current = false; request.current?.abort(); };
    }, [load]);

    const media = useMemo(() => state.posts.flatMap(post => (post.mediaUrls?.length ? post.mediaUrls : post.image ? [post.image] : [])
        .map((url, index) => ({ url, index, postId: post.id, title: post.content || post.clubName || post.authorName })))
        .filter(item => isVideoUrl(resolveMediaUrl(item.url) ?? '') === isVideos), [state.posts, isVideos]);

    return <section className="rounded-[24px] border border-[color:var(--club-theme-border-subtle)] bg-[var(--club-card)] p-5" aria-label={isVideos ? 'Club videos' : 'Club photos'}>
        <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[color:var(--club-theme-text-primary)]">{isVideos ? 'Club videos' : 'Club photos'}</h2>
            <button type="button" disabled={state.loading} onClick={() => void load()} className="rounded-lg border border-[color:var(--club-theme-border-subtle)] px-3 py-2 text-xs disabled:opacity-50">Refresh {isVideos ? 'videos' : 'photos'}</button>
        </div>
        {state.error && <div role="alert" className="mb-4 space-y-2 rounded-xl border border-[color:var(--color-danger)]/30 p-3 text-sm text-[color:var(--color-danger)]">
            <p>{state.error}</p><button type="button" onClick={() => void load(state.retryNavigation)} disabled={state.loading} className="rounded-lg border border-[color:var(--color-danger)]/30 px-3 py-2">Retry media</button>
        </div>}
        {!state.loading && !state.error && media.length === 0 && <div className="py-8 text-center text-[color:var(--club-theme-text-secondary)]">
            {isVideos ? <Video className="mx-auto mb-3 h-9 w-9" /> : <Camera className="mx-auto mb-3 h-9 w-9" />}
            <p>{state.cursor ? `No ${isVideos ? 'videos' : 'photos'} in the posts loaded so far.` : `No ${isVideos ? 'videos' : 'photos'} published yet.`}</p>
            {state.cursor && <p className="mt-2 text-sm">Load older posts to keep looking.</p>}
        </div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map(item => {
                const url = resolveMediaUrl(item.url);
                return <Link key={`${item.postId}:${item.index}`} to={`/posts/${item.postId}?media=${item.index}`} aria-label={`Open ${isVideos ? 'video' : 'photo'} ${item.index + 1} from ${item.title}`}
                    className="overflow-hidden rounded-xl border border-[color:var(--club-theme-border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--club-tone-green)]">
                    <div className="relative aspect-square bg-[color:var(--color-ink)]/20">
                        {isVideos ? <div className="flex h-full w-full items-center justify-center bg-[color:var(--color-elevated)]/80"><PlayCircle className="h-10 w-10 text-[color:var(--color-text)]" aria-hidden="true" /></div>
                            : <MediaImage src={url || ''} alt={item.title} loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <p className="line-clamp-2 p-3 text-xs leading-5 text-[color:var(--club-theme-text-primary)]">{item.title}</p>
                </Link>;
            })}
        </div>
        {state.loading && <div role="status" className="flex items-center justify-center gap-2 py-5 text-sm"><Loader2 className="h-5 w-5 animate-spin" />Loading {isVideos ? 'videos' : 'photos'}…</div>}
        <div className="mt-5 flex flex-wrap gap-2">
            {state.page > 0 && <button type="button" disabled={state.loading} onClick={() => void load({ cursor: state.pageStarts[state.page - 1], page: state.page - 1, direction: 'newer' })} className="rounded-xl border border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-sm disabled:opacity-50">Newer posts</button>}
            {state.page > 1 && <button type="button" disabled={state.loading} onClick={() => void load()} className="rounded-xl border border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-sm disabled:opacity-50">Back to latest</button>}
            {state.cursor !== null && !state.error && <button type="button" disabled={state.loading} onClick={() => void load({ cursor: state.cursor, page: state.page + 1, direction: 'older' })} className="rounded-xl border border-[color:var(--club-theme-border-subtle)] px-4 py-3 text-sm disabled:opacity-50">Load older posts</button>}
        </div>
    </section>;
};
