import { ReactionButton } from './feed/ReactionButton';
import { ReactionSummary } from './feed/ReactionSummary';
import { selectedReaction, type Reaction } from './feed/reactions';
import { MediaImage } from './ui/MediaImage';
import { MediaVideo } from './ui/MediaVideo';
import { useEffect, useId, useRef, useState } from 'react';
import { X, MessageCircle, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeedPostDto, CommentDto } from './feed/FeedPost';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../utils/apiError';
import { useDialogFocus } from './workspace/useDialogFocus';
import { createPortal } from 'react-dom';
import { usePanelMotion } from './ui/usePanelMotion';

interface PostTheaterModalProps {
    isOpen: boolean;
    post: FeedPostDto | null;
    onClose: () => void;
    commentsData?: CommentDto[];
    onSubmitComment: (postId: number, content: string) => void | Promise<void>;
    onReactionChange?: (postId: number, reaction: Reaction | null) => void | Promise<void>;
    onLikeToggle: (postId: number) => void | Promise<void>;
    likePending?: boolean;
    likeError?: string | null;
    commentsLoading?: boolean;
    commentsError?: string | null;
    onRetryComments?: (postId: number) => void;
    initialMediaIndex?: number;
}

export const PostTheaterModal = (props: PostTheaterModalProps) => props.isOpen && props.post ? <PostTheaterContent {...props} /> : null;

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
    const [commentInput, setCommentInput] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [commentPending, setCommentPending] = useState(false);
    const [commentError, setCommentError] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const motion = usePanelMotion(finishClose);
    const onClose = motion.close;
    useDialogFocus(isOpen && post !== null, dialogRef, onClose, closeRef);

    const mediaCount = post?.mediaUrls?.length || (post?.image ? 1 : 0);
    useEffect(() => {
        if (isOpen) setCurrentIndex(Math.max(0, Math.min(initialMediaIndex, mediaCount - 1)));
    }, [isOpen, post?.id, initialMediaIndex, mediaCount]);

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

    const handleCommentSubmit = async () => {
        const submittedContent = commentInput.trim();
        if (!submittedContent || commentPending) return;
        setCommentPending(true);
        setCommentError('');
        try {
            await onSubmitComment(post.id, submittedContent);
            setCommentInput((current) => current.trim() === submittedContent ? '' : current);
        } catch (error) {
            setCommentError(extractApiErrorMessage(error, 'Comment could not be posted. Your draft is still here.'));
        } finally {
            setCommentPending(false);
        }
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
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close post viewer" className="absolute top-4 left-4 z-50 rounded-full bg-[color:var(--color-ink)]/10 p-2 text-[color:var(--color-on-accent)] backdrop-blur-md transition-colors hover:bg-[color:var(--color-danger)]">
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

                <div className="post-theater-details flex min-h-0 w-full flex-1 flex-col overflow-y-auto border-l border-[color:var(--color-border)]/[0.06] bg-[var(--color-overlay)] lg:h-full lg:w-[400px] lg:shrink-0 lg:flex-none lg:overflow-hidden xl:w-[450px]">
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

                    <div className="shrink-0 space-y-4 p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                        {commentsError ? (
                            <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
                                <span className="text-xs font-medium text-[color:var(--color-danger)]">{commentsError}</span>
                                {onRetryComments && (
                                    <button type="button" onClick={() => onRetryComments(post.id)} className="rounded-full border border-[color:var(--color-danger)]/30 px-4 py-2 text-xs font-semibold text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger)]/10">
                                        Retry comments
                                    </button>
                                )}
                            </div>
                        ) : commentsLoading ? (
                            <div className="flex justify-center py-10"><span className="text-xs font-medium text-[var(--color-secondary)]">Loading comments...</span></div>
                        ) : !commentsData ? (
                            <div className="flex flex-col items-center gap-3 py-10 text-center">
                                <span className="text-xs font-medium text-[var(--color-secondary)]">Comments are unavailable.</span>
                                {onRetryComments && (
                                    <button type="button" onClick={() => onRetryComments(post.id)} className="rounded-full border border-[color:var(--color-border)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[color:var(--color-ink)]/5 hover:text-[color:var(--color-text)]">
                                        Load comments
                                    </button>
                                )}
                            </div>
                        ) : commentsData.length === 0 ? (
                            <div className="flex justify-center py-10"><span className="text-xs font-medium text-[var(--color-secondary)]">No comments yet.</span></div>
                        ) : (
                            commentsData.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-secondary)]">
                                        {resolveMediaUrl(comment.authorAvatarUrl) ? (
                                            <MediaImage src={resolveMediaUrl(comment.authorAvatarUrl)} alt={comment.authorName} className="h-full w-full object-cover" />
                                        ) : (
                                            comment.authorName.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1 rounded-xl bg-[var(--color-surface)] p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[var(--color-text)]">{comment.authorName}</span>
                                            <span className="text-xs text-[var(--color-muted)]">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-[var(--color-muted)]">{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="shrink-0 border-t border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)] p-4">
                        <div className="relative flex gap-2">
                            <input
                                id={`post-theater-comment-${post.id}`}
                                type="text"
                                aria-label={`Write a comment on ${post.clubName || post.authorName}'s post`}
                                placeholder="Write a comment..."
                                value={commentInput}
                                onChange={(e) => {
                                    setCommentInput(e.target.value);
                                    setCommentError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleCommentSubmit();
                                    }
                                }}
                                className="w-full rounded-full border border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)] py-3 pl-5 pr-12 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]"
                            />
                            <button
                                aria-label="Post comment"
                                onClick={() => void handleCommentSubmit()}
                                disabled={!commentInput.trim() || commentPending}
                                className="absolute right-1.5 top-1.5 bottom-1.5 rounded-full bg-[var(--color-accent)] px-3 text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-40"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        {(commentError || likeError) && <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--color-danger)]">{commentError || likeError}</p>}
                    </div>
                </div>
            </div>
        </div>, document.body
    );
};
