import { useEffect, useState } from 'react';
import { AlertTriangle, Compass, Megaphone, RefreshCw, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { FeedList } from '../components/feed/FeedList';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { type CommentDto, type FeedPostDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';

type FeedView = 'for-you' | 'following';

const resolveFeedView = (value: string | null): FeedView => (value === 'following' ? 'following' : 'for-you');

export const FeedPage = () => {
    const [searchParams] = useSearchParams();
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const [showWelcomeBanner, setShowWelcomeBanner] = useState(
        () => !localStorage.getItem('hasSeenWelcomeBanner')
    );
    const feedView = resolveFeedView(searchParams.get('view'));
    const isFollowingView = feedView === 'following';

    const feedMeta = isFollowingView
        ? {
            endpoint: '/posts/feed/following',
            loadingLabel: 'Loading following feed...',
            emptyTitle: 'No Following Activity Yet',
            emptyText: 'Follow clubs and creators to build your feed here.',
            emptyGuides: [
                { label: 'Browse Clubs', to: '/clubs' },
                { label: 'Explore Map', to: '/map' }
            ]
        }
        : {
            endpoint: '/posts/feed/for-you',
            loadingLabel: 'Loading feed...',
            emptyTitle: 'Your feed is waiting',
            emptyText: "You haven't followed any clubs yet, but there's a whole network to explore. Start by browsing clubs or checking the map for events near you.",
            emptyGuides: [
                { label: 'Find Clubs', to: '/clubs' },
                { label: 'Browse Map', to: '/map' },
                { label: 'Discover Events', to: '/tournaments' }
            ]
        };

    const loadFeed = async () => {
        setLoading(true);
        setLoadError(false);
        setOpenComments({});
        setCommentsData({});
        setSelectedPost(null);

        try {
            const response = await apiClient.get(feedMeta.endpoint);
            setPosts(response.data.content || response.data.posts || response.data || []);
        } catch (error) {
            console.error('Failed to load feed', error);
            setLoadError(true);
            setPosts([]);
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
        } catch (error) {
            console.error('Failed to post comment', error);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 py-6">
                <SkeletonCard lines={4} />
                <SkeletonCard lines={3} />
                <SkeletonCard lines={5} />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
            {loadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Failed to load feed</p>
                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Check your connection and try again.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void loadFeed()}
                            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                        </button>
                    </div>
                </div>
            )}
            {showWelcomeBanner && (
                <div className="rounded-xl border border-[var(--feed-accent)] bg-[var(--feed-accent)]/5 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--feed-text-primary)]">Welcome to your feed</p>
                            <p className="mt-1 text-xs text-[var(--feed-text-secondary)]">
                                Use the sidebar to explore clubs, browse the map, and find people to follow. Your feed fills up as you connect with the network.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.setItem('hasSeenWelcomeBanner', '1');
                                setShowWelcomeBanner(false);
                            }}
                            className="shrink-0 text-xs font-semibold text-[var(--feed-accent)] hover:underline"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
            <PostComposer compact onPostCreated={loadFeed} />

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
                    <div className="rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] px-5 py-12 text-center">
                        <Megaphone className="mx-auto h-10 w-10 text-[var(--feed-icon-muted)]" />
                        <h3 className="mt-4 text-lg font-semibold text-[var(--feed-text-primary)]">{feedMeta.emptyTitle}</h3>
                        <p className="mt-2 max-w-md mx-auto text-sm leading-6 text-[var(--feed-text-secondary)]">{feedMeta.emptyText}</p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            {feedMeta.emptyGuides.map((guide) => (
                                <Link
                                    key={guide.to}
                                    to={guide.to}
                                    className="inline-flex items-center gap-2 rounded-full bg-[var(--feed-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)]"
                                >
                                    {guide.to === '/map' ? <Compass className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                                    {guide.label}
                                </Link>
                            ))}
                        </div>
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
