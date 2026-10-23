import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WorkEnd, WorkStatus } from './api';

type Copy = ReturnType<typeof useJourneyCopy>;

/** Each status as people say it. On the page it is only a coloured dot before the name. */
export const statusWords: Record<WorkStatus, [en: string, ka: string]> = {
    IN_PROGRESS: ['In progress', 'მიმდინარე'],
    ON_HOLD: ['On hold', 'შეჩერებული'],
    PLANNED: ['Planned', 'დაგეგმილი'],
    FINISHED: ['Finished', 'დასრულებული'],
};
export const statusName = (copy: Copy, status: WorkStatus) => copy(...statusWords[status]);

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

const unitWords = (copy: Copy, amount: number, unit: WorkEnd['unit']) => unit === 'DAYS' ? copy(amount === 1 ? '1 day' : `${amount} days`, `${amount} დღე`)
    : unit === 'WEEKS' ? copy(amount === 1 ? '1 week' : `${amount} weeks`, `${amount} კვირა`) : copy(amount === 1 ? '1 month' : `${amount} months`, `${amount} თვე`);

/** The expected end in plain words: "31 Oct", "about 2 weeks", "possibly November", "don't know". */
export function endWords(copy: Copy, end: WorkEnd) {
    if (end.kind === 'DATE' && end.date) return shortDate(copy, day(end.date));
    if (end.kind === 'ABOUT' && end.amount && end.unit) return copy(`about ${unitWords(copy, end.amount, end.unit)}`, `დაახლ. ${unitWords(copy, end.amount, end.unit)}`);
    if (end.kind === 'POSSIBLY' && end.date) return copy(`possibly ${monthName(copy, day(end.date).getMonth())}`, `შესაძლოა ${monthName(copy, day(end.date).getMonth())}`);
    return copy('don’t know', 'არ ვიცით');
}

/** Progress as people estimate it; the percent behind each word is what the bar shows. */
export const ESTIMATES: [percent: number, en: string, ka: string][] = [
    [0, 'Not started', 'არ დაწყებულა'], [25, 'Started', 'დაწყებულია'], [50, 'Halfway', 'ნახევარზე'], [75, 'Nearly done', 'თითქმის მზადაა'], [100, 'Done', 'მზადაა'],
];
/** "Halfway" for an estimate, "60%" for an exact percent. */
export const progressWords = (copy: Copy, percent: number) => { const found = ESTIMATES.find(([value]) => value === percent); return found ? copy(found[1], found[2]) : `${percent}%`; };
