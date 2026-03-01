import { useState } from 'react';
import { X, Heart, MessageCircle, Share2, MoreHorizontal, ShieldCheck, Send } from 'lucide-react';

interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorName: string;
    clubId: number | null;
    clubName: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
    mediaUrls: string[];
}

interface PostTheaterModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: FeedPostDto | null;
}

export function PostTheaterModal({ isOpen, onClose, post }: PostTheaterModalProps) {
    const [commentText, setCommentText] = useState('');
    const API_BASE_URL = 'http://localhost:8080';

    if (!isOpen || !post) return null;

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
    const isVideo = hasMedia && (post.mediaUrls[0].endsWith('.mp4') || post.mediaUrls[0].endsWith('.mov'));

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex animate-in fade-in duration-200">

            {/* LEFT SIDE: Media Theater (Black Background) */}
            <div className="flex-1 flex flex-col relative">
                {/* Close button for Mobile (visible only on small screens) */}
                <button onClick={onClose} className="md:hidden absolute top-4 left-4 z-50 p-2 bg-black/50 text-white rounded-full">
                    <X className="w-6 h-6" />
                </button>

                <div className="flex-1 flex items-center justify-center p-4">
                    {hasMedia ? (
                        isVideo ? (
                            <video
                                src={`${API_BASE_URL}${post.mediaUrls[0]}`}
                                controls autoPlay
                                className="max-w-full max-h-screen object-contain drop-shadow-2xl"
                            />
                        ) : (
                            <img
                                src={`${API_BASE_URL}${post.mediaUrls[0]}`}
                                alt="Post media"
                                className="max-w-full max-h-screen object-contain drop-shadow-2xl"
                            />
                        )
                    ) : (
                        <div className="text-white/50 font-bold uppercase tracking-widest">No Media Attached</div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: Interactions & Comments Sidebar */}
            <div className="w-full md:w-[400px] lg:w-[450px] bg-white dark:bg-[#1e293b] h-full flex flex-col border-l border-gray-200 dark:border-gray-800 shadow-2xl shrink-0">

                {/* Header: Author Info & Close Button */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center shrink-0">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm bg-gray-100 dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-gray-600">
                            {post.authorName.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wide">
                                {post.authorName}
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                {formatTime(post.createdAt)} {post.clubName && <>• <ShieldCheck className="w-3 h-3 text-emerald-500" /></>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="hidden md:flex text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Body: Caption & Comments */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar">

                    {/* Caption */}
                    <div className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-relaxed whitespace-pre-line pb-4 border-b border-gray-100 dark:border-gray-800/50">
                        {post.content}
                    </div>

                    {/* Dummy Comments Section (Ready to be wired to backend!) */}
                    <div className="flex flex-col gap-4">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Comments ({post.commentCount})</h4>

                        {post.commentCount === 0 ? (
                            <div className="text-center text-gray-500 text-sm py-8 font-medium">
                                No comments yet. Start the conversation!
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 text-sm py-4 italic">
                                Comments API wiring coming soon...
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: Action Buttons & Comment Input */}
                <div className="shrink-0 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-800">

                    {/* Like/Share Actions */}
                    <div className="px-4 py-3 flex gap-4 border-b border-gray-200 dark:border-gray-800/50">
                        <button className={`flex items-center gap-2 font-black text-xs uppercase tracking-wider transition-colors ${post.isLikedByMe ? "text-emerald-500" : "text-gray-500 hover:text-emerald-500"}`}>
                            <Heart className="w-5 h-5" fill={post.isLikedByMe ? "currentColor" : "none"} /> {post.likeCount}
                        </button>
                        <button className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <MessageCircle className="w-5 h-5" /> {post.commentCount}
                        </button>
                        <button className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors ml-auto">
                            <Share2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Write Comment Box */}
                    <div className="p-3 flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Add a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full py-2.5 px-4 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-colors"
                        />
                        <button
                            disabled={!commentText.trim()}
                            className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-full disabled:opacity-50 transition-all font-black"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}