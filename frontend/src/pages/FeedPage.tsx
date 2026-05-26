import { useEffect, useState } from 'react';
import { Compass, Megaphone, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { FeedList } from '../components/feed/FeedList';
import { type CommentDto, type FeedPostDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { StoriesRail } from '../components/feed/StoriesRail';
import { PostTheaterModal } from '../components/PostTheaterModal';

type FeedView = 'for-you' | 'following';

const resolveFeedView = (value: string | null): FeedView => (value === 'following' ? 'following' : 'for-you');

export const FeedPage = () => {
    const [searchParams] = useSearchParams();
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const feedView = resolveFeedView(searchParams.get('view'));
    const isFollowingView = feedView === 'following';
    const FeedViewIcon = isFollowingView ? Users : Compass;
    const feedMeta = isFollowingView
        ? {
            endpoint: '/posts/feed/following',
            loadingLabel: 'Loading following feed',
            title: 'Following Feed',
            description: 'Recent updates from the clubs, teams, and people you already chose to follow.',
            emptyTitle: 'No Following Activity Yet',
            emptyText: 'Follow clubs and creators to build a predictable feed here.'
        }
        : {
            endpoint: '/posts/feed/for-you',
            loadingLabel: 'Loading for you feed',
            title: 'For You',
            description: 'Discovery posts from outside your network, selected to help you find new clubs, teams, and creators.',
            emptyTitle: 'No Discovery Posts Yet',
            emptyText: 'Fresh discovery posts will appear here as the network grows.'
        };

    const loadFeed = async () => {
        setLoading(true);
        setOpenComments({});
        setCommentsData({});
        setSelectedPost(null);

        try {
            const response = await apiClient.get(feedMeta.endpoint);
            setPosts(response.data.content || response.data.posts || response.data || []);
        } catch (error) {
            console.error('Failed to load feed', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadFeed();
    }, [feedView]);

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
                <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">{feedMeta.loadingLabel}</p>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4">
            <section className="rounded-[20px] border border-subtle bg-surface shadow-panel">
                <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Feed Workspace</p>
                        <h1 className="mt-2 text-xl font-black uppercase tracking-[0.12em] text-primary">{feedMeta.title}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">{feedMeta.description}</p>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-accent-primary bg-accent-primary-soft accent-primary">
                        <FeedViewIcon className="h-5 w-5" />
                    </div>
                </div>
            </section>

            <StoriesRail />

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
                    <div className="rounded-[20px] border border-subtle bg-surface px-5 py-12 text-center shadow-panel">
                    <Megaphone className="mx-auto h-10 w-10 text-secondary" />
                    <h3 className="mt-4 text-lg font-black uppercase tracking-[0.14em] text-primary">{feedMeta.emptyTitle}</h3>
                    <p className="mt-2 text-sm text-secondary">{feedMeta.emptyText}</p>
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
