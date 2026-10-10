import type { TabItem } from '../../../design/Tabs';

export type ClubTab = 'overview' | 'posts' | 'teams' | 'people' | 'facilities' | 'media' | 'business' | 'honours' | 'contact';

export const clubTabs: TabItem<ClubTab>[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'posts', label: 'Posts' },
    { id: 'teams', label: 'Teams & training' },
    { id: 'people', label: 'Coaches & staff' },
    { id: 'facilities', label: 'Venues' },
    { id: 'media', label: 'Photos & videos' },
    { id: 'business', label: 'Opportunities' },
    { id: 'honours', label: 'Honours' },
    { id: 'contact', label: 'Contact' },
];

const ids = new Set<string>(clubTabs.map(tab => tab.id));

/** Old links keep working: `pictures`/`videos` are the media tab; the schedule's fixtures are on the overview (planning is in the club workspace). */
export function clubTabFrom(value: string | null): ClubTab {
    if (value === 'pictures' || value === 'videos') return 'media';
    return value && ids.has(value) ? value as ClubTab : 'overview';
}

/** Filters that belong to one tab; switching tabs clears them so the next tab starts clean. */
export const tabFilters = ['programme', 'squad', 'age', 'q', 'staff', 'enquire', 'kind', 'type', 'period', 'week', 'view', 'opportunity', 'roleId', 'roleTitle'];

/** Where another club's staff arrange a match against this club. The form lives in World. */
export const proposeMatchPath = (clubId: number) => `/world/matches/arrange?opponent=${clubId}`;
