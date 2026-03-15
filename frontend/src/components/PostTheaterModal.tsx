import { useState } from 'react';
import { X, Heart, MessageCircle, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import type {FeedPostDto, CommentDto} from './feed/FeedPost';

interface PostTheaterModalProps {
    isOpen: boolean;
    post: FeedPostDto | null;
    onClose: () => void;
    commentsData?: CommentDto[];
    onSubmitComment: (postId: number, content: string) => void;
    onLikeToggle: (postId: number) => void;
}

export const PostTheaterModal = ({ isOpen, post, onClose, commentsData, onSubmitComment, onLikeToggle }: PostTheaterModalProps) => {
    const [commentInput, setCommentInput] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!isOpen || !post) return null;

    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatMediaUrl = (url?: string) => {
        if (!url) return undefined;
        if (url.startsWith('http')) return url;
        return `http://localhost:8080${url}`;
    };

    const handleCommentSubmit = () => {
        if (!commentInput.trim()) return;
        onSubmitComment(post.id, commentInput);
        setCommentInput("");
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % mediaList.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
    };

    const currentMediaUrl = formatMediaUrl(mediaList[currentIndex]);
    const isVideo = currentMediaUrl?.match(/\.(mp4|mov|webm)$/i);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 left-4 z-50 p-2 bg-white/10 hover:bg-rose-500 text-white rounded-full transition-colors backdrop-blur-md">
                <X className="w-6 h-6" />
            </button>

            <div className="w-full h-full max-w-[1400px] flex flex-col lg:flex-row bg-[#1e293b] rounded-xl overflow-hidden shadow-2xl border border-slate-700">

                {/* LEFT SIDE: THEATER (Media Display) */}
                <div className="flex-1 bg-black relative flex items-center justify-center group h-[40vh] lg:h-full overflow-hidden">

                    {/* The Facebook-style blurred background */}
                    {currentMediaUrl && (
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110 transition-all duration-300"
                            style={{ backgroundImage: `url(${currentMediaUrl})` }}
                        />
                    )}

                    {/* Main Image Layer */}
                    {currentMediaUrl && (
                        isVideo ? (
                            <video src={currentMediaUrl} controls autoPlay className="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl" />
                        ) : (
                            <img src={currentMediaUrl} alt="Theater mode media" className="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl" />
                        )
                    )}

                    {/* Carousel Controls */}
                    {mediaList.length > 1 && (
                        <>
                            <button onClick={handlePrev} className="absolute z-20 left-4 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button onClick={handleNext} className="absolute z-20 right-4 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
                                <ChevronRight className="w-6 h-6" />
                            </button>
                            <div className="absolute z-20 bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1.5 rounded-full text-white text-xs font-bold tracking-widest backdrop-blur-md">
                                {currentIndex + 1} / {mediaList.length}
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT SIDE: CONTEXT & COMMENTS */}
                <div className="w-full lg:w-[400px] xl:w-[450px] bg-white dark:bg-[#0f172a] flex flex-col h-[60vh] lg:h-full shrink-0 border-l border-slate-300 dark:border-slate-800">

                    {/* Author & Post Text */}
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-black text-white shadow-sm border border-emerald-700">
                                {(post.clubName || post.authorName).substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{post.clubName || post.authorName}</h4>
                                <p className="text-xs text-slate-500 font-medium">{formatTime(post.createdAt)}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line font-medium leading-relaxed">{post.content}</p>
                    </div>

                    {/* Stats & Actions */}
                    <div className="px-5 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{post.likeCount} ACKS • {post.commentCount} INTEL</span>
                        <div className="flex gap-2">
                            <button onClick={() => onLikeToggle(post.id)} className={`p-2 rounded-full transition-colors ${post.isLikedByMe ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500'}`}>
                                <Heart className={`w-5 h-5 ${post.isLikedByMe ? 'fill-current' : ''}`} />
                            </button>
                            <button className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-500 rounded-full transition-colors">
                                <MessageCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Comments List */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {!commentsData ? (
                            <div className="flex justify-center py-10"><span className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading intel...</span></div>
                        ) : commentsData.length === 0 ? (
                            <div className="flex justify-center py-10"><span className="text-xs font-bold uppercase tracking-widest text-slate-400">No intel recorded yet.</span></div>
                        ) : (
                            commentsData.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                        {comment.authorName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 bg-slate-50 dark:bg-[#1e293b] p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white">{comment.authorName}</span>
                                            <span className="text-[10px] text-slate-500 font-bold">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input Field */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f172a] shrink-0">
                        <div className="flex gap-2 relative">
                            <input
                                type="text"
                                placeholder="Add intel..."
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-full py-3 pl-5 pr-12 outline-none focus:border-emerald-500 transition-colors"
                            />
                            <button
                                onClick={handleCommentSubmit}
                                disabled={!commentInput.trim()}
                                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold transition-colors disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};