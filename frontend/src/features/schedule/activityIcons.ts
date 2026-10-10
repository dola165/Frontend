import { Bus, CalendarDays, Cone, Handshake, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { ScheduleEventType } from './api';

/** One symbol per kind of activity, used wherever a schedule entry is listed. */
export const activityIcons: Record<ScheduleEventType, LucideIcon> = { MATCH: Trophy, FRIENDLY: Handshake, TRAINING: Cone, ACTIVITY: Users, TRYOUT: UserPlus };

/**
 * Each kind of activity has its own colour. Every match shares the match colour, whether it is a league,
 * cup, tournament or friendly match; the symbol tells which (a trophy or a handshake).
 */
export const activityColors: Record<ScheduleEventType, string> = { MATCH: 'var(--gk-accent, var(--color-accent))', FRIENDLY: 'var(--gk-accent, var(--color-accent))', TRAINING: 'var(--gk-info, var(--color-info))', ACTIVITY: 'var(--gk-violet, var(--color-purple))', TRYOUT: 'var(--color-pink)' };

/** The symbols with their meaning and colour, for the legend people learn them from. */
export const activityLegend: { icon: LucideIcon; name: string; meaning: string; color: string }[] = [
    { icon: CalendarDays, name: 'Calendar', meaning: 'Schedule', color: 'var(--gk-text-2)' },
    { icon: Trophy, name: 'Match', meaning: 'League, cup or tournament', color: activityColors.MATCH },
    { icon: Handshake, name: 'Friendly', meaning: 'Friendly match', color: activityColors.FRIENDLY },
    { icon: Cone, name: 'Training', meaning: 'Practice session', color: activityColors.TRAINING },
    { icon: Users, name: 'Club event', meaning: 'Club activity', color: activityColors.ACTIVITY },
    { icon: UserPlus, name: 'Trial', meaning: 'Players trying out', color: activityColors.TRYOUT },
    { icon: Bus, name: 'Outing', meaning: 'Team trip', color: 'var(--color-cyan)' },
];
