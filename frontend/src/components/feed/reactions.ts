import type { FeedPostDto } from './FeedPost';

export const REACTIONS = [
    { type: 'LIKE', label: 'Like', emoji: '👍' },
    { type: 'LOVE', label: 'Love', emoji: '❤️' },
    { type: 'CARE', label: 'Care', emoji: '🥰' },
    { type: 'HAHA', label: 'Haha', emoji: '😆' },
    { type: 'WOW', label: 'Wow', emoji: '😮' },
    { type: 'SAD', label: 'Sad', emoji: '😢' },
    { type: 'ANGRY', label: 'Angry', emoji: '😡' },
] as const;
export type Reaction = typeof REACTIONS[number]['type'];
export const selectedReaction = (post: FeedPostDto): Reaction | null => post.myReaction ?? (post.isLikedByMe ? 'LIKE' : null);
export const reactionFields = (post: FeedPostDto, saved: FeedPostDto): FeedPostDto => ({
    ...post, myReaction: saved.myReaction ?? null, reactionCount: saved.reactionCount ?? saved.likeCount,
    reactionCounts: saved.reactionCounts ?? {}, likeCount: saved.likeCount, isLikedByMe: saved.isLikedByMe,
});
