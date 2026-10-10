/** Calendar arithmetic in local time. Weeks start on Monday. */
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const startOfWeek = (date: Date) => { const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()); return addDays(day, -((day.getDay() + 6) % 7)); };
export const weekDays = (date: Date) => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index));
/** The six weeks shown for a month, from the Monday on or before the first. */
export const monthGrid = (date: Date) => { const first = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)); return Array.from({ length: 42 }, (_, index) => addDays(first, index)); };
/** `YYYY-MM-DD` in local time, for addresses. */
export const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const fromIsoDay = (value: string | null) => { const [y, m, d] = (value ?? '').split('-').map(Number); return y && m && d ? new Date(y, m - 1, d) : null; };
