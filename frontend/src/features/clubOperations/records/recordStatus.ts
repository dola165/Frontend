import type { BadgeTone } from '../../../design/primitives';
import type { OperationRecord } from '../api';

const done = new Set(['COMPLETED', 'APPROVED', 'PUBLISHED', 'GRANTED', 'ARRIVED', 'COLLECTED', 'CONFIRMED', 'PAID', 'RETURNED', 'CLEARED', 'READY', 'ACTIVE', 'RECORDED', 'CLUB_CHECKED', 'BOARDED']);
const waiting = new Set(['PENDING', 'SUBMITTED', 'INVITED', 'DUE', 'PLANNED', 'ASSIGNED', 'DRAFT', 'OPEN', 'REQUESTED', 'EXPECTED', 'ISSUED']);
const stopped = new Set(['DECLINED', 'REVOKED', 'ABSENT', 'CANCELLED', 'ARCHIVED', 'ENDED', 'WITHDRAWN']);

/** A status colour that repeats what the badge text says, never replacing it. */
export function statusTone(record: Pick<OperationRecord, 'status' | 'expired'>): BadgeTone {
    if (record.expired) return 'danger';
    if (done.has(record.status)) return 'accent';
    if (waiting.has(record.status)) return 'warning';
    if (stopped.has(record.status)) return 'neutral';
    return 'info';
}

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
/** "Overdue", "Today", "Tomorrow" or a short date for a record's next action, without inventing a time. */
export function dueText(value: string | null | undefined, now: number) {
    if (!value) return null;
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const days = Math.round((startOfDay(date) - startOfDay(new Date(now))) / 86_400_000);
    const short = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return { text: days < 0 ? `Overdue · ${short}` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : short, late: days < 0 };
}
