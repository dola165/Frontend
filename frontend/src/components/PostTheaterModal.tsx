import { apiClient } from '../api/axiosConfig';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../utils/authStorage';
import { PostDialog } from './feed/PostDialogs';
import { PostComments, type SubmitComment } from './feed/PostComments';
import { ReactionButton } from './feed/ReactionButton';
import { ReactionSummary } from './feed/ReactionSummary';
import { selectedReaction, type Reaction } from './feed/reactions';
import { MediaImage } from './ui/MediaImage';
import { MediaVideo } from './ui/MediaVideo';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { X, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeedPostDto, CommentDto } from './feed/FeedPost';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { useDialogFocus } from './workspace/useDialogFocus';
import { createPortal } from 'react-dom';
import { usePanelMotion } from './ui/usePanelMotion';

interface PostTheaterModalProps {
    isOpen: boolean;
    post: FeedPostDto | null;
    onClose: () => void;
    commentsData?: CommentDto[];
    onSubmitComment: SubmitComment;
    onReactionChange?: (postId: number, reaction: Reaction | null) => void | Promise<void>;
    onLikeToggle: (postId: number) => void | Promise<void>;
    likePending?: boolean;
    likeError?: string | null;
    commentsLoading?: boolean;
    commentsError?: string | null;
    onRetryComments?: (postId: number) => void;
    initialMediaIndex?: number;
}

export const PostTheaterModal = (props: PostTheaterModalProps) => {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return props.isOpen && props.post ? <VerifiedPostMedia key={`${session}:${props.post.id}:${props.initialMediaIndex ?? 0}`} {...props} /> : null;
};

function VerifiedPostMedia(props: PostTheaterModalProps) {
    const id = props.post!.id;
    const [openingPost] = useState(props.post);
    const [verifiedComments, setVerifiedComments] = useState<CommentDto[]>([]);
    const [post, setPost] = useState<FeedPostDto | null>(null), [error, setError] = useState(false);
    const request = useRef<AbortController | null>(null);
    const readProjection = useCallback(async () => {
        request.current?.abort();
        const abort = new AbortController(), session = getAuthSessionId(); request.current = abort;
        const current = () => !abort.signal.aborted && request.current === abort && isCurrentAuthSession(session);
        try {
            const [{ data }, comments] = await Promise.all([apiClient.get<FeedPostDto>(`/posts/${id}`, { signal: abort.signal }), apiClient.get<CommentDto[]>(`/posts/${id}/comments`, { signal: abort.signal })]);
            if (!current()) return;
            if (data?.id !== id || !Array.isArray(comments.data)) throw Error('Invalid post projection');
            setPost(data); setVerifiedComments(comments.data); setError(false);
            return comments.data;
        } catch {
            if (current()) { setPost(null); setError(true); }
        }
    }, [id]);
    const reload = useCallback(() => { setPost(null); setError(false); return readProjection(); }, [readProjection]);
    useEffect(() => { void readProjection(); return () => request.current?.abort(); }, [readProjection]);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState !== 'hidden') void reload(); };
        const changed = (event: Event) => { if ((event as CustomEvent<number>).detail === id) refresh(); };
        window.addEventListener('pageshow', refresh); document.addEventListener('visibilitychange', refresh);
        window.addEventListener('gk-post-comments-changed', changed); window.addEventListener('gk-post-comment-created', changed);
        return () => { window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('gk-post-comments-changed', changed); window.removeEventListener('gk-post-comment-created', changed); };
    }, [id, reload]);
    if (!post) return <PostDialog title="Open post media" onClose={props.onClose}><p role={error ? 'alert' : 'status'}>{error ? 'This post is unavailable or could not load. Your comment draft is kept.' : 'Checking current post access…'}</p>{error && <button type="button" onClick={() => void reload()}>Retry</button>}</PostDialog>;
    const supplied = props.post!;
    return <PostTheaterContent {...props} onRetryComments={reload} commentsData={verifiedComments} commentsError={null} commentsLoading={false} post={supplied === openingPost ? post : { ...post, likeCount: supplied.likeCount, isLikedByMe: supplied.isLikedByMe, myReaction: supplied.myReaction, reactionCount: supplied.reactionCount, reactionCounts: supplied.reactionCounts }} />;
}

const PostTheaterContent = ({
    isOpen,
    post,
    onClose: finishClose,
    commentsData,
    onSubmitComment,
    onLikeToggle,
    onReactionChange,
    likePending = false,
    likeError = null,
    commentsLoading = false,
    commentsError = null,
    onRetryComments,
    initialMediaIndex = 0,
}: PostTheaterModalProps) => {
    const mediaCount = post?.mediaUrls?.length || (post?.image ? 1 : 0);
    const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Math.min(initialMediaIndex, mediaCount - 1)));
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const motion = usePanelMotion(finishClose);
    const onClose = motion.close;
    useDialogFocus(isOpen && post !== null, dialogRef, onClose, closeRef);


    useEffect(() => {
        if (!isOpen || mediaCount < 2) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey ||
                event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLVideoElement) return;
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setCurrentIndex(index => (index + 1) % mediaCount);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setCurrentIndex(index => (index - 1 + mediaCount) % mediaCount);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, mediaCount]);

    if (!isOpen || !post) return null;

    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % mediaList.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
    };

    const currentMediaUrl = resolveMediaUrl(mediaList[currentIndex]);
    const isVideo = currentMediaUrl?.match(/\.(mp4|mov|webm)(?:\?|$)/i);
    const authorAvatarUrl = resolveMediaUrl(post.authorAvatarUrl);

    return createPortal(
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} data-closing={motion.closing} className="app-motion-portal app-motion-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-overlay)]/85 p-2 backdrop-blur-sm sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close post viewer" className="absolute top-4 left-4 z-50 rounded-full bg-[color:var(--color-ink)]/10 p-2 text-[color:var(--color-on-media)] backdrop-blur-md transition-colors hover:bg-[color:var(--color-danger)]">
                <X className="h-6 w-6" />
            </button>

            <div className="app-motion-dialog flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)] shadow-2xl lg:flex-row" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} onClick={(event) => event.stopPropagation()}>
                <div className="group relative flex h-[55%] min-h-0 shrink-0 items-center justify-center overflow-hidden bg-[color:var(--color-page)] lg:h-full lg:flex-1">
                    {currentMediaUrl && (
                        isVideo ? (
                            <MediaVideo key={currentMediaUrl} src={currentMediaUrl} controls preload="metadata" className="app-media-arrival relative z-10 h-full w-full object-contain" />
                        ) : (
                            <MediaImage key={currentMediaUrl} src={currentMediaUrl} alt="Post media in viewer" className="app-media-arrival relative z-10 h-full w-full object-contain" />
                        )
                    )}

                    {mediaList.length > 1 && (
                        <>
                            <button type="button" onClick={handlePrev} aria-label="Previous post media" className="absolute left-4 z-20 rounded-full bg-[color:var(--color-overlay)]/50 p-3 text-[color:var(--color-on-media)] opacity-100 backdrop-blur-md transition-opacity hover:bg-[color:var(--color-overlay)]/80 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button type="button" onClick={handleNext} aria-label="Next post media" className="absolute right-4 z-20 rounded-full bg-[color:var(--color-overlay)]/50 p-3 text-[color:var(--color-on-media)] opacity-100 backdrop-blur-md transition-opacity hover:bg-[color:var(--color-overlay)]/80 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                                <ChevronRight className="h-6 w-6" />
                            </button>
                            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[color:var(--color-overlay)]/60 px-4 py-1.5 text-xs font-semibold text-[color:var(--color-on-media)] backdrop-blur-md">
                                {currentIndex + 1} / {mediaList.length}
                            </div>
                        </>
                    )}
                </div>

                <div className="post-theater-details flex min-h-0 w-full flex-1 flex-col overflow-y-auto border-l border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)] lg:h-full lg:w-[400px] lg:shrink-0 lg:flex-none lg:overflow-hidden xl:w-[450px]">
                    <div className="shrink-0 border-b border-[color:var(--color-border)]/[0.06] p-5">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-on-accent)] ">
                                {authorAvatarUrl ? (
                                    <MediaImage src={authorAvatarUrl} alt={post.clubName || post.authorName} className="h-full w-full object-cover" />
                                ) : (
                                    (post.clubName || post.authorName).substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <div>
                                <h2 id={titleId} className="font-semibold text-[var(--color-text)]">Post by {post.clubName || post.authorName}</h2>
                                <p className="text-xs text-[var(--color-secondary)]">{formatTime(post.createdAt)}</p>
                            </div>
                        </div>
                        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[var(--color-muted)]">{post.content}</p>
                    </div>

                    <div className="post-theater-reactions flex shrink-0 items-center justify-between border-b border-[color:var(--color-border)]/[0.06] px-5 py-3">
                        <ReactionSummary post={post} />
                        <div className="flex gap-2">
                            <ReactionButton value={selectedReaction(post)} disabled={likePending} allowAll={Boolean(onReactionChange)} onChange={reaction => { if (onReactionChange) void onReactionChange(post.id, reaction); else void onLikeToggle(post.id); }} />
                            <button type="button" aria-label="Focus comment input" onClick={() => document.getElementById(`post-theater-comment-${post.id}`)?.focus()} className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-secondary)] transition-colors hover:text-[var(--color-accent)]">
                                <MessageCircle className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="min-h-0 overflow-y-auto">
                        <PostComments postId={post.id} author={post.clubName || post.authorName} inputId={`post-theater-comment-${post.id}`} comments={commentsData} error={commentsError} loading={commentsLoading} retry={onRetryComments} submit={onSubmitComment} />
                        {likeError && <p role="alert">{likeError}</p>}
                    </div>
                </div>
            </div>
        </div>, document.body
    );
};
