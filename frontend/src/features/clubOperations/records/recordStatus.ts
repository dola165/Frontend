import type { BadgeTone, ButtonVariant } from '../../../design/primitives';
import type { OperationRecord } from '../api';

const done = new Set(['COMPLETED', 'APPROVED', 'PUBLISHED', 'GRANTED', 'ARRIVED', 'COLLECTED', 'CONFIRMED', 'PAID', 'RETURNED', 'CLEARED', 'READY', 'ACTIVE', 'RECORDED', 'CLUB_CHECKED', 'BOARDED']);
const waiting = new Set(['PENDING', 'SUBMITTED', 'INVITED', 'DUE', 'PLANNED', 'ASSIGNED', 'DRAFT', 'OPEN', 'REQUESTED', 'EXPECTED', 'ISSUED']);
const stopped = new Set(['DECLINED', 'REVOKED', 'ABSENT', 'CANCELLED', 'ARCHIVED', 'ENDED', 'WITHDRAWN']);
// Done states that end the work. Others in `done` (active, granted, confirmed…) stay in force and keep their review dates.
const finishedDone = new Set(['COMPLETED', 'PAID', 'RETURNED', 'CLEARED', 'COLLECTED', 'ARRIVED', 'BOARDED', 'RECORDED', 'CLOSED', 'ACHIEVED', 'WAIVED', 'LOST', 'RETIRED']);
// Moving a record here cannot be taken back from the record itself, so the person confirms first.
const irreversible = new Set(['DECLINED', 'REVOKED', 'CANCELLED', 'ARCHIVED', 'ENDED', 'WITHDRAWN', 'CLOSED', 'RETIRED', 'LOST']);

/** A status colour that repeats what the badge text says, never replacing it. */
export function statusTone(record: Pick<OperationRecord, 'status' | 'expired'>): BadgeTone {
    if (record.expired) return 'danger';
    if (done.has(record.status)) return 'accent';
    if (waiting.has(record.status)) return 'warning';
    if (stopped.has(record.status)) return 'neutral';
    return 'info';
}

/** Whether a record's work is over, so its dates are history rather than deadlines. */
export const isFinished = (status: string) => stopped.has(status) || finishedDone.has(status);

/**
 * How a transition button looks, from what it does rather than where the server lists it:
 * stopping states are danger and need a confirmation; the first completing state is the one primary action.
 */
export function transitionStyle(targets: string[]) {
    const primary = targets.find(state => done.has(state) && !irreversible.has(state)) ?? null;
    return (state: string): { variant: ButtonVariant; confirm: boolean } => irreversible.has(state)
        ? { variant: 'danger', confirm: true }
        : { variant: state === primary ? 'primary' : 'secondary', confirm: false };
}
