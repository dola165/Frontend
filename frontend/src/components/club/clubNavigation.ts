import { Briefcase, Building2, CalendarDays, Camera, Flag, Phone, Trophy, Users, UsersRound, Video, Warehouse } from 'lucide-react';

export type ClubNavigationTab = 'overview' | 'people' | 'facilities' | 'honours' | 'teams' | 'schedule' | 'pictures' | 'videos' | 'events' | 'business' | 'contact';

export type ClubNavigationAccent = 'blue' | 'violet';

export interface ClubNavigationClubSummary {
    honours?: Array<unknown>;
    opportunities?: Array<unknown>;
}

export interface ClubNavigationItem {
    id: ClubNavigationTab;
    label: string;
    icon: typeof Building2;
    badge?: (club: ClubNavigationClubSummary) => number | null;
    toneClassName: string;
    /** Inactive-state accent tint: 'blue' for the media tabs, 'violet' for the jobs tab. */
    accent?: ClubNavigationAccent;
    /** Layout section: media tabs sit between the main group and the side (contact) group. */
    section?: 'main' | 'media' | 'side';
}

export const clubNavigationItems: ClubNavigationItem[] = [
    {
        id: 'overview',
        icon: Building2,
        label: 'Our club',
        toneClassName: 'club-tone-green'
    },
    {
        id: 'people',
        icon: UsersRound,
        label: 'Management',
        toneClassName: 'club-tone-green'
    },
    {
        id: 'facilities',
        icon: Warehouse,
        label: 'Facilities',
        toneClassName: 'club-tone-cyan'
    },
    {
        id: 'honours',
        icon: Trophy,
        label: 'Honours',
        badge: (club) => club.honours?.length ?? null,
        toneClassName: 'club-tone-blue'
    },
    {
        id: 'teams',
        icon: Users,
        label: 'Teams',
        toneClassName: 'club-tone-cyan'
    },
    {
        id: 'schedule',
        icon: CalendarDays,
        label: 'Schedule',
        toneClassName: 'club-tone-blue'
    },
    {
        id: 'pictures',
        icon: Camera,
        label: 'Pictures',
        toneClassName: 'club-tone-green',
        accent: 'blue',
        section: 'media'
    },
    {
        id: 'videos',
        icon: Video,
        label: 'Videos',
        toneClassName: 'club-tone-green',
        accent: 'blue',
        section: 'media'
    },
    {
        id: 'events',
        icon: Flag,
        label: 'Events',
        toneClassName: 'club-tone-blue'
    },
    {
        id: 'business',
        icon: Briefcase,
        label: 'Opportunities',
        toneClassName: 'club-tone-green',
        accent: 'violet'
    },
    {
        id: 'contact',
        icon: Phone,
        label: 'Contact',
        toneClassName: 'club-tone-cyan',
        section: 'side'
    }
];
