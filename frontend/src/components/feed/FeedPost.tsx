import { useState, type ReactNode } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Send, Share2 } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

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
    onLikeToggle: (postId: number) => void;
    onToggleComments: (postId: number) => void;
    onSubmitComment: (postId: number, content: string) => void;
    onImageClick: () => void;
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
    compact = false
}: FeedPostProps) => {
    const [commentInput, setCommentInput] = useState('');
    const [shareFeedback, setShareFeedback] = useState('');

    const formatTime = (dateString: string) =>
        new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const initials = (post.clubName || post.authorName).substring(0, 2).toUpperCase();
    const authorAvatarUrl = resolveMediaUrl(post.authorAvatarUrl);

    const handleCommentSubmit = () => {
        if (!commentInput.trim()) return;
        onSubmitComment(post.id, commentInput);
        setCommentInput('');
    };

    const handleShare = async () => {
        const shareTitle = post.clubName || post.authorName || 'Talanti post';
        const shareText = `${shareTitle}\n\n${post.content}`.trim();
        const shareUrl = window.location.href;

        try {
            if (navigator.share) {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                return;
            }
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
                setShareFeedback('Copied to clipboard.');
                setTimeout(() => setShareFeedback(''), 2000);
                return;
            }
        } catch (error) {
            console.error('Share failed', error);
            return;
        }
        console.warn('Share API and clipboard unavailable on this device.');
    };

    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];

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
                <div className="flex min-w-0 items-start gap-4">
                    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] font-semibold text-[var(--feed-text-secondary)] ${compact ? 'h-11 w-11 text-sm' : 'h-12 w-12 text-base'}`}>
                        {authorAvatarUrl ? <img src={authorAvatarUrl} alt={post.clubName || post.authorName} className="h-full w-full object-cover" /> : initials}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-base font-semibold text-[var(--feed-text-primary)]">{post.clubName || post.authorName}</h4>
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
                </div>
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
                    onClick={() => onLikeToggle(post.id)}
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
                <div className="px-4 pb-1 text-xs font-medium text-[var(--feed-accent)]">{shareFeedback}</div>
            )}

            {isCommentsOpen && (
                <div className="border-t border-[var(--feed-card-border)] bg-[var(--feed-surface)] px-4 py-3">
                    <div className="mb-3 flex max-h-60 flex-col gap-3 overflow-y-auto">
                        {!commentsData ? (
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
                            placeholder="Write a comment..."
                            value={commentInput}
                            onChange={(event) => setCommentInput(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && handleCommentSubmit()}
                            className="flex-1 rounded-full border border-[var(--feed-card-border)] bg-[var(--feed-input-bg)] px-4 py-2.5 text-sm text-[var(--feed-text-primary)] outline-none placeholder:text-[var(--feed-text-placeholder)] focus:border-[var(--feed-accent)]"
                        />
                        <button type="button" onClick={handleCommentSubmit} disabled={!commentInput.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--feed-accent)] text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)] disabled:opacity-40">
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </article>
    );
};

const ActionButton = ({
    active,
    icon,
    label,
    onClick
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex flex-1 items-center justify-center gap-2 border-r border-[var(--feed-card-border)] px-4 py-3.5 text-sm font-semibold transition-colors last:border-r-0 ${
            active ? 'bg-[var(--feed-accent-soft-bg)] text-[var(--feed-accent)]' : 'text-[var(--feed-text-muted)] hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-secondary)]'
        }`}
    >
        {icon}
        {label}
    </button>
);
