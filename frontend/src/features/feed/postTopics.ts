import { BriefcaseBusiness, Cone, Lightbulb, Medal, Newspaper, Search, ShoppingBag, Trophy, User, UserPlus, type LucideIcon } from 'lucide-react';
import { activityColors } from '../schedule/activityIcons';

/** The three facts every post carries, set by the kind of post (never by the poster), and why the feed shows it. */
export type PostTopic = 'RESULT' | 'FIXTURE' | 'TRAINING' | 'TOURNAMENT' | 'TRIAL' | 'JOB' | 'STORE' | 'CLUB_NEWS' | 'ADVICE' | 'PLAYER_SEARCH' | 'PERSONAL';
export type PostReach = 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'FOLLOWERS';
export interface PostPlace { city: string; latitude?: number | null; longitude?: number | null }
export interface FeedWhy {
    kind: 'OWN' | 'LINKED' | 'FOLLOWING' | 'NEAR_TOPIC' | 'NEAR' | 'NATIONAL' | 'POPULAR';
    name?: string | null;
    place?: string | null;
    distanceKm?: number | null;
    topic?: string | null;
    reactions?: number | null;
}

/** One symbol and colour per topic, the activity ones where a topic is an activity (matches green, training blue, trials pink). */
export const postTopics: Record<PostTopic, { icon: LucideIcon; color: string }> = {
    RESULT: { icon: Trophy, color: activityColors.MATCH },
    FIXTURE: { icon: Trophy, color: activityColors.MATCH },
    TOURNAMENT: { icon: Medal, color: activityColors.MATCH },
    TRAINING: { icon: Cone, color: activityColors.TRAINING },
    TRIAL: { icon: UserPlus, color: activityColors.TRYOUT },
    JOB: { icon: BriefcaseBusiness, color: 'var(--color-purple)' },
    STORE: { icon: ShoppingBag, color: 'var(--color-cyan)' },
    CLUB_NEWS: { icon: Newspaper, color: activityColors.ACTIVITY },
    ADVICE: { icon: Lightbulb, color: 'var(--color-warning)' },
    PLAYER_SEARCH: { icon: Search, color: 'var(--color-info)' },
    PERSONAL: { icon: User, color: 'var(--color-secondary)' },
};
export const isPostTopic = (value: unknown): value is PostTopic => typeof value === 'string' && Object.hasOwn(postTopics, value);
