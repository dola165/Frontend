/** A list's sort as the page keeps it in the URL (`sort` and `dir`). */
export interface TableSort { by: string; descending: boolean }

/** The sort after a click on a column header: ascending first, then descending, then back to the list's own order. */
export function nextSort(current: TableSort | null, by: string): TableSort | null {
    if (current?.by !== by) return { by, descending: false };
    return current.descending ? null : { by, descending: true };
}

/** Rows in a sort's order, as a copy; without a sort they keep the order the server sent. */
export function sortRows<T>(rows: T[], sort: TableSort | null, value: (row: T, by: string) => string | number) {
    if (!sort) return rows;
    const sign = sort.descending ? -1 : 1;
    return [...rows].sort((a, b) => {
        const x = value(a, sort.by), y = value(b, sort.by);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign;
    });
}
