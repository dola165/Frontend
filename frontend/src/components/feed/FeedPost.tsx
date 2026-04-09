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
                alert('Post details copied to clipboard.');
                return;
            }
        } catch (error) {
            console.error('Share failed', error);
            return;
        }

        alert('Sharing is not available on this device yet.');
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
            <div className="overflow-hidden border-y border-subtle cursor-pointer" onClick={onImageClick}>
                {count === 1 && (
                    <div className={`bg-base relative flex w-full items-center justify-center overflow-hidden ${compact ? 'max-h-[32vh]' : 'max-h-[56vh]'}`}>
                        <MediaItem url={mediaList[0]} className={`relative z-10 w-full object-contain ${compact ? 'max-h-[32vh]' : 'max-h-[56vh]'}`} />
                    </div>
                )}
                {count === 2 && (
                    <div className="grid grid-cols-2 gap-px bg-[color:var(--border-subtle)]">
                        <MediaItem url={mediaList[0]} className={`w-full bg-base ${compact ? 'h-32' : 'h-56'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full bg-base ${compact ? 'h-32' : 'h-56'}`} />
                    </div>
                )}
                {count === 3 && (
                    <div className="grid grid-cols-2 gap-px bg-[color:var(--border-subtle)]">
                        <MediaItem url={mediaList[0]} className={`col-span-2 w-full bg-base ${compact ? 'h-40' : 'h-64'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full bg-base ${compact ? 'h-24' : 'h-32'}`} />
                        <MediaItem url={mediaList[2]} className={`w-full bg-base ${compact ? 'h-24' : 'h-32'}`} />
                    </div>
                )}
                {count >= 4 && (
                    <div className="grid grid-cols-2 gap-px bg-[color:var(--border-subtle)]">
                        <MediaItem url={mediaList[0]} className={`w-full bg-base ${compact ? 'h-28' : 'h-40'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full bg-base ${compact ? 'h-28' : 'h-40'}`} />
                        <MediaItem url={mediaList[2]} className={`w-full bg-base ${compact ? 'h-28' : 'h-40'}`} />
                        <div className={`relative w-full ${compact ? 'h-28' : 'h-40'}`}>
                            <MediaItem url={mediaList[3]} className="h-full w-full bg-base" />
                            {count > 4 && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-3xl font-black text-white">+{count - 4}</div>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <article className="rounded-[20px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] p-1.5 shadow-[0_16px_28px_rgba(2,6,12,0.2)]">
            <div className="overflow-hidden rounded-[16px] border border-white/6 bg-[rgba(255,255,255,0.02)]">
                <div className={`${compact ? 'px-3 py-2.5' : 'px-4 py-3'} flex items-start justify-between gap-3`}>
                    <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/8 bg-white/[0.04] font-black uppercase text-[color:var(--club-theme-text-primary)] ${compact ? 'h-8 w-8 rounded-[10px] text-[10px]' : 'h-10 w-10 rounded-[12px] text-sm'}`}>
                            {authorAvatarUrl ? <img src={authorAvatarUrl} alt={post.clubName || post.authorName} className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className={`truncate font-black tracking-[0.06em] text-[color:var(--club-theme-text-primary)] ${compact ? 'text-[11px]' : 'text-sm'}`}>{post.clubName || post.authorName}</h4>
                                {post.clubName && <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--club-tone-green)]">Official</span>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)]">
                                <span>{formatTime(post.createdAt)}</span>
                                <span className="h-1 w-1 rounded-full bg-[color:var(--club-theme-text-muted)]" />
                                <span>{post.likeCount} acknowledgments</span>
                                <span className="h-1 w-1 rounded-full bg-[color:var(--club-theme-text-muted)]" />
                                <span>{post.commentCount} comments</span>
                            </div>
                        </div>
                    </div>

                    <button type="button" className="p-1 text-[color:var(--club-theme-text-secondary)] transition-colors hover:text-[color:var(--club-theme-text-primary)]">
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>

                <div className={`${compact ? 'px-3 pb-2.5' : 'px-4 pb-3'}`}>
                    <p className={`${compact ? 'text-[12.5px] leading-[1.35rem]' : 'text-sm leading-6'} whitespace-pre-line text-[color:var(--club-theme-text-primary)]`}>{post.content}</p>
                </div>

                {renderMediaGrid()}

                <div className="flex border-t border-white/6">
                    <ActionButton active={post.isLikedByMe} icon={<Heart className={`h-4 w-4 ${post.isLikedByMe ? 'fill-current' : ''}`} />} label="Like" onClick={() => onLikeToggle(post.id)} />
                    <ActionButton active={isCommentsOpen} icon={<MessageCircle className="h-4 w-4" />} label="Comment" onClick={() => onToggleComments(post.id)} />
                    <ActionButton active={false} icon={<Share2 className="h-4 w-4" />} label="Share" onClick={handleShare} />
                </div>

                {isCommentsOpen && (
                    <div className="border-t border-white/6 bg-white/[0.02] px-3 py-3">
                        <div className="mb-3 flex max-h-60 flex-col gap-3 overflow-y-auto">
                            {!commentsData ? (
                                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)]">Loading comments</div>
                            ) : commentsData.length === 0 ? (
                                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)]">No comments yet</div>
                            ) : (
                                commentsData.map((comment) => (
                                    <div key={comment.id} className="flex gap-3">
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-white/8 bg-white/[0.04] text-[10px] font-black uppercase text-[color:var(--club-theme-text-primary)] ${compact ? 'rounded-[10px]' : 'rounded-full'}`}>
                                            {resolveMediaUrl(comment.authorAvatarUrl) ? (
                                                <img src={resolveMediaUrl(comment.authorAvatarUrl)} alt={comment.authorName} className="h-full w-full object-cover" />
                                            ) : (
                                                comment.authorName.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-primary)]">{comment.authorName}</span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)]">{formatTime(comment.createdAt)}</span>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-[color:var(--club-theme-text-primary)]">{comment.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Add comment"
                                value={commentInput}
                                onChange={(event) => setCommentInput(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleCommentSubmit()}
                                className="flex-1 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-[color:var(--club-theme-text-primary)] outline-none placeholder:text-[color:var(--club-theme-text-muted)]"
                            />
                            <button type="button" onClick={handleCommentSubmit} disabled={!commentInput.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] text-[#031108] disabled:opacity-50">
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
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
        className={`flex flex-1 items-center justify-center gap-2 border-r border-white/6 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition-colors last:border-r-0 ${
            active ? 'bg-[color:var(--club-tone-green-soft)] text-[color:var(--club-tone-green)]' : 'text-[color:var(--club-theme-text-secondary)] hover:bg-white/[0.03] hover:text-[color:var(--club-theme-text-primary)]'
        }`}
    >
        {icon}
        {label}
    </button>
);
