import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { FeedList } from '../components/feed/FeedList';
import { type CommentDto, type FeedPostDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';

export const FeedPage = () => {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);

    const loadFeed = async () => {
        try {
            const response = await apiClient.get('/posts/feed');
            setPosts(response.data.content || response.data.posts || response.data || []);
        } catch (error) {
            console.error('Failed to load feed', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadFeed();
    }, []);

    const handleLikeToggle = async (postId: number) => {
        setPosts((current) =>
            current.map((post) =>
                post.id === postId
                    ? { ...post, isLikedByMe: !post.isLikedByMe, likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1 }
                    : post
            )
        );

        if (selectedPost?.id === postId) {
            setSelectedPost((prev) =>
                prev ? { ...prev, isLikedByMe: !prev.isLikedByMe, likeCount: prev.isLikedByMe ? prev.likeCount - 1 : prev.likeCount + 1 } : null
            );
        }

        try {
            await apiClient.post(`/posts/${postId}/like`);
        } catch {
            // Keep optimistic UI.
        }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !commentsData[postId]) {
            try {
                const response = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
                setCommentsData((prev) => ({ ...prev, [postId]: response.data }));
            } catch (error) {
                console.error(error);
            }
        }
    };

    const submitComment = async (postId: number, content: string) => {
        try {
            const response = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });
            setCommentsData((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), response.data] }));
            setPosts((current) => current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)));
            if (selectedPost?.id === postId) {
                setSelectedPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : null));
            }
        } catch {
            alert('Failed to post comment.');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Loading network feed</p>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4">
            <section className="border-b border-subtle pb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Destination Feed</p>
                <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">Network Feed</h1>
                <p className="mt-2 text-sm leading-6 text-secondary">Posts stay content-first and scanable, with the composer as a utility surface rather than a promotional panel.</p>
            </section>

            <PostComposer onPostCreated={loadFeed} />

            <FeedList
                posts={posts}
                openComments={openComments}
                commentsData={commentsData}
                onLikeToggle={handleLikeToggle}
                onToggleComments={toggleComments}
                onSubmitComment={submitComment}
                onSelectPost={(post) => {
                    setSelectedPost(post);
                    if (!commentsData[post.id]) {
                        void toggleComments(post.id);
                    }
                }}
                emptyState={(
                    <div className="bg-surface border border-subtle px-5 py-12 text-center">
                    <Megaphone className="mx-auto h-10 w-10 text-secondary" />
                    <h3 className="mt-4 text-lg font-black uppercase tracking-[0.14em] text-primary">No Feed Activity Yet</h3>
                    <p className="mt-2 text-sm text-secondary">The network is quiet for now.</p>
                    </div>
                )}
                className="gap-3"
            />

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
