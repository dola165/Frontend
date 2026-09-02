import { Briefcase, Building2, CalendarDays, Camera, Flag, Phone, Trophy, Users, UsersRound, Warehouse } from 'lucide-react';

export type ClubNavigationTab = 'overview' | 'people' | 'facilities' | 'honours' | 'teams' | 'schedule' | 'media' | 'events' | 'business' | 'contact';

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
        label: 'People',
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
        id: 'media',
        icon: Camera,
        label: 'Media',
        toneClassName: 'club-tone-green'
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
        label: 'Business',
        toneClassName: 'club-tone-green'
    },
    {
        id: 'contact',
        icon: Phone,
        label: 'Contact',
        toneClassName: 'club-tone-cyan'
    }
];
