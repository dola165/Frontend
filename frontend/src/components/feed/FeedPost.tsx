import { useState, type ReactNode } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Send, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';

export interface CommentDto {
    id: number;
    authorName: string;
    authorAvatarUrl?: string | null;
    content: string;
    createdAt: string;
}

export interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorId?: number | null;
    authorName: string;
    authorAvatarUrl?: string | null;
    clubId?: number | null;
    clubName?: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
    image?: string;
    mediaUrls?: string[];
}

interface FeedPostProps {
    post: FeedPostDto;
    isCommentsOpen: boolean;
    commentsData?: CommentDto[];
    onLikeToggle: (postId: number) => void | Promise<void>;
    onToggleComments: (postId: number) => void;
    onSubmitComment: (postId: number, content: string) => void | Promise<void>;
    onImageClick: () => void;
    likePending?: boolean;
    likeError?: string | null;
    commentsError?: string | null;
    onRetryComments?: (postId: number) => void;
    compact?: boolean;
}

export const FeedPost = ({
    post,
    isCommentsOpen,
    commentsData,
    onLikeToggle,
    onToggleComments,
    onSubmitComment,
    onImageClick,
    likePending = false,
    likeError = null,
    commentsError = null,
    onRetryComments,
    compact = false
}: FeedPostProps) => {
    const [commentInput, setCommentInput] = useState('');
    const [shareFeedback, setShareFeedback] = useState('');
    const [commentPending, setCommentPending] = useState(false);
    const [commentError, setCommentError] = useState('');

    const formatTime = (dateString: string) =>
        new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const initials = (post.clubName || post.authorName).substring(0, 2).toUpperCase();
    const authorAvatarUrl = resolveMediaUrl(post.authorAvatarUrl);
    const displayAuthorName = post.clubName || post.authorName;
    const authorProfilePath = post.clubId != null
        ? `/clubs/${post.clubId}`
        : post.authorId != null
            ? `/profile/${post.authorId}`
            : null;

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

    const handleShare = async () => {
        const shareTitle = post.clubName || post.authorName || 'Talanti post';
        const shareText = `${shareTitle}\n\n${post.content}`.trim();
        const shareUrl = new URL(`/posts/${post.id}`, window.location.origin).toString();
        setShareFeedback('');

        try {
            if (navigator.share) {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                setShareFeedback('Post shared.');
                return;
            }
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                setShareFeedback('Post link copied.');
                return;
            }
        } catch {
            setShareFeedback('Sharing was cancelled or did not work.');
            return;
        }
        setShareFeedback('Sharing is unavailable on this device.');
    };

    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];
    const authorIdentity = (
        <>
            <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] font-semibold text-[var(--feed-text-secondary)] ring-2 ring-transparent transition-all group-hover/author:ring-[var(--feed-accent-border)] ${compact ? 'h-11 w-11 text-sm' : 'h-12 w-12 text-base'}`}>
                {authorAvatarUrl ? <img src={authorAvatarUrl} alt={displayAuthorName} className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-base font-semibold text-[var(--feed-text-primary)] transition-colors group-hover/author:text-[var(--feed-accent)]">{displayAuthorName}</h4>
                    {post.clubName && <span className="rounded-full bg-[var(--feed-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--feed-accent)]">Official</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--feed-text-muted)]">
                    <span>{formatTime(post.createdAt)}</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--feed-icon-muted)]" />
                    <span>{post.likeCount} likes</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--feed-icon-muted)]" />
                    <span>{post.commentCount} comments</span>
                </div>
            </div>
        </>
    );

    const renderMediaGrid = () => {
        if (mediaList.length === 0) return null;

        const MediaItem = ({ url, className }: { url: string; className: string }) => {
            const finalUrl = resolveMediaUrl(url);
            const isVideo = finalUrl?.match(/\.(mp4|mov|webm)$/i);
            return isVideo ? <video src={finalUrl} className={`object-cover ${className}`} /> : <img src={finalUrl} alt="Post media" className={`object-cover ${className}`} />;
        };

        const count = mediaList.length;

        return (
            <div className="cursor-pointer overflow-hidden border-y border-[var(--feed-card-border)]" onClick={onImageClick}>
                {count === 1 && (
                    <div className={`relative flex w-full items-center justify-center overflow-hidden bg-black ${compact ? 'max-h-[32vh]' : 'max-h-[56vh]'}`}>
                        <MediaItem url={mediaList[0]} className={`relative z-10 w-full object-contain ${compact ? 'max-h-[32vh]' : 'max-h-[56vh]'}`} />
                    </div>
                )}
                {count === 2 && (
                    <div className="grid grid-cols-2 gap-px bg-[var(--feed-bg)]">
                        <MediaItem url={mediaList[0]} className={`w-full bg-black ${compact ? 'h-32' : 'h-56'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full bg-black ${compact ? 'h-32' : 'h-56'}`} />
                    </div>
                )}
                {count === 3 && (
                    <div className="grid grid-cols-2 gap-px bg-[var(--feed-bg)]">
                        <MediaItem url={mediaList[0]} className={`col-span-2 w-full bg-black ${compact ? 'h-40' : 'h-64'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full bg-black ${compact ? 'h-24' : 'h-32'}`} />
                        <MediaItem url={mediaList[2]} className={`w-full bg-black ${compact ? 'h-24' : 'h-32'}`} />
                    </div>
                )}
                {count >= 4 && (
                    <div className="grid grid-cols-2 gap-px bg-[var(--feed-bg)]">
                        <MediaItem url={mediaList[0]} className={`w-full bg-black ${compact ? 'h-28' : 'h-40'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full bg-black ${compact ? 'h-28' : 'h-40'}`} />
                        <MediaItem url={mediaList[2]} className={`w-full bg-black ${compact ? 'h-28' : 'h-40'}`} />
                        <div className={`relative w-full ${compact ? 'h-28' : 'h-40'}`}>
                            <MediaItem url={mediaList[3]} className="h-full w-full bg-black" />
                            {count > 4 && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xl font-bold text-white">+{count - 4}</div>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <article className="overflow-hidden rounded-xl border-2 border-[var(--feed-card-border)] bg-[var(--feed-card)] shadow-[0_4px_24px_rgba(0,0,0,0.16)]">
            <div className={`${compact ? 'px-5 py-4' : 'px-6 py-5'} flex items-start justify-between gap-3`}>
                {authorProfilePath ? (
                    <Link
                        to={authorProfilePath}
                        aria-label={`View ${displayAuthorName} profile`}
                        className="group/author flex min-w-0 items-start gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--feed-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--feed-card)]"
                    >
                        {authorIdentity}
                    </Link>
                ) : (
                    <div className="flex min-w-0 items-start gap-4">{authorIdentity}</div>
                )}
                <button type="button" className="rounded-full p-1 text-[var(--feed-text-placeholder)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-secondary)]">
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>

            <div className={`${compact ? 'px-5 pb-4' : 'px-6 pb-5'}`}>
                <p className="whitespace-pre-line text-base leading-7 text-[var(--feed-text-primary)]">{post.content}</p>
            </div>

            {renderMediaGrid()}

            <div className="flex border-t border-[var(--feed-card-border)]">
                <ActionButton
                    active={post.isLikedByMe}
                    icon={<Heart className={`h-4 w-4 ${post.isLikedByMe ? 'fill-current' : ''}`} />}
                    label="Like"
                    onClick={() => void onLikeToggle(post.id)}
                    disabled={likePending}
                />
                <ActionButton
                    active={isCommentsOpen}
                    icon={<MessageCircle className="h-4 w-4" />}
                    label="Comment"
                    onClick={() => onToggleComments(post.id)}
                />
                <ActionButton
                    active={false}
                    icon={<Share2 className="h-4 w-4" />}
                    label="Share"
                    onClick={handleShare}
                />
            </div>

            {shareFeedback && (
                <div aria-live="polite" className="px-4 pb-1 text-xs font-medium text-[var(--feed-accent)]">{shareFeedback}</div>
            )}

            {likeError && <div role="alert" className="px-4 pb-2 text-xs font-medium text-rose-400">{likeError}</div>}

            {isCommentsOpen && (
                <div className="border-t border-[var(--feed-card-border)] bg-[var(--feed-surface)] px-4 py-3">
                    <div className="mb-3 flex max-h-60 flex-col gap-3 overflow-y-auto">
                        {commentsError ? (
                            <div role="alert" className="flex items-center justify-between gap-3 text-xs text-rose-400">
                                <span>{commentsError}</span>
                                {onRetryComments && <button type="button" onClick={() => onRetryComments(post.id)} className="font-semibold underline">Retry</button>}
                            </div>
                        ) : !commentsData ? (
                            <div className="text-xs text-[var(--feed-text-muted)]">Loading comments...</div>
                        ) : commentsData.length === 0 ? (
                            <div className="text-xs text-[var(--feed-text-muted)]">No comments yet</div>
                        ) : (
                            commentsData.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] text-xs font-semibold text-[var(--feed-text-secondary)]">
                                        {resolveMediaUrl(comment.authorAvatarUrl) ? (
                                            <img src={resolveMediaUrl(comment.authorAvatarUrl)} alt={comment.authorName} className="h-full w-full object-cover" />
                                        ) : (
                                            comment.authorName.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1 rounded-xl bg-[var(--feed-layer-bg)] px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-[var(--feed-text-primary)]">{comment.authorName}</span>
                                            <span className="text-xs text-[var(--feed-text-muted)]">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="mt-1.5 text-sm text-[var(--feed-text-secondary)]">{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            aria-label={`Write a comment on ${displayAuthorName}'s post`}
                            placeholder="Write a comment..."
                            value={commentInput}
                            onChange={(event) => {
                                setCommentInput(event.target.value);
                                setCommentError('');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleCommentSubmit();
                                }
                            }}
                            className="flex-1 rounded-full border border-[var(--feed-card-border)] bg-[var(--feed-input-bg)] px-4 py-2.5 text-sm text-[var(--feed-text-primary)] outline-none placeholder:text-[var(--feed-text-placeholder)] focus:border-[var(--feed-accent)]"
                        />
                        <button type="button" aria-label="Post comment" onClick={() => void handleCommentSubmit()} disabled={!commentInput.trim() || commentPending} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--feed-accent)] text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)] disabled:opacity-40">
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                    {commentError && <p role="alert" className="mt-2 text-xs font-medium text-rose-400">{commentError}</p>}
                </div>
            )}
        </article>
    );
};

const ActionButton = ({
    active,
    icon,
    label,
    onClick,
    disabled = false
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-1 items-center justify-center gap-2 border-r border-[var(--feed-card-border)] px-4 py-3.5 text-sm font-semibold transition-colors last:border-r-0 disabled:cursor-wait disabled:opacity-60 ${
            active ? 'bg-[var(--feed-accent-soft-bg)] text-[var(--feed-accent)]' : 'text-[var(--feed-text-muted)] hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-secondary)]'
        }`}
    >
        {icon}
        {label}
    </button>
);
