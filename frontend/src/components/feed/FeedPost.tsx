import { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Send } from 'lucide-react';
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
    onImageClick: () => void; // <-- NEW PROP
    compact?: boolean;
}

export const FeedPost = ({ post, isCommentsOpen, commentsData, onLikeToggle, onToggleComments, onSubmitComment, onImageClick, compact = false }: FeedPostProps) => {
    const [commentInput, setCommentInput] = useState("");

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const initials = (post.clubName || post.authorName).substring(0, 2).toUpperCase();
    const authorAvatarUrl = resolveMediaUrl(post.authorAvatarUrl);

    const handleCommentSubmit = () => {
        if (!commentInput.trim()) return;
        onSubmitComment(post.id, commentInput);
        setCommentInput("");
    };

    const handleShare = async () => {
        const shareTitle = post.clubName || post.authorName || 'Talanti post';
        const shareText = `${shareTitle}\n\n${post.content}`.trim();
        const shareUrl = window.location.href;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl
                });
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

    // Consolidate media into a single array
    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];

// --- FACEBOOK STYLE GRID GENERATOR ---
    const renderMediaGrid = () => {
        if (mediaList.length === 0) return null;

        const count = mediaList.length;

        const MediaItem = ({ url, className }: { url: string, className: string }) => {
            const finalUrl = resolveMediaUrl(url);
            const isVideo = finalUrl?.match(/\.(mp4|mov|webm)$/i);
            return isVideo ? (
                <video src={finalUrl} className={`object-cover ${className}`} />
            ) : (
                <img src={finalUrl} alt="Post media" className={`object-cover ${className}`} />
            );
        };

        return (
            <div className="border-y border-slate-200 dark:border-slate-800 cursor-pointer overflow-hidden" onClick={onImageClick}>
                {count === 1 && (
                    <div className={`theme-surface-strong relative w-full flex items-center justify-center overflow-hidden ${compact ? 'max-h-[60vh]' : 'max-h-[75vh]'}`}>
                        {/* The high-saturation, high-opacity blur for seamless blending */}
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-80 blur-3xl scale-125 saturate-150 transition-all duration-500"
                            style={{ backgroundImage: `url(${resolveMediaUrl(mediaList[0])})` }}
                        />
                        {/* w-full ensures horizontal images span edge to edge.
                            max-h-[75vh] prevents vertical panoramas from breaking the layout.
                        */}
                        <MediaItem
                            url={mediaList[0]}
                            className={`relative z-10 w-full object-contain drop-shadow-2xl ${compact ? 'max-h-[60vh]' : 'max-h-[75vh]'}`}
                        />
                    </div>
                )}
                {count === 2 && (
                    <div className="theme-surface grid grid-cols-2 gap-1">
                        <MediaItem url={mediaList[0]} className={`w-full ${compact ? 'h-56' : 'h-72'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full ${compact ? 'h-56' : 'h-72'}`} />
                    </div>
                )}
                {count === 3 && (
                    <div className="theme-surface grid grid-cols-2 gap-1">
                        <MediaItem url={mediaList[0]} className={`w-full col-span-2 ${compact ? 'h-60' : 'h-80'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full ${compact ? 'h-32' : 'h-40'}`} />
                        <MediaItem url={mediaList[2]} className={`w-full ${compact ? 'h-32' : 'h-40'}`} />
                    </div>
                )}
                {count >= 4 && (
                    <div className="theme-surface grid grid-cols-2 gap-1">
                        <MediaItem url={mediaList[0]} className={`w-full ${compact ? 'h-36' : 'h-48'}`} />
                        <MediaItem url={mediaList[1]} className={`w-full ${compact ? 'h-36' : 'h-48'}`} />
                        <MediaItem url={mediaList[2]} className={`w-full ${compact ? 'h-36' : 'h-48'}`} />
                        <div className={`relative w-full ${compact ? 'h-36' : 'h-48'}`}>
                            <MediaItem url={mediaList[3]} className="w-full h-full" />
                            {count > 4 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-3xl">
                                    +{count - 4}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`theme-surface rounded-lg overflow-hidden transition-all duration-300 ${compact
            ? 'border theme-border shadow-sm'
            : 'border-2 theme-border-strong shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:-translate-y-1'}`}>
            {/* Header */}
            <div className={`${compact ? 'p-3' : 'p-4'} flex items-start justify-between`}>
                <div className="flex items-center gap-3">
                    <div className={`${compact ? 'w-9 h-9 text-[11px]' : 'w-10 h-10 text-sm'} bg-emerald-600 rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-sm border border-emerald-700 overflow-hidden`}>
                        {authorAvatarUrl ? (
                            <img src={authorAvatarUrl} alt={post.clubName || post.authorName} className="w-full h-full object-cover" />
                        ) : (
                            initials
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-[13px]' : 'text-sm'}`}>{post.clubName || post.authorName}</h4>
                            {post.clubName && (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded text-[10px] uppercase font-bold tracking-widest">Official</span>
                            )}
                        </div>
                        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-slate-500 dark:text-slate-400 font-medium`}>{formatTime(post.createdAt)}</p>
                    </div>
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white rounded-full transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className={`${compact ? 'px-3 pb-2.5' : 'px-4 pb-3'}`}>
                <p className={`${compact ? 'text-[13px] leading-5' : 'text-sm leading-relaxed'} text-slate-800 dark:text-slate-200 whitespace-pre-line font-medium`}>{post.content}</p>
            </div>

            {/* Render the new dynamic grid */}
            {renderMediaGrid()}

            {/* Stats Bar */}
            <div className={`${compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'} flex items-center justify-between font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest`}>
                <span>{post.likeCount} acknowledgments</span>
                <span>{post.commentCount} intel reports</span>
            </div>

            {/* Action Buttons */}
            <div className="theme-surface-strong flex">
                <button onClick={() => onLikeToggle(post.id)} className={`flex-1 flex items-center justify-center gap-2 ${compact ? 'py-2.5 text-[11px]' : 'py-3 text-xs'} font-bold uppercase tracking-widest transition-all border-r border-slate-200 dark:border-slate-800 ${post.isLikedByMe ? 'text-rose-600 bg-rose-50 dark:text-rose-500 dark:bg-rose-500/5' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500'}`}>
                    <Heart className={`w-4 h-4 ${post.isLikedByMe ? 'fill-current' : ''}`} /> ACK
                </button>
                <button onClick={() => onToggleComments(post.id)} className={`flex-1 flex items-center justify-center gap-2 ${compact ? 'py-2.5 text-[11px]' : 'py-3 text-xs'} font-bold uppercase tracking-widest transition-all border-r border-slate-200 dark:border-slate-800 ${isCommentsOpen ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-500'}`}>
                    <MessageCircle className="w-4 h-4" /> INTEL
                </button>
                <button onClick={handleShare} className={`flex-1 flex items-center justify-center gap-2 ${compact ? 'py-2.5 text-[11px]' : 'py-3 text-xs'} font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-500 transition-all`}>
                    <Share2 className="w-4 h-4" /> RELAY
                </button>
            </div>

            {/* Inline Comment Section */}
            {isCommentsOpen && (
                <div className="theme-surface-strong p-4 border-t theme-border">
                    <div className="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto">
                        {!commentsData ? (
                            <div className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-500">Loading intel...</div>
                        ) : commentsData.length === 0 ? (
                            <div className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-500">No intel available.</div>
                        ) : (
                            commentsData.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400 overflow-hidden">
                                        {resolveMediaUrl(comment.authorAvatarUrl) ? (
                                            <img
                                                src={resolveMediaUrl(comment.authorAvatarUrl)}
                                                alt={comment.authorName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            comment.authorName.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="theme-surface flex-1 p-3 rounded-lg border theme-border shadow-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-xs text-slate-900 dark:text-white">{comment.authorName}</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add intel..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                            className="flex-1 bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner"
                        />
                        <button
                            onClick={handleCommentSubmit}
                            disabled={!commentInput.trim()}
                            className="px-4 bg-emerald-600 text-white rounded-full font-bold text-sm disabled:opacity-50 transition-opacity shadow-md"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
