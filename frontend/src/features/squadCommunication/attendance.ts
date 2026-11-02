import type { SquadSession } from './api';

export type AttendancePerson = SquadSession['attendance'][number];

/** A move never silently reverses a person's explicit opt-out. Keep the raw stale provenance. */
export function attendancePerson(person: AttendancePerson): AttendancePerson {
    return person.response === 'RECONFIRMATION_REQUIRED' && person.previous_response === 'NOT_GOING'
        ? { ...person, response: 'NOT_GOING', response_status: person.response_status ?? 'RECONFIRMATION_REQUIRED' } : person;
}

/** Ordinary squad sessions are expected by default, including retained confirmation-requested rows. */
export function availability(session: Pick<SquadSession, 'attendance' | 'response_requested'>) {
    const invited = session.attendance.filter(person => person.active !== false).map(attendancePerson);
    const asking = false;
    const cantCome = invited.filter(person => person.response === 'NOT_GOING');
    const unsure = invited.filter(person => person.response === 'UNSURE');
    const toConfirm: AttendancePerson[] = [];
    const confirmed = invited.filter(person => person.response === 'GOING');
    return { invited, asking, cantCome, unsure, toConfirm, confirmed, expected: invited.length - cantCome.length };
}

/** A short coach summary of explicit outside facts, never an ordinary confirmation obligation. */
export function availabilityLabel(session: Pick<SquadSession, 'attendance' | 'response_requested'>) {
    const value = availability(session);
    const parts = [
        value.cantCome.length ? `${value.cantCome.length} can’t come` : null,
        value.unsure.length ? `${value.unsure.length} not sure` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Everyone expected';
}
