import type { BadgeTone } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { appointmentStatus, dateOnly, type Appointment } from '../api';

/** How an appointment's status and dates read in staff lists and panels. */
const tones: Record<string, BadgeTone> = { Active: 'accent', Upcoming: 'info', Invited: 'warning', Expired: 'neutral', Ended: 'neutral' };
export const appointmentBadge = (appointment: Appointment) => {
    const status = appointmentStatus(appointment);
    return { text: status === 'Invited' ? 'Awaiting acceptance' : status, tone: tones[status] ?? 'neutral' };
};
const day = (value?: string | null) => value ? formatDate(dateOnly(value), { day: 'numeric', month: 'short', year: 'numeric' }) : null;
export const appointmentDates = (appointment: Appointment) => `${day(appointment.starts_on)} – ${day(appointment.ends_on) ?? 'ongoing'}`;
