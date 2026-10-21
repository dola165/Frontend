import type { LucideIcon } from 'lucide-react';

/** A group of results shown together under one header (people at one club, referees who reach your ground). */
export interface ResultGroup {
    key: string;
    label: string;
    /** The pin its results share, so the header can choose it on the map. */ pin?: string;
    crest?: { src?: string | null; name: string; round?: boolean };
    /** Groups with a rank come first, lowest first, and never join the rest; then bigger groups, then list order. */ rank?: number;
    /** One quiet line after the count ("U10 · Mtskheta Riverside Field", "10:30–15:00"). */ detail?: string;
    /** The group's symbol (a trophy for a tournament) and its soft tint. */ icon?: LucideIcon; tint?: 'accent' | 'info' | 'violet' | 'warning' | 'danger';
    /** One way on from the header ("Table ›"): a page, or a drawer opened in its place. */ action?: { label: string; to: string; peek?: string };
    /** What an always-shown group says when it is empty ("Nothing needs you"). */ empty?: string;
}

export interface ArrangedGroup<T> { group: ResultGroup; items: T[] }

/**
 * Orders results into their groups. Ranked groups come first, then the others by size and by where their first
 * result was; within a group the list keeps its own order (the sort). With `rest`, groups of a single result join one
 * last group under that name, so a list of many places never becomes a list of headers. `always` groups are shown even
 * when empty (lanes), and `describe` fills a group's detail from its results.
 */
export function arrangeGroups<T>(items: T[], of: (item: T) => ResultGroup, rest?: string,
    { always = [], describe }: { always?: ResultGroup[]; describe?: (items: T[]) => string | undefined } = {}): ArrangedGroup<T>[] {
    const found = new Map<string, { group: ResultGroup; items: T[]; first: number }>(always.map(group => [group.key, { group, items: [], first: -1 }]));
    items.forEach((item, index) => {
        const group = of(item), entry = found.get(group.key);
        if (entry) { entry.items.push(item); if (entry.first < 0) entry.first = index; } else found.set(group.key, { group, items: [item], first: index });
    });
    let entries = [...found.values()];
    const loose = rest ? entries.filter(entry => entry.items.length === 1 && entry.group.rank == null) : [];
    if (loose.length > 1) {
        entries = entries.filter(entry => !loose.includes(entry));
        entries.push({ group: { key: '~rest', label: rest!, rank: Number.MAX_SAFE_INTEGER }, items: loose.sort((a, b) => a.first - b.first).flatMap(entry => entry.items), first: loose[0].first });
    }
    entries.sort((a, b) => (a.group.rank ?? 1e9) - (b.group.rank ?? 1e9) || b.items.length - a.items.length || a.first - b.first);
    return entries.map(({ group, items: grouped }) => ({ group: describe && grouped.length ? { ...group, detail: describe(grouped) ?? group.detail } : group, items: grouped }));
}
