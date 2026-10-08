import { usePostReactions } from '../hooks/usePostReactions';
import { reactionFields } from '../components/feed/reactions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Compass, Megaphone, RefreshCw, Search, Users } from 'lucide-react';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { FeedList } from '../components/feed/FeedList';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { type CommentDto, type FeedPostDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';
import { extractApiErrorMessage } from '../utils/apiError';
import { WorkspaceShortcuts, type ManagedClubLink } from '../components/layout/WorkspaceShortcuts';
import type { NavigationCapabilities } from '../context/navigationCapabilities';
import { OpportunityLink } from '../components/ui/OpportunityLink';
import { isAndroidApp } from '../android/bridge';
import { AndroidFeedComposer } from '../android/AndroidFeedComposer';

type FeedView = 'for-you' | 'following';
type FeedCursor = { cursor: number; cursorTime?: string };
type FeedNavigation = { cursor: FeedCursor | null; page: number; direction: 'older' | 'newer' };

const resolveFeedView = (value: string | null): FeedView => (value === 'following' ? 'following' : 'for-you');

interface FeedPageProps {
 managedClubs?: ManagedClubLink[];
 user?: { id?: number; username?: string; fullName?: string; avatarUrl?: string; navigationCapabilities?: NavigationCapabilities } | null;
}

export const FeedPage = (props: FeedPageProps) => {
 const [searchParams] = useSearchParams();
 return isAndroidApp && searchParams.get('compose') === '1'
  ? <AndroidFeedComposer user={props.user} /> : <FeedContent {...props} />;
};

const FeedContent = ({ user = null, managedClubs = [] }: FeedPageProps) => {
 const [searchParams] = useSearchParams();
 const [posts, setPosts] = useState<FeedPostDto[]>([]);
 const [loading, setLoading] = useState(true);
 const [hasLoaded, setHasLoaded] = useState(false);
 const [loadError, setLoadError] = useState(false);
 const [loadingMore, setLoadingMore] = useState(false);
 const [moreError, setMoreError] = useState(false);
 const [failedDirection, setFailedDirection] = useState<'older' | 'newer' | null>(null);
 const [nextPage, setNextPage] = useState<FeedCursor | null>(null);
 const [pageStarts, setPageStarts] = useState<(FeedCursor | null)[]>([null]);
 const [pageIndex, setPageIndex] = useState(0);
 const requestVersion = useRef(0);
 const requestController = useRef<AbortController | null>(null);
 const morePending = useRef(false);
 const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
 const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
 const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
 const [pendingLikes, setPendingLikes] = useState<Record<number, boolean>>({});
 const [likeErrors, setLikeErrors] = useState<Record<number, string | null>>({});
 const [commentsErrors, setCommentsErrors] = useState<Record<number, string | null>>({});
 const [commentsLoading, setCommentsLoading] = useState<Record<number, boolean>>({});
 const feedView = resolveFeedView(searchParams.get('view'));
 const isFollowingView = feedView === 'following';
 const feedEndpoint = isFollowingView ? '/posts/feed/following' : '/posts/feed/for-you';

 const activeEndpoint = useRef(feedEndpoint);
 activeEndpoint.current = feedEndpoint;

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
   emptyText: "Discover public posts from clubs and people you do not follow yet. Start with a few useful places.",
   emptyGuides: [
    { label: 'Find Clubs', to: '/clubs' },
    { label: 'Browse Map', to: '/map' },
    { label: 'Your schedule', to: '/calendar' }
   ]
  };

 const loadFeed = useCallback(async (navigation?: FeedNavigation) => {
  const changingPage = navigation !== undefined;
  if (changingPage && (morePending.current || (navigation.direction === 'older' && !nextPage))) return;
  if (!changingPage) {
   requestVersion.current++;
   requestController.current?.abort();
   morePending.current = false;
   setLoading(true);
   setLoadingMore(false);
   setLoadError(false);
   setNextPage(null);
   setPageStarts([null]);
   setPageIndex(0);
   setOpenComments({});
   setCommentsData({});
   setCommentsErrors({});
   setCommentsLoading({});
   setLikeErrors({});
   setSelectedPost(null);
  } else {
   morePending.current = true;
   setLoadingMore(true);
  }
  setMoreError(false);
  setFailedDirection(null);
  const version = requestVersion.current;
  const controller = new AbortController();
  requestController.current = controller;
  const current = () => !controller.signal.aborted && requestVersion.current === version && activeEndpoint.current === feedEndpoint;
  try {
   const response = await apiClient.get(feedEndpoint, { params: { limit: 20, ...(navigation?.cursor ?? {}) }, signal: controller.signal });
   if (!current()) return;
   const raw: FeedPostDto[] = response.data.posts ?? response.data.content ?? [];
   if (!Array.isArray(raw)) throw new Error('Invalid feed page');
   // Kotlin omits default zero/false values; retain truthful counts and like rollback.
   const batch = raw.map(post => ({ ...post, likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0, isLikedByMe: post.isLikedByMe ?? false }));
   const cursor: number | null = response.data.nextCursor ?? null;
   const boundary = batch.find(post => post.id === cursor);
   if (cursor !== null && (!Number.isSafeInteger(cursor) || !boundary || (navigation?.direction === 'older' && cursor === navigation.cursor?.cursor))) throw new Error('Invalid feed cursor');
   const seen = new Set(navigation?.direction === 'older' ? posts.map(post => post.id) : []);
   setPosts(batch.filter(post => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
   }));
   setNextPage(cursor === null ? null : { cursor, cursorTime: boundary?.createdAt });
   if (navigation) {
    setPageIndex(navigation.page);
    if (navigation.direction === 'older') setPageStarts(history => [...history.slice(0, navigation.page), navigation.cursor]);
    setOpenComments({});
    setCommentsData({});
    setCommentsErrors({});
    setCommentsLoading({});
    setSelectedPost(null);
   }
  } catch {
   if (!current()) return;
   if (navigation) {
    setMoreError(true);
    setFailedDirection(navigation.direction);
   }
   else setLoadError(true);
  } finally {
   if (current()) {
    setHasLoaded(true);
    morePending.current = false;
    setLoading(false);
    setLoadingMore(false);
   }
  }
 }, [feedEndpoint, nextPage, posts]);

 // Pagination state does not restart the first page. A view change invalidates
 // old successes AND failures, even if an adapter ignores AbortSignal.
 useEffect(() => {
  void loadFeed();
  const lifecycle = requestVersion;
  const request = requestController;
  return () => { lifecycle.current++; request.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [feedEndpoint]);

 const applyLikeState = (postId: number, isLiked: boolean) => {
  const updatePost = (post: FeedPostDto) => post.id !== postId || post.isLikedByMe === isLiked
   ? post
   : { ...post, isLikedByMe: isLiked, likeCount: Math.max(0, post.likeCount + (isLiked ? 1 : -1)) };
  setPosts((current) => current.map(updatePost));
  setSelectedPost((current) => current ? updatePost(current) : null);
 };

 const reactions = usePostReactions(feedEndpoint, saved => {
        const update = (post: FeedPostDto) => post.id === saved.id ? reactionFields(post, saved) : post;
        setPosts(current => current.map(update));
        setSelectedPost(current => current ? update(current) : null);
    });

    const handleLikeToggle = async (postId: number) => {
  if (pendingLikes[postId]) return;
  const currentPost = posts.find((post) => post.id === postId) ?? (selectedPost?.id === postId ? selectedPost : null);
  if (!currentPost) return;
  const previousState = currentPost.isLikedByMe;
  const desiredState = !previousState;
  setPendingLikes((current) => ({ ...current, [postId]: true }));
  setLikeErrors((current) => ({ ...current, [postId]: null }));
  applyLikeState(postId, desiredState);

  try {
   const response = await apiClient.put<{ isLiked: boolean }>(`/posts/${postId}/like`, { liked: desiredState });
   applyLikeState(postId, response.data.isLiked);
  } catch (error) {
   applyLikeState(postId, previousState);
   setLikeErrors((current) => ({ ...current, [postId]: extractApiErrorMessage(error, 'Like could not be saved. Your previous choice was restored.') }));
  } finally {
   setPendingLikes((current) => ({ ...current, [postId]: false }));
  }
 };

 const loadComments = async (postId: number) => {
  setCommentsLoading((current) => ({ ...current, [postId]: true }));
  setCommentsErrors((current) => ({ ...current, [postId]: null }));
  try {
   const response = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
   setCommentsData((current) => ({ ...current, [postId]: response.data }));
  } catch (error) {
   setCommentsErrors((current) => ({ ...current, [postId]: extractApiErrorMessage(error, 'Comments could not load.') }));
  } finally {
   setCommentsLoading((current) => ({ ...current, [postId]: false }));
  }
 };

 const toggleComments = async (postId: number) => {
  const isOpen = openComments[postId];
  setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }));
  if (!isOpen && !commentsData[postId]) {
   await loadComments(postId);
  }
 };

 const submitComment = async (postId: number, content: string) => {
  const response = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });
  setCommentsData((current) => {
   const existing = current[postId] || [];
   return { ...current, [postId]: existing.some((comment) => comment.id === response.data.id) ? existing : [...existing, response.data] };
  });
  setPosts((current) => current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)));
  setSelectedPost((current) => current?.id === postId ? { ...current, commentCount: current.commentCount + 1 } : current);
 };

 return (
  <div className="home-feed-canvas mx-auto flex w-full max-w-[680px] flex-col gap-4">
   <h1 className="sr-only">Home</h1>
   {isAndroidApp ? <div className="lg:hidden"><WorkspaceShortcuts clubs={managedClubs} navigationCapabilities={user?.navigationCapabilities} /></div> :
    <details className="home-mobile-shortcuts">
     <summary><span>Your football</span><span className="home-mobile-shortcuts-name">{user?.fullName || user?.username || 'Your shortcuts'}</span><ChevronDown size={16} aria-hidden="true" /></summary>
     <LeftSidebar user={user} managedClubs={managedClubs} embedded />
    </details>}
   {isAndroidApp && <nav aria-label="Opportunities" className="home-opportunity-strip xl:hidden">
    <OpportunityLink kind="store" to="/store" description="Club merchandise" />
    <OpportunityLink kind="campaigns" to="/campaigns" description="Club projects" />
    <OpportunityLink kind="jobs" to="/jobs" description="Find your next step" />
   </nav>}

   <PostComposer
    compact
    home
    authorName={user?.fullName || user?.username || 'You'}
    avatarUrl={user?.avatarUrl}
    onPostCreated={() => void loadFeed()}
   />

   <nav aria-label="Home posts" className="app-selection-rail feed-selection-rail grid grid-cols-[1fr_1fr_auto] border-b border-[var(--feed-divider)] bg-transparent px-1">
    <SelectionIndicator value={isFollowingView ? 'following' : 'discover'} />
    <Link
     to="/home"
     aria-current={!isFollowingView ? 'page' : undefined}
     title="Discover public posts from beyond your follows, newest first"
     className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${!isFollowingView ? 'border-[var(--feed-accent)] text-[var(--feed-text-primary)]' : 'border-transparent text-[var(--feed-text-muted)] hover:text-[var(--feed-text-primary)]'}`}
    >
     <Compass className="h-4 w-4" /> Discover
    </Link>
    <Link
     to="/home?view=following"
     aria-current={isFollowingView ? 'page' : undefined}
     title="Latest posts from people and clubs you follow"
     className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${isFollowingView ? 'border-[var(--feed-accent)] text-[var(--feed-text-primary)]' : 'border-transparent text-[var(--feed-text-muted)] hover:text-[var(--feed-text-primary)]'}`}
    >
     <Users className="h-4 w-4" /> Following
    </Link>
    <button type="button" onClick={() => void loadFeed()} disabled={loading} aria-label="Refresh feed" title="Refresh feed" className="home-refresh m-1 flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-[var(--feed-text-secondary)] hover:bg-[var(--feed-hover-bg)] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><span className="home-refresh-label">Latest updates</span></button>
   </nav>

   {loadError && (
    <div className="rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-5 py-4">
     <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-danger)]" />
      <div className="min-w-0">
       <p className="text-sm font-semibold text-[color:var(--color-danger)]">Home could not load</p>
       <p className="mt-1 text-xs text-[color:var(--color-danger)]/80">Check your connection and try again.</p>
      </div>
      <button
       type="button"
       onClick={() => void loadFeed()}
       className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--color-danger)]/30 bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-danger)] transition-colors hover:bg-[var(--color-surface)]"
      >
       <RefreshCw className="h-3.5 w-3.5" />
       Retry
      </button>
     </div>
    </div>
   )}
   <section aria-label="Feed results" aria-busy={loading} className="relative">
   {loading && hasLoaded && <div role="status" className="absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-full bg-[color:var(--theme-surface)] px-3 py-2 text-sm shadow">
    Loading {isFollowingView ? 'Following' : 'Discover'} posts…
   </div>}
   <div inert={loading} className={loading && posts.length > 0 ? 'opacity-50' : ''}>
   {loading && !hasLoaded ? (
    <div className="flex flex-col gap-3" aria-label="Loading Home posts">
     <SkeletonCard lines={4} />
     <SkeletonCard lines={3} />
     <SkeletonCard lines={5} />
    </div>
   ) : !loadError && <FeedList
    home
    posts={posts}
    openComments={openComments}
    commentsData={commentsData}
    onLikeToggle={handleLikeToggle}
    onReactionChange={reactions.change}
    onToggleComments={toggleComments}
    onSubmitComment={submitComment}
    pendingLikes={{ ...pendingLikes, ...reactions.pending }}
    likeErrors={{ ...likeErrors, ...reactions.errors }}
    commentsErrors={commentsErrors}
    onRetryComments={(postId) => void loadComments(postId)}
    onSelectPost={(post) => {
     setSelectedPost(post);
     if (!commentsData[post.id]) {
      void toggleComments(post.id);
     }
    }}
    emptyState={pageIndex > 0 ? (
     <div className="rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] px-5 py-10 text-center text-sm text-[var(--feed-text-secondary)]">No additional posts on this page. Use Newer posts or continue to older posts.</div>
    ) : (
     <div className={`rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] px-5 py-12 text-center ${loading ? 'invisible' : ''}`}>
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

   </div>
   </section>
   {!loading && !loadError && (posts.length > 0 || pageIndex > 0) && <div className="flex flex-wrap items-center justify-center gap-3 py-4 text-center">
    {moreError && <p role="alert" className="mb-3 text-sm text-[color:var(--color-warning)]">{failedDirection === 'newer' ? 'Newer posts could not load. Retry, or return to the latest posts.' : 'Older posts could not load. Retry, or refresh the feed to start again.'}</p>}
    {pageIndex > 0 && <button type="button" disabled={loadingMore} onClick={() => void loadFeed({ cursor: pageStarts[pageIndex - 1], page: pageIndex - 1, direction: 'newer' })}
     className="rounded-full border border-[var(--feed-card-border)] px-5 py-2 text-sm text-[var(--feed-text-primary)] disabled:opacity-50">{moreError && failedDirection === 'newer' ? 'Retry newer posts' : 'Newer posts'}</button>}
    {pageIndex > 1 && <button type="button" disabled={loadingMore} onClick={() => void loadFeed()}
     className="rounded-full border border-[var(--feed-card-border)] px-5 py-2 text-sm text-[var(--feed-text-primary)] disabled:opacity-50">Back to latest</button>}
    {nextPage ? <button type="button" disabled={loadingMore} onClick={() => void loadFeed({ cursor: nextPage, page: pageIndex + 1, direction: 'older' })}
     className="rounded-full border border-[var(--feed-card-border)] px-5 py-2 text-sm text-[var(--feed-text-primary)] disabled:opacity-50">
     {loadingMore ? 'Loading more posts…' : moreError && failedDirection === 'older' ? 'Retry older posts' : 'Load more posts'}
    </button> : <p role="status" className="text-sm text-[var(--feed-text-secondary)]">You’re all caught up. Refresh to check for new posts.</p>}
   </div>}

   <PostTheaterModal
    isOpen={!!selectedPost}
    post={selectedPost}
    onClose={() => setSelectedPost(null)}
    commentsData={selectedPost ? commentsData[selectedPost.id] : undefined}
    onSubmitComment={submitComment}
    onLikeToggle={handleLikeToggle}
    onReactionChange={reactions.change}
    likePending={selectedPost ? reactions.pending[selectedPost.id] === true || pendingLikes[selectedPost.id] === true : false}
    likeError={selectedPost ? reactions.errors[selectedPost.id] || likeErrors[selectedPost.id] : null}
    commentsLoading={selectedPost ? commentsLoading[selectedPost.id] === true : false}
    commentsError={selectedPost ? commentsErrors[selectedPost.id] : null}
    onRetryComments={(postId) => void loadComments(postId)}
   />
  </div>
 );
};
import { SelectionIndicator } from '../components/ui/SelectionIndicator';
