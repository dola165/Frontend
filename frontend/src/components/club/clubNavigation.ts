import { Building2, CalendarDays, Camera, Flag, Phone, Trophy, Users } from 'lucide-react';

export type ClubNavigationTab = 'overview' | 'honours' | 'teams' | 'schedule' | 'media' | 'events' | 'contact';

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
        label: 'Overview',
        toneClassName: 'club-tone-green'
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
        id: 'contact',
        icon: Phone,
        label: 'Contact',
        toneClassName: 'club-tone-cyan'
    }
];
