import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { Megaphone, Loader2 } from 'lucide-react';
import { PostComposer } from '../../feed/PostComposer';
import { FeedPost, type FeedPostDto, type CommentDto } from '../../feed/FeedPost';
import { PostTheaterModal } from '../../PostTheaterModal';

interface TabOurClubProps {
    clubId: number;
    isOwnClubAdmin: boolean;
}

export const TabOurClub = ({ clubId, isOwnClubAdmin }: TabOurClubProps) => {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);

    // Interactions & Modals
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);

    const loadFeed = async () => {
        try {
            const res = await apiClient.get(`/clubs/${clubId}/feed`);
            setPosts(res.data.posts || []);
        } catch (err) {
            console.error("Failed to load feed", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadFeed(); }, [clubId]);

    const handleLikeToggle = async (postId: number) => {
        setPosts(current => current.map(post => post.id === postId ? { ...post, isLikedByMe: !post.isLikedByMe, likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1 } : post));
        if (selectedPost?.id === postId) {
            setSelectedPost(prev => prev ? { ...prev, isLikedByMe: !prev.isLikedByMe, likeCount: prev.isLikedByMe ? prev.likeCount - 1 : prev.likeCount + 1 } : null);
        }
        try { await apiClient.post(`/feed/posts/${postId}/like`); } catch { /* ignore */ }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !commentsData[postId]) {
            try {
                const res = await apiClient.get<CommentDto[]>(`/feed/posts/${postId}/comments`);
                setCommentsData(prev => ({ ...prev, [postId]: res.data }));
            } catch (err) { console.error(err); }
        }
    };

    const submitComment = async (postId: number, content: string) => {
        try {
            const res = await apiClient.post<CommentDto>(`/feed/posts/${postId}/comments`, { content });
            setCommentsData(prev => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
            setPosts(current => current.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
            if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : null);
        } catch (err) { alert("Failed to post comment."); }
    };

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

    return (
        <div className="w-full flex flex-col gap-4">
            {isOwnClubAdmin && (
                <PostComposer clubId={clubId} authorName="Club Admin" onPostCreated={loadFeed} />
            )}

            {posts.length === 0 ? (
                <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-10 shadow-lg text-center flex flex-col items-center justify-center">
                    <Megaphone className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Silence on the Network</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No transmissions intercepted yet.</p>
                </div>
            ) : (
                posts.map(post => (
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
                ))
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