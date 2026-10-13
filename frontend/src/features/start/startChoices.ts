import { BriefcaseBusiness, Cone, Eye, Heart, Medal, Shield, Shirt, ShoppingBag, Trophy, Users, UsersRound, type LucideIcon } from 'lucide-react';
import type { FootballRole } from '../roles/domain';
import type { Activity, Interest } from './startApi';

/** The picture tiles of "What do you want to see?": the app's own football photos with the topic's colour and symbol. */
export interface InterestTile { id: Interest; icon: LucideIcon; color: string; photo: string; position?: string }
export const INTERESTS: InterestTile[] = [
    { id: 'CLUBS', icon: Shield, color: 'var(--gk-accent)', photo: '/preview/club-ground.png' },
    { id: 'YOUTH', icon: Users, color: 'var(--gk-violet)', photo: '/landing/after-the-whistle.png', position: '30% 60%' },
    { id: 'MATCHES', icon: Trophy, color: 'var(--gk-accent)', photo: '/football/ball-field.jpg' },
    { id: 'TOURNAMENTS', icon: Medal, color: 'var(--gk-warning)', photo: '/football/touchline.jpg' },
    { id: 'WOMENS', icon: UsersRound, color: 'var(--color-pink)', photo: '/landing/after-the-whistle.png', position: '70% 40%' },
    { id: 'JOBS', icon: BriefcaseBusiness, color: 'var(--color-purple)', photo: '/football/touchline.jpg', position: '20% 80%' },
    { id: 'STORE', icon: ShoppingBag, color: 'var(--color-cyan)', photo: '/assets/playground-ball.png' },
];
/** The likely answer, already chosen: academies are the audience, and everyone wants the local clubs and the results. */
export const DEFAULT_INTERESTS: Interest[] = ['CLUBS', 'YOUTH', 'MATCHES'];

/**
 * "What do you do in football?" only sets the start: the public football role on the profile and one pin.
 * Access to a club, a squad or a child comes from the club or the family, never from here.
 */
export interface ActivityChoice { id: Activity; icon: LucideIcon; color: string; role: FootballRole; pin: string }
export const ACTIVITIES: ActivityChoice[] = [
    { id: 'PLAY', icon: Shirt, color: 'var(--gk-accent)', role: 'PLAYER', pin: '/world/opportunities?type=trials' },
    { id: 'COACH', icon: Cone, color: 'var(--gk-info)', role: 'COACH', pin: '/world/opportunities?type=jobs' },
    { id: 'PARENT', icon: Heart, color: 'var(--color-pink)', role: 'PARENT', pin: '/world/opportunities?type=groups' },
    { id: 'WATCH', icon: Eye, color: 'var(--color-cyan)', role: 'FAN', pin: '/world/matches' },
];
