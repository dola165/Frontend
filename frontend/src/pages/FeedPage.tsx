import { useEffect, useState } from 'react';
import { apiClient } from '../api/axiosConfig';
import { Megaphone } from 'lucide-react';
import { FeedPost } from "../components/feed/FeedPost";
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';

// --- INTERFACES ---
export interface FeedPostDto {
    id: number; content: string; createdAt: string; authorId: number; authorName: string;
    clubId: number | null; clubName: string | null; likeCount: number; commentCount: number;
    isLikedByMe: boolean; mediaUrls?: string[]; image?: string;
}

export interface CommentDto {
    id: number; authorName: string; content: string; createdAt: string;
}

export const FeedPage = () => {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);

    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);

    useEffect(() => {
        apiClient.get('/posts/feed')
            .then(res => {
                setPosts(res.data.content || res.data.posts || res.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load feed", err);
                setLoading(false);
            });
    }, []);

    const handleLikeToggle = async (postId: number) => {
        setPosts(current => current.map(post => post.id === postId ? { ...post, isLikedByMe: !post.isLikedByMe, likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1 } : post));

        if (selectedPost?.id === postId) {
            setSelectedPost(prev => prev ? { ...prev, isLikedByMe: !prev.isLikedByMe, likeCount: prev.isLikedByMe ? prev.likeCount - 1 : prev.likeCount + 1 } : null);
        }

        // 🛡️ MIGRATION FIX: Removed /feed prefix
        try { await apiClient.post(`/posts/${postId}/like`); } catch { /* ignore */ }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !commentsData[postId]) {
            try {
                // 🛡️ MIGRATION FIX: Removed /feed prefix
                const res = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
                setCommentsData(prev => ({ ...prev, [postId]: res.data }));
            } catch (err) { console.error(err); }
        }
    };

    const submitComment = async (postId: number, content: string) => {
        try {
            // 🛡️ MIGRATION FIX: Removed /feed prefix
            const res = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });

            setCommentsData(prev => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
            setPosts(current => current.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));

            if (selectedPost?.id === postId) {
                setSelectedPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : null);
            }
        } catch (err) { alert("Failed to post comment."); }
    };

    if (loading) return <div className="flex justify-center p-10 font-bold uppercase tracking-widest text-slate-500">Decrypting transmissions...</div>;

    return (
        <div className="w-full relative">
            <PostComposer
                onPostCreated={() => {
                    // 🛡️ MIGRATION FIX: Pointed to /posts/feed instead of /feed
                    apiClient.get('/posts/feed').then(res => setPosts(res.data.content || res.data.posts || res.data || []));
                }}
            />

            {posts.length === 0 ? (
                <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-10 shadow-lg text-center flex flex-col items-center justify-center mt-6">
                    <Megaphone className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Silence on the Network</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No transmissions intercepted yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {posts.map(post => (
                        <FeedPost
                            key={post.id}
                            post={post}
                            isCommentsOpen={openComments[post.id]}
                            commentsData={commentsData[post.id]}
                            onLikeToggle={handleLikeToggle}
                            onToggleComments={toggleComments}
                            onSubmitComment={submitComment}
                            onImageClick={() => {
                                setSelectedPost(post);
                                if (!commentsData[post.id]) toggleComments(post.id);
                            }}
                        />
                    ))}
                </div>
            )}

            <PostTheaterModal
                isOpen={!!selectedPost}
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                commentsData={selectedPost ? commentsData[selectedPost.id] : undefined}
                onSubmitComment={submitComment}
                onLikeToggle={handleLikeToggle}
            />
        </div>
    );
};