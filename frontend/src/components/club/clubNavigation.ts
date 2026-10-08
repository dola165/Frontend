import { HeartHandshake, Trophy, Building2, CalendarDays, Megaphone, Camera, Phone, Users, UsersRound } from 'lucide-react';

export type ClubNavigationTab = 'overview' | 'posts' | 'facilities' | 'honours' | 'people' | 'teams' | 'schedule' | 'events' | 'media' | 'business' | 'contact' | 'store' | 'campaigns';

export type ClubNavigationAccent = 'blue' | 'violet' | 'amber';

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
        label: 'Overview',
        toneClassName: 'club-tone-green'
    },
    { id: 'posts', icon: Megaphone, label: 'Posts', toneClassName: 'club-tone-green' },
    { id: 'facilities', icon: Building2, label: 'Venues & facilities', toneClassName: 'club-tone-cyan' },
    {
        id: 'people',
        icon: UsersRound,
        label: 'Coaches & staff',
        toneClassName: 'club-tone-green'
    },
    {
        id: 'teams',
        icon: Users,
        label: 'Training & teams',
        toneClassName: 'club-tone-cyan'
    },
    {
        id: 'schedule',
        icon: CalendarDays,
        label: 'Schedule',
        toneClassName: 'club-tone-blue'
    },
    {
        id: 'events',
        icon: Megaphone,
        label: 'Events',
        toneClassName: 'club-tone-amber'
    },
    {
        id: 'honours',
        icon: Trophy,
        label: 'Honours',
        toneClassName: 'club-tone-amber'
    },
    {
        id: 'media',
        icon: Camera,
        label: 'Photos & videos',
        toneClassName: 'club-tone-green',
        accent: 'blue',
        section: 'media'
    },
    {
        id: 'business',
        icon: HeartHandshake,
        label: 'Opportunities',
        toneClassName: 'club-tone-violet',
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

export const normalizeClubNavigationTab = (value: string | null): ClubNavigationTab => {
    if (value === 'pictures' || value === 'videos') return 'media';
    return clubNavigationItems.some((item) => item.id === value)
        ? value as ClubNavigationTab
        : 'overview';
};
