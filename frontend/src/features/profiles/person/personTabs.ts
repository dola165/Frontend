import type { TabItem } from '../../../design/Tabs';

export type PersonTab = 'overview' | 'posts' | 'career' | 'media' | 'schedule';

/** Tabs a viewer sees: career for football professionals, the schedule only on your own profile, and only the overview of a private profile. */
export function personTabs({ own, hidden, career }: { own: boolean; hidden: boolean; career: boolean }): TabItem<PersonTab>[] {
    if (hidden) return [{ id: 'overview', label: 'Overview' }];
    return [
        { id: 'overview', label: 'Overview' },
        { id: 'posts', label: 'Posts' },
        ...(career ? [{ id: 'career' as const, label: 'Career' }] : []),
        { id: 'media', label: 'Photos & videos' },
        ...(own ? [{ id: 'schedule' as const, label: 'Schedule' }] : []),
    ];
}

/** Older links keep working: `about` is the overview, `stats` the career, `images`/`videos` the media tab. */
export function personTabFrom(value: string | null, available: TabItem<PersonTab>[]): PersonTab {
    const mapped = value === 'about' ? 'overview' : value === 'stats' || value === 'portfolio' ? 'career'
        : value === 'images' || value === 'videos' ? 'media' : value === 'feed' || value === 'timeline' ? 'posts' : value;
    return available.find(tab => tab.id === mapped)?.id ?? 'overview';
}
