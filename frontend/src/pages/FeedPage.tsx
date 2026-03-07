import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Heart, MessageCircle, Share2, ShieldCheck, MoreHorizontal, Send, Plus, Search, Video } from 'lucide-react';

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
        }
    };

    // --- 2. HANDLE COMMENTS SECTION TOGGLE ---
    const toggleComments = async (postId: number) => {
        const isCurrentlyOpen = openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: !isCurrentlyOpen }));

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
            setCommentsData(prev => ({
                ...prev,
                [postId]: [...(prev[postId] || []), res.data]
            }));
            setPosts(currentPosts => currentPosts.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
            setCommentInputs(prev => ({ ...prev, [postId]: "" }));
        } catch (err) {
            alert("Failed to post comment.");
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-sm animate-pulse">Loading feed...</div>;

    const stories = [
        { id: 1, name: "Upload", isMe: true },
        { id: 2, name: "FC Dinamo" },
        { id: 3, name: "Luka M." },
        { id: 4, name: "Elite Scout" },
        { id: 5, name: "Nika K." },
        { id: 6, name: "Saba G." }
    ];

    return (
        <div className="w-full pb-24 text-slate-900 dark:text-slate-200">

            {/* Sharp Highlight Reels (Stories) */}
            <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-2 -mx-1 px-1">
                {stories.map((story) => (
                    <div key={story.id} className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group w-16">
                        <div className={`w-14 h-14 rounded-sm border-2 ${story.isMe ? 'border-dashed border-slate-400 bg-transparent flex flex-col items-center justify-center hover:border-emerald-500 hover:text-emerald-500' : 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500'} transition-colors`}>
                            {story.isMe ? <Plus className="w-5 h-5" /> : story.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold uppercase truncate w-full text-center tracking-widest text-slate-500 dark:text-slate-400 group-hover:text-emerald-500">
                            {story.name}
                        </span>
                    </div>
                ))}
            </div>

            {/* Mobile Search (Restored) */}
            <div className="md:hidden mb-6 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Talanti..."
                        className="w-full bg-white dark:bg-[#1e293b] border-2 border-slate-200 dark:border-slate-700 rounded-sm py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
                    />
                </div>
            </div>

            {/* Sharp Create Post Input */}
            <div className="bg-white dark:bg-[#1e293b] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-200 dark:border-slate-800 p-4 mb-6 flex gap-3 items-center">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-sm flex-shrink-0 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-slate-500" />
                </div>
                <div
                    onClick={() => alert("Create post modal coming soon!")}
                    className="bg-slate-50 dark:bg-slate-900/50 w-full rounded-sm py-2.5 px-4 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer flex items-center justify-between border border-slate-200 dark:border-slate-700"
                >
                    <span>Start a post or announce a tryout...</span>
                    <Video className="w-4 h-4 text-emerald-500" />
                </div>
            </div>

            {/* PREMIUM EMPTY STATE (Restored) */}
            {posts.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#1e293b] rounded-sm border-2 border-dashed border-slate-300 dark:border-slate-700 text-center shadow-sm">
                    <div className="text-5xl mb-4 grayscale opacity-60">⚽</div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">The pitch is empty</h3>
                    <p className="text-slate-500 mt-2 font-medium text-sm">Follow clubs and players to get the ball rolling.</p>
                </div>
            )}

            {/* The Feed */}
            <div className="flex flex-col gap-6">
                {posts.map(post => {
                    const isClubPost = post.clubId !== null;
                    const displayName = isClubPost ? post.clubName : post.authorName;
                    const isCommentsOpen = openComments[post.id];

                    // Dynamic Avatars Restored
                    const avatarColor = isClubPost ? '059669' : 'f97316';
                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=${avatarColor}&color=fff&bold=true`;

                    return (
                        <div key={post.id} className="bg-white dark:bg-[#1e293b] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">

                            {/* Header */}
                            <div className="p-4 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/50">
                                <div className="flex gap-3 items-center">
                                    <img src={avatarUrl} alt={displayName || 'Avatar'} className="w-10 h-10 rounded-sm border border-slate-200 dark:border-slate-700 object-cover" />
                                    <div>
                                        {isClubPost ? (
                                            <Link to={`/clubs/${post.clubId}`} className="font-bold uppercase tracking-wide text-slate-900 dark:text-white hover:text-emerald-500 text-sm flex items-center gap-1.5 transition-colors">
                                                {displayName} <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                                            </Link>
                                        ) : (
                                            <div className="font-bold uppercase tracking-wide text-slate-900 dark:text-white text-sm">{displayName}</div>
                                        )}
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                            {formatTime(post.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5">
                                <p className="text-slate-800 dark:text-slate-300 whitespace-pre-line leading-relaxed text-sm font-medium">
                                    {post.content}
                                </p>
                            </div>

                            {/* Counters */}
                            {(post.likeCount > 0 || post.commentCount > 0) && (
                                <div className="px-5 pb-3 flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    {post.likeCount > 0 && <span className="text-orange-500">{post.likeCount} Likes</span>}
                                    {post.commentCount > 0 && <span className="text-emerald-600">{post.commentCount} Comments</span>}
                                </div>
                            )}

                            {/* Action Bar */}
                            <div className="flex border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]">
                                <button
                                    onClick={() => handleLikeToggle(post.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-r border-slate-200 dark:border-slate-800 ${
                                        post.isLikedByMe ? "text-orange-500 bg-orange-50 dark:bg-orange-900/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <Heart className="w-4 h-4" fill={post.isLikedByMe ? "currentColor" : "none"} />
                                    Like
                                </button>
                                <button
                                    onClick={() => toggleComments(post.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-r border-slate-200 dark:border-slate-800 ${
                                        isCommentsOpen ? "text-emerald-600 bg-slate-100 dark:bg-slate-800" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Comment
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <Share2 className="w-4 h-4" /> Share
                                </button>
                            </div>

                            {/* Comments Section */}
                            {isCommentsOpen && (
                                <div className="bg-slate-50 dark:bg-[#111827] p-4 border-t border-slate-200 dark:border-slate-800">
                                    <div className="flex flex-col gap-4 mb-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                                        {!commentsData[post.id] ? (
                                            <div className="text-xs font-medium text-center text-slate-500">Loading comments...</div>
                                        ) : commentsData[post.id].length === 0 ? (
                                            <div className="text-xs font-medium text-center text-slate-500">No comments yet. Be the first!</div>
                                        ) : (
                                            commentsData[post.id].map(comment => (
                                                <div key={comment.id} className="flex gap-3">
                                                    <img
                                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=e5e7eb&color=374151&bold=true`}
                                                        alt="User"
                                                        className="w-8 h-8 rounded-sm border border-slate-300 dark:border-slate-600 flex-shrink-0 object-cover"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">{comment.authorName}</span>
                                                            <span className="text-[9px] uppercase tracking-widest text-slate-500">{formatTime(comment.createdAt)}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-sm inline-block shadow-sm">
                                                            {comment.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Add Comment Input */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Write a comment..."
                                            value={commentInputs[post.id] || ""}
                                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-sm px-3 py-2 outline-none focus:border-emerald-500 font-medium transition-colors shadow-sm"
                                        />
                                        <button
                                            onClick={() => submitComment(post.id)}
                                            disabled={!commentInputs[post.id]?.trim()}
                                            className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm disabled:opacity-50 transition-colors shadow-sm"
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