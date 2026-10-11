/** A group of results shown together under one header (people at one club, referees who reach your ground). */
export interface ResultGroup {
    key: string;
    label: string;
    /** The pin its results share, so the header can choose it on the map. */ pin?: string;
    crest?: { src?: string | null; name: string; round?: boolean };
    /** Groups with a rank come first, lowest first, and never join the rest; then bigger groups, then list order. */ rank?: number;
}

export interface ArrangedGroup<T> { group: ResultGroup; items: T[] }

/**
 * Orders results into their groups. Ranked groups come first, then the others by size and by where their first
 * result was; within a group the list keeps its own order (the sort). With `rest`, groups of a single result join one
 * last group under that name, so a list of many places never becomes a list of headers.
 */
export function arrangeGroups<T>(items: T[], of: (item: T) => ResultGroup, rest?: string): ArrangedGroup<T>[] {
    const found = new Map<string, { group: ResultGroup; items: T[]; first: number }>();
    items.forEach((item, index) => {
        const group = of(item), entry = found.get(group.key);
        if (entry) entry.items.push(item); else found.set(group.key, { group, items: [item], first: index });
    });
    let entries = [...found.values()];
    const loose = rest ? entries.filter(entry => entry.items.length === 1 && entry.group.rank == null) : [];
    if (loose.length > 1) {
        entries = entries.filter(entry => !loose.includes(entry));
        entries.push({ group: { key: '~rest', label: rest!, rank: Number.MAX_SAFE_INTEGER }, items: loose.sort((a, b) => a.first - b.first).flatMap(entry => entry.items), first: loose[0].first });
    }
    entries.sort((a, b) => (a.group.rank ?? 1e9) - (b.group.rank ?? 1e9) || b.items.length - a.items.length || a.first - b.first);
    return entries.map(({ group, items: grouped }) => ({ group, items: grouped }));
}
