import { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Send } from 'lucide-react';

export interface CommentDto { id: number; authorName: string; content: string; createdAt: string; }

export interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorName: string;
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
}

export const FeedPost = ({ post, isCommentsOpen, commentsData, onLikeToggle, onToggleComments, onSubmitComment, onImageClick }: FeedPostProps) => {
    const [commentInput, setCommentInput] = useState("");

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatMediaUrl = (url?: string) => {
        if (!url) return undefined;
        if (url.startsWith('http')) return url;
        return `http://localhost:8080${url}`;
    };

    const initials = (post.clubName || post.authorName).substring(0, 2).toUpperCase();

    const handleCommentSubmit = () => {
        if (!commentInput.trim()) return;
        onSubmitComment(post.id, commentInput);
        setCommentInput("");
    };

    // Consolidate media into a single array
    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];

// --- FACEBOOK STYLE GRID GENERATOR ---
    const renderMediaGrid = () => {
        if (mediaList.length === 0) return null;

        const count = mediaList.length;

        const MediaItem = ({ url, className }: { url: string, className: string }) => {
            const finalUrl = formatMediaUrl(url);
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
                    <div className="relative w-full max-h-[75vh] bg-[#0a0f13] flex items-center justify-center overflow-hidden">
                        {/* The high-saturation, high-opacity blur for seamless blending */}
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-80 blur-3xl scale-125 saturate-150 transition-all duration-500"
                            style={{ backgroundImage: `url(${formatMediaUrl(mediaList[0])})` }}
                        />
                        {/* w-full ensures horizontal images span edge to edge.
                            max-h-[75vh] prevents vertical panoramas from breaking the layout.
                        */}
                        <MediaItem
                            url={mediaList[0]}
                            className="relative z-10 w-full max-h-[75vh] object-contain drop-shadow-2xl"
                        />
                    </div>
                )}
                {count === 2 && (
                    <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#1e293b]">
                        <MediaItem url={mediaList[0]} className="w-full h-72" />
                        <MediaItem url={mediaList[1]} className="w-full h-72" />
                    </div>
                )}
                {count === 3 && (
                    <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#1e293b]">
                        <MediaItem url={mediaList[0]} className="w-full h-80 col-span-2" />
                        <MediaItem url={mediaList[1]} className="w-full h-40" />
                        <MediaItem url={mediaList[2]} className="w-full h-40" />
                    </div>
                )}
                {count >= 4 && (
                    <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#1e293b]">
                        <MediaItem url={mediaList[0]} className="w-full h-48" />
                        <MediaItem url={mediaList[1]} className="w-full h-48" />
                        <MediaItem url={mediaList[2]} className="w-full h-48" />
                        <div className="relative w-full h-48">
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
        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg overflow-hidden shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:-translate-y-1 transition-all duration-300">
            {/* Header */}
            <div className="p-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm border border-emerald-700">
                        {initials}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{post.clubName || post.authorName}</h4>
                            {post.clubName && (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded text-[10px] uppercase font-bold tracking-widest">Official</span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formatTime(post.createdAt)}</p>
                    </div>
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white rounded-full transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">{post.content}</p>
            </div>

            {/* Render the new dynamic grid */}
            {renderMediaGrid()}

            {/* Stats Bar */}
            <div className="px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                <span>{post.likeCount} acknowledgments</span>
                <span>{post.commentCount} intel reports</span>
            </div>

            {/* Action Buttons */}
            <div className="flex bg-slate-50 dark:bg-[#111827]">
                <button onClick={() => onLikeToggle(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all border-r border-slate-200 dark:border-slate-800 ${post.isLikedByMe ? 'text-rose-600 bg-rose-50 dark:text-rose-500 dark:bg-rose-500/5' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500'}`}>
                    <Heart className={`w-4 h-4 ${post.isLikedByMe ? 'fill-current' : ''}`} /> ACK
                </button>
                <button onClick={() => onToggleComments(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all border-r border-slate-200 dark:border-slate-800 ${isCommentsOpen ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-500'}`}>
                    <MessageCircle className="w-4 h-4" /> INTEL
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-500 transition-all">
                    <Share2 className="w-4 h-4" /> RELAY
                </button>
            </div>

            {/* Inline Comment Section */}
            {isCommentsOpen && (
                <div className="bg-slate-50 dark:bg-[#111827] p-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto">
                        {!commentsData ? (
                            <div className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-500">Loading intel...</div>
                        ) : commentsData.length === 0 ? (
                            <div className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-500">No intel available.</div>
                        ) : (
                            commentsData.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                        {comment.authorName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 bg-white dark:bg-[#1e293b] p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
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