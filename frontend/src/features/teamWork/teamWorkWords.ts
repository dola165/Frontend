import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Priority, WorkEnd, WorkStatus } from './api';
import { day, monthName, shortDate } from '../../components/work/workWords';

type Copy = ReturnType<typeof useJourneyCopy>;

/** Each status as people say it. On the page it is only a coloured dot before the name. */
export const statusWords: Record<WorkStatus, [en: string, ka: string]> = {
    PLANNED: ['Planned', 'დაგეგმილი'],
    IN_PROGRESS: ['In progress', 'მიმდინარე'],
    NEEDS_LOOK: ['Needs your look', 'სანახავია'],
    ACCEPTED: ['Accepted', 'მიღებულია'],
    LIVE: ['Live', 'ლაივზეა'],
    BLOCKED: ['Blocked', 'დაბლოკილია'],
    CANCELLED: ['Cancelled', 'გაუქმებულია'],
};
export const statusName = (copy: Copy, status: WorkStatus) => copy(...statusWords[status]);

export const priorityWords: Record<Priority, [en: string, ka: string]> = { NOW: ['Now', 'ახლა'], NEXT: ['Next', 'შემდეგ'], LATER: ['Later', 'მოგვიანებით'] };
export const priorityName = (copy: Copy, priority: Priority) => copy(...priorityWords[priority]);

export { ago, day, isoDay, madeBy, monthName, shortDate } from '../../components/work/workWords';

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
/** "Halfway" for an estimate, "60%" for an exact percent, nothing when there is none. */
export const progressWords = (copy: Copy, percent: number | null) => {
    if (percent == null) return '';
    const found = ESTIMATES.find(([value]) => value === percent);
    return found ? copy(found[1], found[2]) : `${percent}%`;
};
