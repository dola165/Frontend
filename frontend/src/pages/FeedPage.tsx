import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Heart, MessageCircle, Share2, ShieldCheck, MoreHorizontal, Send } from 'lucide-react';

interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorId: number;
    authorName: string;
    clubId: number | null;
    clubName: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
}

interface CommentDto {
    id: number;
    authorName: string;
    content: string;
    createdAt: string;
}

export const FeedPage = () => {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);

    // Interaction States
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

    useEffect(() => {
        apiClient.get('/feed')
            .then(res => setPosts(res.data.posts))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // --- 1. HANDLE LIKES (Optimistic Update) ---
    const handleLikeToggle = async (postId: number) => {
        // Instantly update UI before server responds
        setPosts(currentPosts => currentPosts.map(post => {
            if (post.id === postId) {
                const isCurrentlyLiked = post.isLikedByMe;
                return {
                    ...post,
                    isLikedByMe: !isCurrentlyLiked,
                    likeCount: isCurrentlyLiked ? post.likeCount - 1 : post.likeCount + 1
                };
            }
            return post;
        }));

        try {
            await apiClient.post(`/feed/posts/${postId}/like`);
        } catch {
            alert("Failed to like post");
            // In a production app, you would revert the optimistic update here on failure
        }
    };

    // --- 2. HANDLE COMMENTS SECTION TOGGLE ---
    const toggleComments = async (postId: number) => {
        const isCurrentlyOpen = openComments[postId];

        // Toggle the UI state
        setOpenComments(prev => ({ ...prev, [postId]: !isCurrentlyOpen }));

        // If we are opening it and don't have the data yet, fetch it!
        if (!isCurrentlyOpen && !commentsData[postId]) {
            try {
                const res = await apiClient.get<CommentDto[]>(`/feed/posts/${postId}/comments`);
                setCommentsData(prev => ({ ...prev, [postId]: res.data }));
            } catch (err) {
                console.error("Failed to load comments", err);
            }
        }
    };

    // --- 3. HANDLE SUBMITTING A COMMENT ---
    const submitComment = async (postId: number) => {
        const text = commentInputs[postId]?.trim();
        if (!text) return;

        try {
            const res = await apiClient.post<CommentDto>(`/feed/posts/${postId}/comments`, { content: text });

            // Append the new comment directly to the state
            setCommentsData(prev => ({
                ...prev,
                [postId]: [...(prev[postId] || []), res.data]
            }));

            // Update the post's comment counter
            setPosts(currentPosts => currentPosts.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));

            // Clear the input
            setCommentInputs(prev => ({ ...prev, [postId]: "" }));

        } catch (err) {
            alert("Failed to post comment.");
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500 font-medium animate-pulse">Loading your feed...</div>;

    return (
        <div className="w-full pb-24">

            {/* Create Post Input */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 flex gap-3 items-center transition-colors">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
                <input
                    type="text" placeholder="Start a post or announce a tryout..."
                    className="bg-gray-100 dark:bg-gray-700 w-full rounded-full py-2.5 px-4 outline-none hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    readOnly onClick={() => alert("Create post modal coming soon!")}
                />
            </div>

            {/* The Feed */}
            <div className="flex flex-col gap-5">
                {posts.map(post => {
                    const isClubPost = post.clubId !== null;
                    const displayName = isClubPost ? post.clubName : post.authorName;
                    const initials = displayName?.substring(0, 2).toUpperCase() || "??";
                    const isCommentsOpen = openComments[post.id];

                    return (
                        <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                            {/* Card Header */}
                            <div className="p-4 flex justify-between items-start">
                                <div className="flex gap-3 items-center">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${
                                        isClubPost ? "bg-blue-600 text-white" : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200"
                                    }`}>
                                        {initials}
                                    </div>
                                    <div>
                                        {isClubPost ? (
                                            <Link to={`/clubs/${post.clubId}`} className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors">
                                                {displayName} <ShieldCheck className="w-4 h-4 text-blue-500" />
                                            </Link>
                                        ) : (
                                            <div className="font-bold text-gray-900 dark:text-white">{displayName}</div>
                                        )}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                            {formatTime(post.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Card Body */}
                            <div className="px-4 pb-3">
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                                    {post.content}
                                </p>
                            </div>

                            {/* Engagement Counters */}
                            {(post.likeCount > 0 || post.commentCount > 0) && (
                                <div className="px-4 py-2 border-t border-gray-50 dark:border-gray-700/50 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                                    {post.likeCount > 0 && <span>{post.likeCount} Likes</span>}
                                    {post.commentCount > 0 && <span>{post.commentCount} Comments</span>}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="px-2 py-1 border-t border-gray-100 dark:border-gray-700 flex justify-between">
                                <button
                                    onClick={() => handleLikeToggle(post.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                        post.isLikedByMe ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <Heart className="w-5 h-5" fill={post.isLikedByMe ? "currentColor" : "none"} />
                                    Like
                                </button>
                                <button
                                    onClick={() => toggleComments(post.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                        isCommentsOpen ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    Comment
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <Share2 className="w-5 h-5" /> Share
                                </button>
                            </div>

                            {/* --- INLINE COMMENT SECTION --- */}
                            {isCommentsOpen && (
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-t border-gray-100 dark:border-gray-700">

                                    {/* Existing Comments */}
                                    <div className="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto pr-2">
                                        {!commentsData[post.id] ? (
                                            <div className="text-center text-sm text-gray-500">Loading comments...</div>
                                        ) : commentsData[post.id].length === 0 ? (
                                            <div className="text-center text-sm text-gray-500">No comments yet. Be the first!</div>
                                        ) : (
                                            commentsData[post.id].map(comment => (
                                                <div key={comment.id} className="flex gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                        {comment.authorName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-2xl rounded-tl-none w-full shadow-sm">
                                                        <div className="flex justify-between items-end mb-1">
                                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{comment.authorName}</span>
                                                            <span className="text-[10px] text-gray-500">{formatTime(comment.createdAt)}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-800 dark:text-gray-200">{comment.content}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Add Comment Input */}
                                    <div className="flex items-center gap-2 relative">
                                        <input
                                            type="text"
                                            placeholder="Write a comment..."
                                            value={commentInputs[post.id] || ""}
                                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-full py-2.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                                        />
                                        <button
                                            onClick={() => submitComment(post.id)}
                                            disabled={!commentInputs[post.id]?.trim()}
                                            className="absolute right-2 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>

                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};