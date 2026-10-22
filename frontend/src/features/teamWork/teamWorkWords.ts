import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WorkStatus } from './api';

type Copy = ReturnType<typeof useJourneyCopy>;

/** Each status as people say it, with its dot: one bright thing (in progress), the rest quieter. */
export const statusWords: Record<WorkStatus, [en: string, ka: string]> = {
    IN_PROGRESS: ['In progress', 'მიმდინარე'],
    ON_HOLD: ['On hold', 'შეჩერებული'],
    PLANNED: ['Planned', 'დაგეგმილი'],
    FINISHED: ['Finished', 'დასრულებული'],
};
export const statusName = (copy: Copy, status: WorkStatus) => copy(...statusWords[status]);

const DAY = 24 * 3600 * 1000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "now", "today", "yesterday", "3 days ago", then the date: how long ago something was touched. */
export function ago(copy: Copy, value: string, now = new Date()) {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return '';
    if (now.getTime() - at.getTime() < 3600 * 1000) return copy('now', 'ახლა');
    const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
    if (days <= 0) return copy('today', 'დღეს');
    if (days === 1) return copy('yesterday', 'გუშინ');
    if (days < 7) return copy(`${days} days ago`, `${days} დღის წინ`);
    if (days < 28) { const weeks = Math.round(days / 7); return copy(weeks === 1 ? 'a week ago' : `${weeks} weeks ago`, `${weeks} კვირის წინ`); }
    return at.toLocaleDateString(copy('en-GB', 'ka-GE'), { day: 'numeric', month: 'short' });
}
