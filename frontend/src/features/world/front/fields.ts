import { Briefcase, CalendarCheck, ClipboardList, Flag, GraduationCap, HandCoins, Handshake, HandHeart, HeartPulse, MapPin, Radio, Shield, ShieldPlus, Sprout, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { activityColors } from '../../schedule/activityIcons';

/** Everything a person can put on World's front page. */
export type FieldId = 'matches' | 'events' | 'refereeNeeded' | 'competitions' | 'liveCompetitions' | 'results' | 'arrangements'
    | 'people' | 'referees' | 'specialists'
    | 'clubs' | 'academies' | 'openClubs' | 'groups' | 'venues'
    | 'trials' | 'jobs' | 'coachingJobs' | 'staffJobs' | 'volunteering' | 'campaigns';

export type FieldGroup = 'Matches' | 'People' | 'Clubs and places' | 'Opportunities';
export const FIELD_GROUPS: FieldGroup[] = ['Matches', 'People', 'Clubs and places', 'Opportunities'];

export interface FieldInfo {
    id: FieldId; title: string; description: string; group: FieldGroup;
    /** Lists fit beside the map; cards need the page's width. */ shape: 'list' | 'cards';
    icon: LucideIcon; color?: string; photo?: string;
}

export const FIELDS: FieldInfo[] = [
    { id: 'matches', title: 'Teams looking for a match', description: 'Squads near you that need an opponent for a date.', group: 'Matches', shape: 'list', icon: Handshake, color: activityColors.FRIENDLY, photo: '/football/touchline.jpg' },
    { id: 'events', title: 'Matches near you', description: 'Published matches and competitions in the next 10 days.', group: 'Matches', shape: 'list', icon: Trophy, color: activityColors.MATCH, photo: '/football/ball-field.jpg' },
    { id: 'refereeNeeded', title: 'Matches that need a referee', description: 'Arranged matches still looking for an official.', group: 'Matches', shape: 'list', icon: Flag, color: activityColors.MATCH, photo: '/venue-demo/pitch-sun.jpg' },
    { id: 'competitions', title: 'Open for entries', description: 'Leagues and cups you can enter a squad in now.', group: 'Matches', shape: 'list', icon: Trophy, color: activityColors.MATCH, photo: '/venue-demo/pitch-aerial.jpg' },
    { id: 'liveCompetitions', title: 'Competitions on now', description: 'Leagues and cups being played, to follow tables and fixtures.', group: 'Matches', shape: 'list', icon: Radio, color: activityColors.MATCH, photo: '/venue-demo/pitch-aerial.jpg' },
    { id: 'results', title: 'Latest results', description: 'Recorded scores, to follow teams and form.', group: 'Matches', shape: 'list', icon: ClipboardList, photo: '/venue-demo/pitch-indoor.jpg' },
    { id: 'arrangements', title: 'Your match arrangements', description: 'Friendlies you are arranging: opponent, pitch and referee.', group: 'Matches', shape: 'list', icon: CalendarCheck, color: activityColors.FRIENDLY, photo: '/football/touchline.jpg' },
    { id: 'people', title: 'People to know', description: 'Coaches, referees, agents and specialists near you.', group: 'People', shape: 'list', icon: Users },
    { id: 'referees', title: 'Referees', description: 'Officials who take matches, with formats and fees.', group: 'People', shape: 'list', icon: Flag },
    { id: 'specialists', title: 'Specialists', description: 'Physios, fitness, nutrition, psychology and video analysis.', group: 'People', shape: 'list', icon: HeartPulse },
    { id: 'clubs', title: 'Clubs near you', description: 'Clubs around your area, nearest first.', group: 'Clubs and places', shape: 'cards', icon: Shield },
    { id: 'academies', title: 'Academies', description: 'Academies around your area.', group: 'Clubs and places', shape: 'cards', icon: GraduationCap },
    { id: 'openClubs', title: 'Clubs taking new players', description: 'Clubs with open trials or open to applications.', group: 'Clubs and places', shape: 'cards', icon: ShieldPlus },
    { id: 'groups', title: 'Places to train', description: 'Training groups with places, for your child’s age when one is chosen.', group: 'Clubs and places', shape: 'list', icon: Sprout, color: activityColors.TRAINING, photo: '/football/ball-field.jpg' },
    { id: 'venues', title: 'Pitches to hire', description: 'Pitches and halls near you, nearest first, with prices.', group: 'Clubs and places', shape: 'list', icon: MapPin, photo: '/venue-demo/pitch-day.jpg' },
    { id: 'trials', title: 'Open trials', description: 'Trials clubs are running, by age group and position.', group: 'Opportunities', shape: 'list', icon: UserPlus, color: activityColors.TRYOUT, photo: '/football/ball-field.jpg' },
    { id: 'jobs', title: 'Jobs and volunteering', description: 'Every open role at clubs: paid, volunteer and match day.', group: 'Opportunities', shape: 'list', icon: Briefcase, photo: '/venue-demo/pitch-sun.jpg' },
    { id: 'coachingJobs', title: 'Coaching jobs', description: 'Only the coaching roles clubs are hiring for.', group: 'Opportunities', shape: 'list', icon: Briefcase, photo: '/venue-demo/pitch-sun.jpg' },
    { id: 'staffJobs', title: 'Jobs off the pitch', description: 'Medical, media, operations and administration roles.', group: 'Opportunities', shape: 'list', icon: Briefcase, photo: '/venue-demo/pitch-indoor.jpg' },
    { id: 'volunteering', title: 'Volunteering', description: 'Ways to help a club: match days, events and more.', group: 'Opportunities', shape: 'list', icon: HandHeart, photo: '/venue-demo/pitch-day.jpg' },
    { id: 'campaigns', title: 'Support a club', description: 'Fundraisers clubs are running, with what the money is for.', group: 'Opportunities', shape: 'list', icon: HandCoins, photo: '/venue-demo/pitch-sun.jpg' },
];
export const fieldInfo = (id: FieldId) => FIELDS.find(field => field.id === id)!;
