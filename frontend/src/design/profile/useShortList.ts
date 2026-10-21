import { useState } from 'react';

/** A side list shows this many rows; the rest open in place and fold back. */
export const SHORT_LIST = 5;

/** The rows a side list shows now, and the "Show all" switch when there are more than `limit`. */
export function useShortList<T>(items: T[], limit = SHORT_LIST) {
    const [all, setAll] = useState(false);
    const more = items.length > limit ? { all, count: items.length, toggle: () => setAll(value => !value) } : null;
    return { shown: more && !all ? items.slice(0, limit) : items, more };
}
export type ShortListMore = ReturnType<typeof useShortList>['more'];
