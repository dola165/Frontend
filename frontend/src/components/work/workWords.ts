import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';

export type Copy = ReturnType<typeof useJourneyCopy>;

const DAY = 24 * 3600 * 1000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const MONTHS_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const MONTHS_KA_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_EN_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A plain day (yyyy-mm-dd) as a local date at noon, so time zones never move it. */
export const day = (value: string) => new Date(`${value}T12:00:00`);
export const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** "20 Oct". */
export const shortDate = (copy: Copy, date: Date) => `${date.getDate()} ${copy(MONTHS_EN[date.getMonth()], MONTHS_KA[date.getMonth()])}`;
export const monthName = (copy: Copy, month: number) => copy(MONTHS_EN_LONG[month], MONTHS_KA_LONG[month]);

/** Who made a change: the person, or "Dola for Luka" when Agent Dola made it for them after they approved its preview. */
export const madeBy = (copy: Copy, name: string | null | undefined, byDola?: boolean) => {
    const who = name ?? copy('Someone', 'ვიღაც');
    return byDola ? copy(`Dola for ${who}`, `დოლა — ${who}`) : who;
};

/** "now", "today", "yesterday", "3 days ago", then the date: how long ago something was touched. */
export function ago(copy: Copy, value: string, now = new Date()) {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return '';
    const minutes = (now.getTime() - at.getTime()) / 60000;
    if (minutes < 60) return copy('now', 'ახლა');
    const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
    if (days <= 0) { const hours = Math.max(1, Math.round(minutes / 60)); return copy(`${hours} h ago`, `${hours} სთ-ის წინ`); }
    if (days === 1) return copy('yesterday', 'გუშინ');
    if (days < 7) return copy(`${days} days ago`, `${days} დღის წინ`);
    if (days < 28) { const weeks = Math.round(days / 7); return copy(weeks === 1 ? 'a week ago' : `${weeks} weeks ago`, `${weeks} კვირის წინ`); }
    return shortDate(copy, at);
}

/** A file's own name (or the last part of its address). */
export const fileName = (media: { name?: string | null; url: string }, fallback: string) => media.name ?? media.url.split('/').pop() ?? fallback;
