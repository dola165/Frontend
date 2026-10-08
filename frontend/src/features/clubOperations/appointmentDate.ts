import {dateOnly} from './api';
export const appointmentDate = (value?: string | null) => {
    const day = dateOnly(value);
    if (!day) return 'Ongoing';
    const date = new Date(`${day}T12:00:00`);
    return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
