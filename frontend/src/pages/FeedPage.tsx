import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Compass, Megaphone, RefreshCw, Search, Sparkles, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { FeedList } from '../components/feed/FeedList';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { type CommentDto, type FeedPostDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';

type FeedView = 'for-you' | 'following';

const resolveFeedView = (value: string | null): FeedView => (value === 'following' ? 'following' : 'for-you');

interface FeedPageProps {
 user?: { username?: string; fullName?: string; avatarUrl?: string } | null;
}

export const FeedPage = ({ user = null }: FeedPageProps) => {
 const [searchParams] = useSearchParams();
 const [posts, setPosts] = useState<FeedPostDto[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState(false);
 const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
 const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
 const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
 const feedView = resolveFeedView(searchParams.get('view'));
 const isFollowingView = feedView === 'following';
 const feedEndpoint = isFollowingView ? '/posts/feed/following' : '/posts/feed/for-you';

 const feedMeta = isFollowingView
  ? {
   emptyTitle: 'No Following Activity Yet',
   emptyText: 'Follow clubs and people to bring their latest posts into Home.',
   emptyGuides: [
    { label: 'Browse Clubs', to: '/clubs' },
    { label: 'Explore Map', to: '/map' }
   ]
  }
  : {
   emptyTitle: 'Your Home is ready',
   emptyText: "Your recommendations will grow as you follow clubs, people and competitions. Start with a few useful places.",
   emptyGuides: [
    { label: 'Find Clubs', to: '/clubs' },
    { label: 'Browse Map', to: '/map' },
    { label: 'Discover Events', to: '/tournaments' }
   ]
  };

 const loadFeed = useCallback(async () => {
  setLoading(true);
  setLoadError(false);
  setOpenComments({});
  setCommentsData({});
  setSelectedPost(null);

  try {
   const response = await apiClient.get(feedEndpoint);
   setPosts(response.data.content || response.data.posts || response.data || []);
  } catch (error) {
   console.error('Failed to load feed', error);
   setLoadError(true);
   setPosts([]);
  } finally {
   setLoading(false);
  }
 }, [feedEndpoint]);

 useEffect(() => {
  void loadFeed();
 }, [loadFeed]);

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

 return (
  <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
   <h1 className="sr-only">Home</h1>

   <PostComposer
    compact
    authorName={user?.fullName || user?.username || 'You'}
    avatarUrl={user?.avatarUrl}
    onPostCreated={loadFeed}
   />

   <nav aria-label="Home posts" className="grid grid-cols-2 border-b border-[var(--feed-divider)] bg-transparent px-1">
    <Link
     to="/home"
     className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${!isFollowingView ? 'border-[var(--feed-accent)] text-[var(--feed-text-primary)]' : 'border-transparent text-[var(--feed-text-muted)] hover:text-[var(--feed-text-primary)]'}`}
    >
     <Sparkles className="h-4 w-4" /> For You
    </Link>
    <Link
     to="/home?view=following"
     className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${isFollowingView ? 'border-[var(--feed-accent)] text-[var(--feed-text-primary)]' : 'border-transparent text-[var(--feed-text-muted)] hover:text-[var(--feed-text-primary)]'}`}
    >
     <Users className="h-4 w-4" /> Following
    </Link>
   </nav>

   {loadError && (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4">
     <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
      <div className="min-w-0">
       <p className="text-sm font-semibold text-rose-300">Home could not load</p>
       <p className="mt-1 text-xs text-rose-300/80">Check your connection and try again.</p>
      </div>
      <button
       type="button"
       onClick={() => void loadFeed()}
       className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/30 bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-[#1a1c22]"
      >
       <RefreshCw className="h-3.5 w-3.5" />
       Retry
      </button>
     </div>
    </div>
   )}
   {loading ? (
    <div className="flex flex-col gap-3" aria-label="Loading Home posts">
     <SkeletonCard lines={4} />
     <SkeletonCard lines={3} />
     <SkeletonCard lines={5} />
    </div>
   ) : <FeedList
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
   />}

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
