import { Briefcase, Building2, CalendarDays, Camera, Phone, Users, UsersRound } from 'lucide-react';

export type ClubNavigationTab = 'overview' | 'people' | 'teams' | 'schedule' | 'media' | 'business' | 'contact';

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
        toneClassName: 'club-tone-green',
        accent: 'blue',
        section: 'media'
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

export const normalizeClubNavigationTab = (value: string | null): ClubNavigationTab => {
    if (value === 'pictures' || value === 'videos') return 'media';
    if (value === 'events') return 'schedule';
    if (value === 'honours') return 'overview';
    return clubNavigationItems.some((item) => item.id === value)
        ? value as ClubNavigationTab
        : 'overview';
};
