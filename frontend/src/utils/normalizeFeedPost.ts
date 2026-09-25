import type { FeedPostDto } from '../components/feed/FeedPost';

// Older API deployments omit Kotlin's default zero/false values.
export const normalizeFeedPost = (post: FeedPostDto): FeedPostDto => ({
  ...post,
  likeCount: post.likeCount ?? 0,
  commentCount: post.commentCount ?? 0,
  isLikedByMe: post.isLikedByMe ?? false,
});
