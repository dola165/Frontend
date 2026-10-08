import { usePostReactions } from '../../../hooks/usePostReactions';
import { reactionFields } from '../../../components/feed/reactions';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { Loader2, Megaphone } from 'lucide-react';
import { PostComposer } from '../../feed/PostComposer';
import { type FeedPostDto, type CommentDto } from '../../feed/FeedPost';
import { FeedList } from '../../feed/FeedList';
import { PostTheaterModal } from '../../PostTheaterModal';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
import type { ClubManagementTab } from '../../club/ClubManagementModal';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { usePagedProfilePosts } from '../../../hooks/usePagedProfilePosts';
import { ProfilePostPagination } from '../../profile/ProfilePostPagination';


interface TabOverviewProps {
  club: ClubProfile;
  isOwnClubAdmin: boolean;
  onOpenManageClub?: (tab: ClubManagementTab) => void;
}

export const TabOverview = ({ club, isOwnClubAdmin }: TabOverviewProps) => {
  const postPages = usePagedProfilePosts(`/posts/club/${club.id}`);
  const { posts, setPosts, loading } = postPages;
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
  const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
  const [commentsErrors, setCommentsErrors] = useState<Record<number, string | null>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<number, boolean>>({});
  const [pendingLikes, setPendingLikes] = useState<Record<number, boolean>>({});
  const [likeErrors, setLikeErrors] = useState<Record<number, string | null>>({});
  useEffect(() => {
    setCommentsData({}); setCommentsErrors({}); setCommentsLoading({}); setOpenComments({}); setPendingLikes({}); setLikeErrors({}); setSelectedPost(null);
  }, [postPages.pageKey]);

  const reactions = usePostReactions(postPages.pageKey, saved => {
        const update = (post: FeedPostDto) => post.id === saved.id ? reactionFields(post, saved) : post;
        setPosts(current => current.map(update));
        setSelectedPost(current => current ? update(current) : null);
    });

    const handleLikeToggle = async (postId: number) => {
    if (pendingLikes[postId]) return;
    const currentPost = posts.find((post) => post.id === postId) ?? (selectedPost?.id === postId ? selectedPost : null);
    if (!currentPost) return;
    const previous = currentPost.isLikedByMe;
    const desired = !previous;
    const applyState = (liked: boolean) => {
      const update = (post: FeedPostDto) => post.id !== postId || post.isLikedByMe === liked ? post : {
        ...post,
        isLikedByMe: liked,
        likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)),
      };
      setPosts((current) => current.map(update));
      setSelectedPost((current) => current ? update(current) : null);
    };
    setPendingLikes((current) => ({ ...current, [postId]: true }));
    setLikeErrors((current) => ({ ...current, [postId]: null }));
    applyState(desired);

    try {
      const response = await apiClient.put<{ isLiked: boolean }>(`/posts/${postId}/like`, { liked: desired });
      applyState(response.data.isLiked);
    } catch (error) {
      applyState(previous);
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
      setCommentsData((prev) => ({ ...prev, [postId]: response.data }));
    } catch (error) {
      setCommentsErrors((current) => ({ ...current, [postId]: extractApiErrorMessage(error, 'Comments could not load.') }));
    } finally {
      setCommentsLoading((current) => ({ ...current, [postId]: false }));
    }
  };

  const toggleComments = async (postId: number) => {
    const isOpen = openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }));
    if (!isOpen && !commentsData[postId]) await loadComments(postId);
  };

  const submitComment = async (postId: number, content: string) => {
    const response = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });
    setCommentsData((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), response.data] }));
    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)));
    setSelectedPost((current) => current?.id === postId ? { ...current, commentCount: current.commentCount + 1 } : current);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin accent-primary" />
      </div>
    );
  }

  return (
    <div className="club-posts-canvas home-feed-canvas mx-auto flex w-full max-w-[680px] flex-col gap-4"><header><h2 className="text-2xl font-semibold tracking-tight">Posts</h2><p className="mt-2 mb-3 text-sm text-[var(--club-theme-text-secondary)]">News, updates and conversations from the club.</p></header>
      {isOwnClubAdmin && <PostComposer home clubId={club.id} authorName={club.name} avatarUrl={club.logoUrl} onPostCreated={postPages.refresh} compact />}

      {postPages.error && <ProfilePostPagination {...postPages}/>}
      {postPages.error ? null : posts.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-[18px] border border-[color:var(--club-theme-border-subtle)] bg-[var(--club-theme-surface)] px-5 py-10 text-center shadow-[0_18px_32px_color-mix(in_srgb,_var(--color-shadow)_22%,_transparent)]">
          <Megaphone className="h-8 w-8 text-[color:var(--club-theme-text-secondary)]" />
          <div>
            <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-[color:var(--club-theme-text-primary)]">No Posts Yet</h3>
            <p className="mt-2 text-sm text-[color:var(--club-theme-text-secondary)]">{isOwnClubAdmin ? 'Share the first update using the composer above.' : 'Updates will appear here when the club shares them.'}</p>
          </div>
        </div>
      ) : (
        <FeedList
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
          compact
        />
      )}

      {!postPages.error && <ProfilePostPagination {...postPages}/>}
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
