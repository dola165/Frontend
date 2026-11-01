import { BriefcaseBusiness, Cone, Lightbulb, Medal, Newspaper, Search, ShoppingBag, Trophy, User, UserPlus, type LucideIcon } from 'lucide-react';
import { activityColors } from '../schedule/activityIcons';

/** The three facts every post carries, set by the kind of post (never by the poster), and why the feed shows it. */
export type PostTopic = 'RESULT' | 'FIXTURE' | 'TRAINING' | 'TOURNAMENT' | 'TRIAL' | 'JOB' | 'STORE' | 'CLUB_NEWS' | 'ADVICE' | 'PLAYER_SEARCH' | 'PERSONAL';
export type PostReach = 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'FOLLOWERS';
export interface PostPlace { city: string; latitude?: number | null; longitude?: number | null }
export interface FeedWhy {
    kind: 'OWN' | 'LINKED' | 'FOLLOWING' | 'NEAR_TOPIC' | 'NEAR' | 'NATIONAL' | 'POPULAR';
    /** Its place in Discover's order (1 your football … 6 near on other topics); the next page starts after it. */
    tier?: number | null;
    name?: string | null;
    place?: string | null;
    distanceKm?: number | null;
    topic?: string | null;
    reactions?: number | null;
}

/**
 * A post the club's records wrote (step 7), as its record stands when read: the record's own state and the one thing
 * to do now (`action`, gone once the record no longer offers it), the line staff added, and whether the reader may
 * add to it or hide it. Amounts are what the club reported. Children are never named.
 */
export interface RecordPost {
    kind: 'TRIAL' | 'SQUAD' | 'JOB' | 'PROJECT' | 'TOURNAMENT' | 'CLUB' | 'RESULTS' | 'WEEKEND';
    moment: string;
    recordId: number;
    title?: string | null;
    state?: 'OPEN' | 'CLOSED' | 'CANCELLED' | 'FILLED' | 'EXPIRED' | 'PAUSED' | 'SCHEDULED' | 'ENDED' | 'DONE' | null;
    action?: 'APPLY' | 'ASK' | 'VIEW_JOB' | 'SUPPORT' | 'ENTER' | 'FOLLOW' | null;
    startsAt?: string | null;
    endsAt?: string | null;
    placeName?: string | null;
    ageGroup?: string | null;
    gender?: string | null;
    ages?: string[] | null;
    hours?: string | null;
    reportedAmount?: string | null;
    goalAmount?: string | null;
    currency?: string | null;
    winner?: string | null;
    following?: boolean | null;
    line?: string | null;
    hidden: boolean;
    canChange: boolean;
    version: number;
    /** For those who may change it: its photos in the card's order, so adding one keeps the others. */
    photoIds?: number[] | null;
    matches?: RecordMatch[] | null;
}

export interface RecordMatch {
    eventId: number; homeClub: string | null; awayClub: string | null;
    homeCrest: string | null; awayCrest: string | null; homeSquad: string | null; awaySquad: string | null;
    startsAt: string; state: string; homeScore: number | null; awayScore: number | null;
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
