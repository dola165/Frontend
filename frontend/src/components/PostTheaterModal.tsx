import { useId, useRef, useState } from 'react';
import { X, Heart, MessageCircle, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeedPostDto, CommentDto } from './feed/FeedPost';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../utils/apiError';
import { useDialogFocus } from './workspace/useDialogFocus';

interface PostTheaterModalProps {
    isOpen: boolean;
    post: FeedPostDto | null;
    onClose: () => void;
    commentsData?: CommentDto[];
    onSubmitComment: (postId: number, content: string) => void | Promise<void>;
    onLikeToggle: (postId: number) => void | Promise<void>;
    likePending?: boolean;
    likeError?: string | null;
}

export const PostTheaterModal = ({
    isOpen,
    post,
    onClose,
    commentsData,
    onSubmitComment,
    onLikeToggle,
    likePending = false,
    likeError = null
}: PostTheaterModalProps) => {
    const [commentInput, setCommentInput] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [commentPending, setCommentPending] = useState(false);
    const [commentError, setCommentError] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    useDialogFocus(isOpen && post !== null, dialogRef, onClose, closeRef);

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
    const isVideo = currentMediaUrl?.match(/\.(mp4|mov|webm)$/i);
    const authorAvatarUrl = resolveMediaUrl(post.authorAvatarUrl);

    return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close post viewer" className="absolute top-4 left-4 z-50 rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-red-500">
                <X className="h-6 w-6" />
            </button>

            <div className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d1117] shadow-2xl lg:flex-row" onClick={(event) => event.stopPropagation()}>
                <div className="group relative flex h-[40vh] flex-1 items-center justify-center overflow-hidden bg-black lg:h-full">
                    {currentMediaUrl && (
                        <div
                            className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-2xl transition-all duration-300"
                            style={{ backgroundImage: `url(${currentMediaUrl})` }}
                        />
                    )}

                    {currentMediaUrl && (
                        isVideo ? (
                            <video src={currentMediaUrl} controls autoPlay className="relative z-10 max-h-full max-w-full object-contain drop-shadow-2xl" />
                        ) : (
                            <img src={currentMediaUrl} alt="Theater mode media" className="relative z-10 max-h-full max-w-full object-contain drop-shadow-2xl" />
                        )
                    )}

                    {mediaList.length > 1 && (
                        <>
                            <button type="button" onClick={handlePrev} aria-label="Previous post media" className="absolute left-4 z-20 rounded-full bg-black/50 p-3 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/80 group-hover:opacity-100 focus:opacity-100">
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button type="button" onClick={handleNext} aria-label="Next post media" className="absolute right-4 z-20 rounded-full bg-black/50 p-3 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/80 group-hover:opacity-100 focus:opacity-100">
                                <ChevronRight className="h-6 w-6" />
                            </button>
                            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                                {currentIndex + 1} / {mediaList.length}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex h-[60vh] w-full shrink-0 flex-col border-l border-white/[0.06] bg-[#0d1117] lg:h-full lg:w-[400px] xl:w-[450px]">
                    <div className="shrink-0 border-b border-white/[0.06] p-5">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#16a34a] text-sm font-semibold text-black ">
                                {authorAvatarUrl ? (
                                    <img src={authorAvatarUrl} alt={post.clubName || post.authorName} className="h-full w-full object-cover" />
                                ) : (
                                    (post.clubName || post.authorName).substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <div>
                                <h2 id={titleId} className="font-semibold text-[#f1f5f9]">Post by {post.clubName || post.authorName}</h2>
                                <p className="text-xs text-[#64748b]">{formatTime(post.createdAt)}</p>
                            </div>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-[#cbd5e1]">{post.content}</p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
                        <span className="text-xs font-medium text-[#64748b]">{post.likeCount} likes &middot; {post.commentCount} comments</span>
                        <div className="flex gap-2">
                            <button type="button" aria-label={post.isLikedByMe ? 'Unlike post' : 'Like post'} onClick={() => void onLikeToggle(post.id)} disabled={likePending} className={`rounded-full p-2 transition-colors disabled:cursor-wait disabled:opacity-60 ${post.isLikedByMe ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'bg-[#1a2030] text-[#64748b] hover:text-[#16a34a]'}`}>
                                <Heart className={`h-5 w-5 ${post.isLikedByMe ? 'fill-current' : ''}`} />
                            </button>
                            <button type="button" aria-label="Focus comment input" onClick={() => document.getElementById(`post-theater-comment-${post.id}`)?.focus()} className="rounded-full bg-[#1a2030] p-2 text-[#64748b] transition-colors hover:text-[#16a34a]">
                                <MessageCircle className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto p-5">
                        {!commentsData ? (
                            <div className="flex justify-center py-10"><span className="text-xs font-medium text-[#64748b]">Loading comments...</span></div>
                        ) : commentsData.length === 0 ? (
                            <div className="flex justify-center py-10"><span className="text-xs font-medium text-[#64748b]">No comments yet.</span></div>
                        ) : (
                            commentsData.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1a2030] text-xs font-semibold text-[#94a3b8]">
                                        {resolveMediaUrl(comment.authorAvatarUrl) ? (
                                            <img src={resolveMediaUrl(comment.authorAvatarUrl)} alt={comment.authorName} className="h-full w-full object-cover" />
                                        ) : (
                                            comment.authorName.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1 rounded-xl bg-[#161c28] p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[#f1f5f9]">{comment.authorName}</span>
                                            <span className="text-xs text-[#475569]">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-[#cbd5e1]">{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="shrink-0 border-t border-white/[0.06] bg-[#0d1117] p-4">
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
                                className="w-full rounded-full border border-white/[0.06] bg-[#161c28] py-3 pl-5 pr-12 text-sm text-[#f1f5f9] outline-none transition-colors focus:border-[#16a34a]"
                            />
                            <button
                                aria-label="Post comment"
                                onClick={() => void handleCommentSubmit()}
                                disabled={!commentInput.trim() || commentPending}
                                className="absolute right-1.5 top-1.5 bottom-1.5 rounded-full bg-[#16a34a] px-3 text-black transition-colors hover:bg-[#22c55e] disabled:opacity-40"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        {(commentError || likeError) && <p role="alert" className="mt-2 text-xs font-medium text-rose-400">{commentError || likeError}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
