import { Briefcase, CalendarCheck, ClipboardList, GraduationCap, Handshake, HeartPulse, MapPin, Shield, Trophy, UserPlus, Users, Flag, type LucideIcon } from 'lucide-react';
import { activityColors } from '../../schedule/activityIcons';
import type { WorldAudience } from './audience';

/** Everything a person can put on World's front page. */
export type FieldId = 'matches' | 'events' | 'competitions' | 'results' | 'arrangements' | 'referees' | 'people' | 'specialists'
    | 'clubs' | 'academies' | 'venues' | 'jobs' | 'coachingJobs' | 'trials';

export interface FieldInfo {
    id: FieldId; title: string; description: string; group: 'Matches' | 'People' | 'Clubs and places' | 'Opportunities';
    /** Lists fit beside the map; cards need the page's width. */ shape: 'list' | 'cards';
    icon: LucideIcon; color?: string; photo?: string;
}

export const FIELDS: FieldInfo[] = [
    { id: 'matches', title: 'Teams looking for a match', description: 'Squads near you that need an opponent for a date.', group: 'Matches', shape: 'list', icon: Handshake, color: activityColors.FRIENDLY, photo: '/football/touchline.jpg' },
    { id: 'events', title: 'Matches near you', description: 'Published matches and competitions in the next 10 days.', group: 'Matches', shape: 'list', icon: Trophy, color: activityColors.MATCH, photo: '/football/ball-field.jpg' },
    { id: 'competitions', title: 'Open for entries', description: 'Leagues and cups you can enter a squad in now.', group: 'Matches', shape: 'list', icon: Trophy, color: activityColors.MATCH, photo: '/venue-demo/pitch-aerial.jpg' },
    { id: 'results', title: 'Latest results', description: 'Recorded scores, to follow opponents and form.', group: 'Matches', shape: 'list', icon: ClipboardList, photo: '/venue-demo/pitch-indoor.jpg' },
    { id: 'arrangements', title: 'Your match arrangements', description: 'Friendlies you are arranging: opponent, pitch and referee.', group: 'Matches', shape: 'list', icon: CalendarCheck, color: activityColors.FRIENDLY, photo: '/football/touchline.jpg' },
    { id: 'referees', title: 'Referees', description: 'Officials who take matches, with formats and fees.', group: 'People', shape: 'list', icon: Flag },
    { id: 'people', title: 'People to know', description: 'Coaches, referees, agents and specialists near you.', group: 'People', shape: 'list', icon: Users },
    { id: 'specialists', title: 'Specialists', description: 'Physios, fitness, nutrition, psychology and video analysis.', group: 'People', shape: 'list', icon: HeartPulse },
    { id: 'clubs', title: 'Clubs near you', description: 'Clubs around your area, nearest first.', group: 'Clubs and places', shape: 'cards', icon: Shield },
    { id: 'academies', title: 'Academies', description: 'Academies around your area, for partners, players and staff.', group: 'Clubs and places', shape: 'cards', icon: GraduationCap },
    { id: 'venues', title: 'Pitches to hire', description: 'Pitches and halls near you, nearest first, with prices.', group: 'Clubs and places', shape: 'list', icon: MapPin, photo: '/venue-demo/pitch-day.jpg' },
    { id: 'jobs', title: 'Jobs and volunteering', description: 'Open roles at clubs: paid, volunteer and match day.', group: 'Opportunities', shape: 'list', icon: Briefcase, photo: '/venue-demo/pitch-sun.jpg' },
    { id: 'coachingJobs', title: 'Coaching jobs', description: 'Only the coaching roles clubs are hiring for.', group: 'Opportunities', shape: 'list', icon: Briefcase, photo: '/venue-demo/pitch-sun.jpg' },
    { id: 'trials', title: 'Open trials', description: 'Trials clubs are running, by age group and position.', group: 'Opportunities', shape: 'list', icon: UserPlus, color: activityColors.TRYOUT, photo: '/football/ball-field.jpg' },
];
export const fieldInfo = (id: FieldId) => FIELDS.find(field => field.id === id)!;

/** What sits beside the map, and the fields that follow below it, in order. */
export interface OverviewLayout { side: FieldId; fields: FieldId[] }

/** Starting points for the many kinds of coach; each is then the person's to change. */
export const PRESETS: { id: string; label: string; layout: OverviewLayout }[] = [
    { id: 'head-coach', label: 'Head coach', layout: { side: 'matches', fields: ['events', 'competitions', 'clubs', 'venues', 'people'] } },
    { id: 'team-manager', label: 'Team manager', layout: { side: 'arrangements', fields: ['matches', 'referees', 'venues', 'competitions'] } },
    { id: 'fitness-coach', label: 'Fitness coach', layout: { side: 'venues', fields: ['specialists', 'coachingJobs', 'events', 'people'] } },
    { id: 'goalkeeper-coach', label: 'Goalkeeper coach', layout: { side: 'trials', fields: ['coachingJobs', 'events', 'specialists', 'people'] } },
    { id: 'analyst', label: 'Analyst or scout', layout: { side: 'results', fields: ['events', 'trials', 'competitions', 'academies'] } },
    { id: 'academy-director', label: 'Academy director', layout: { side: 'competitions', fields: ['academies', 'coachingJobs', 'trials', 'venues', 'clubs'] } },
];

/** Five or six fields to start with, by audience. */
export const DEFAULT_LAYOUT: Record<WorldAudience, OverviewLayout> = {
    coach: PRESETS[0].layout,
    parent: { side: 'trials', fields: ['clubs', 'academies', 'events', 'venues'] },
    member: { side: 'events', fields: ['clubs', 'jobs', 'competitions', 'people'] },
};
