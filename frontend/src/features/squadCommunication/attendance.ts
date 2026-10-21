import type { ScheduleEventType } from '../schedule/api';
import type { SquadSession } from './api';

export type AttendancePerson = SquadSession['attendance'][number];

/** Matches usually need a yes from everyone, so new matches ask by default. Training assumes everyone is coming. */
export const asksForConfirmationByDefault = (type?: ScheduleEventType | null) => type === 'MATCH' || type === 'FRIENDLY';

/**
 * Who is coming, in opt-out terms. Without a confirmation request everyone invited is expected
 * unless they said they can't come; with one, people who haven't answered are still to confirm.
 * A session changed after a reply always asks that person again.
 */
export function availability(session: Pick<SquadSession, 'attendance' | 'response_requested'>) {
    const invited = session.attendance.filter(person => person.active !== false);
    const asking = session.response_requested === true;
    const cantCome = invited.filter(person => person.response === 'NOT_GOING');
    const unsure = invited.filter(person => person.response === 'UNSURE');
    const toConfirm = invited.filter(person => person.response === 'RECONFIRMATION_REQUIRED' || (asking && person.response === 'UNANSWERED'));
    const confirmed = invited.filter(person => person.response === 'GOING');
    return { invited, asking, cantCome, unsure, toConfirm, confirmed, expected: invited.length - cantCome.length };
}

/** A short summary for a coach, for example "2 can't come · 3 to confirm". */
export function availabilityLabel(session: Pick<SquadSession, 'attendance' | 'response_requested'>) {
    const value = availability(session);
    const parts = [
        value.cantCome.length ? `${value.cantCome.length} can’t come` : null,
        value.unsure.length ? `${value.unsure.length} not sure` : null,
        value.toConfirm.length ? `${value.toConfirm.length} to confirm` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : value.asking ? 'Everyone confirmed' : 'Everyone coming';
}
