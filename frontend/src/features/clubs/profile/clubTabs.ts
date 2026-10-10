import type { TabItem } from '../../../design/Tabs';

export type ClubTab = 'overview' | 'posts' | 'schedule' | 'teams' | 'people' | 'facilities' | 'media' | 'business' | 'honours' | 'contact';

export const clubTabs: TabItem<ClubTab>[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'posts', label: 'Posts' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'teams', label: 'Teams & training' },
    { id: 'people', label: 'Coaches & staff' },
    { id: 'facilities', label: 'Venues' },
    { id: 'media', label: 'Photos & videos' },
    { id: 'business', label: 'Opportunities' },
    { id: 'honours', label: 'Honours' },
    { id: 'contact', label: 'Contact' },
];

const ids = new Set<string>(clubTabs.map(tab => tab.id));

/** Old links keep working: `events` is a filter of the schedule now, `pictures`/`videos` are the media tab. */
export function clubTabFrom(value: string | null): ClubTab {
    if (value === 'pictures' || value === 'videos') return 'media';
    if (value === 'events' || value === 'calendar') return 'schedule';
    return value && ids.has(value) ? value as ClubTab : 'overview';
}

/** Filters that belong to one tab; switching tabs clears them so the next tab starts clean. */
export const tabFilters = ['programme', 'squad', 'age', 'q', 'staff', 'enquire', 'kind', 'type', 'period', 'week', 'view', 'opportunity', 'roleId', 'roleTitle'];
