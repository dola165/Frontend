import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Heart, MessageCircle, Share2, ShieldCheck, MoreHorizontal, Send, Plus, Search } from 'lucide-react';

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

    const stories = [
        { id: 1, name: "Your Story", isMe: true },
        { id: 2, name: "FC Dinamo" },
        { id: 3, name: "Luka M." },
        { id: 4, name: "Elite Scout" },
        { id: 5, name: "Nika K." },
        { id: 6, name: "Saba G." },
        { id: 7, name: "Goal Academy" },
    ];

    return (
        <div className="w-full pb-24">

            {/* Stories Section */}
            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide mb-2 -mx-1 px-1">
                {stories.map((story) => (
                    <div key={story.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                        <div className={`w-16 h-16 rounded-full p-1 border-2 border-black ${story.isMe ? 'bg-white' : 'bg-orange-400'}`}>
                            <div className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden ${story.isMe ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gradient-to-tr from-orange-300 to-orange-500 border border-black'}`}>
                                {story.isMe ? (
                                    <>
                                        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                        <div className="absolute bottom-0 right-0 bg-orange-500 rounded-full p-0.5 border-2 border-black">
                                            <Plus className="w-3 h-3 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-white font-black text-xs">{story.name.substring(0, 2).toUpperCase()}</span>
                                )}
                            </div>
                        </div>
                        <span className={`text-[11px] font-bold italic uppercase truncate w-16 text-center tracking-tighter ${story.isMe ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                            {story.name}
                        </span>
                    </div>
                ))}
            </div>

            {/* Mobile Search & Actions */}
            <div className="md:hidden mb-6 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search Talanti..." 
                        className="w-full bg-white dark:bg-gray-800 border-2 border-black rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Create Post Input */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black p-4 mb-6 flex gap-3 items-center transition-colors group">
                <div className="w-10 h-10 bg-gradient-to-tr from-orange-400 to-orange-600 rounded-full flex-shrink-0 border-2 border-black shadow-sm"></div>
                <div 
                    onClick={() => alert("Create post modal coming soon!")}
                    className="bg-gray-50 dark:bg-gray-700 w-full rounded-full py-2.5 px-5 text-gray-600 dark:text-gray-400 text-sm font-bold italic hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer flex items-center justify-between border border-gray-200"
                >
                    <span>Start a post or announce a tryout...</span>
                    <Plus className="w-4 h-4 text-orange-500 group-hover:scale-125 transition-transform" />
                </div>
            </div>

            {/* The Feed */}
            <div className="flex flex-col gap-5">
                {posts.map(post => {
                    const isClubPost = post.clubId !== null;
                    const displayName = isClubPost ? post.clubName : post.authorName;
                    const initials = displayName?.substring(0, 2).toUpperCase() || "??";
                    const isCommentsOpen = openComments[post.id];

                    return (
                        <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-2 border-black overflow-hidden transition-colors">
                            {/* Card Header */}
                            <div className="p-4 flex justify-between items-start">
                                <div className="flex gap-3 items-center">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shadow-inner border-2 border-black ${
                                        isClubPost ? "bg-emerald-600 text-white" : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-900 dark:text-gray-200"
                                    }`}>
                                        {initials}
                                    </div>
                                    <div>
                                        {isClubPost ? (
                                            <Link to={`/clubs/${post.clubId}`} className="font-black italic uppercase tracking-tighter text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors">
                                                {displayName} <ShieldCheck className="w-4 h-4 text-orange-400" />
                                            </Link>
                                        ) : (
                                            <div className="font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">{displayName}</div>
                                        )}
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase italic tracking-widest mt-0.5">
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
                                <p className="text-gray-900 dark:text-gray-200 whitespace-pre-line leading-relaxed font-medium">
                                    {post.content}
                                </p>
                            </div>

                            {/* Engagement Counters */}
                            {(post.likeCount > 0 || post.commentCount > 0) && (
                                <div className="px-4 py-2 border-t-2 border-black/5 flex gap-4 text-[10px] font-bold uppercase italic text-gray-500 dark:text-gray-400">
                                    {post.likeCount > 0 && <span className="text-orange-500">{post.likeCount} Likes</span>}
                                    {post.commentCount > 0 && <span className="text-emerald-600">{post.commentCount} Comments</span>}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="px-2 py-1 border-t-2 border-black flex justify-between bg-gray-50 dark:bg-gray-900/50">
                                <button
                                    onClick={() => handleLikeToggle(post.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-black italic uppercase text-xs transition-colors ${
                                        post.isLikedByMe ? "text-orange-500 hover:bg-orange-50" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <Heart className="w-4 h-4" fill={post.isLikedByMe ? "currentColor" : "none"} />
                                    Like
                                </button>
                                <button
                                    onClick={() => toggleComments(post.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-black italic uppercase text-xs transition-colors ${
                                        isCommentsOpen ? "text-emerald-600 bg-white border border-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Comment
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-black italic uppercase text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <Share2 className="w-4 h-4" /> Share
                                </button>
                            </div>

                            {/* --- INLINE COMMENT SECTION --- */}
                            {isCommentsOpen && (
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-t border-gray-100 dark:border-gray-700">

                                    {/* Existing Comments */}
                                    <div className="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
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
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-full py-2.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                                        />
                                        <button
                                            onClick={() => submitComment(post.id)}
                                            disabled={!commentInputs[post.id]?.trim()}
                                            className="absolute right-2 p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
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