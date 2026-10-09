import type { FeedPostDto } from './FeedPost';
import Glove from './reaction-icons/Glove';
import Fire from './reaction-icons/Fire';
import Laugh from './reaction-icons/Laugh';
import Skull from './reaction-icons/Skull';
import RedCard from './reaction-icons/RedCard';
import Sad from './reaction-icons/Sad';

// Keep the established API keys so current releases and saved reactions remain compatible.
export const REACTIONS = [
    { type: 'LIKE', label: 'Safe hands', Icon: Glove },
    { type: 'LOVE', label: 'On fire', Icon: Fire },
    { type: 'HAHA', label: 'Dead', Icon: Laugh },
    { type: 'WOW', label: 'Brutal', Icon: Skull },
    { type: 'ANGRY', label: 'Red card', Icon: RedCard },
    { type: 'SAD', label: 'Gutted', Icon: Sad },
] as const;
export type Reaction = typeof REACTIONS[number]['type'] | 'CARE';
// Retain historical Care records in summaries and filters; the new picker has six choices.
export const ALL_REACTIONS = [...REACTIONS, { type: 'CARE', label: 'Care', Icon: Glove }] as const;
export const reactionDefinition = (type: Reaction | null) => ALL_REACTIONS.find(r => r.type === type);
export const selectedReaction = (post: FeedPostDto): Reaction | null => post.myReaction ?? (post.isLikedByMe ? 'LIKE' : null);
export const reactionFields = (post: FeedPostDto, saved: FeedPostDto): FeedPostDto => ({
    ...post, myReaction: saved.myReaction ?? null, reactionCount: saved.reactionCount ?? saved.likeCount,
    reactionCounts: saved.reactionCounts ?? {}, likeCount: saved.likeCount, isLikedByMe: saved.isLikedByMe,
});
