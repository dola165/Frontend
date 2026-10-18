import type { EventCreationFormValues } from '../../../components/schedule/EventCreationModal';
import type { ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import type { DayOfWeek, ScheduleEventType } from '../api';
import { dayKey } from '../board/scheduleRange';

const weekdays: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const order: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const duration: Record<ScheduleEventType, number> = { TRAINING: 90, TRYOUT: 120, MATCH: 120, FRIENDLY: 120, ACTIVITY: 75, MEETING: 60 };
const pad = (value: number) => String(value).padStart(2, '0');
const time = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** A sensible start for a new event on a day: 09:00, or the next half hour when that has passed. */
function startOn(day: Date) {
    const start = new Date(day);
    if (start.getHours() === 0 && start.getMinutes() === 0) start.setHours(9, 0, 0, 0); else start.setSeconds(0, 0);
    if (start.getTime() <= Date.now()) { const next = new Date(); next.setMinutes(Math.floor(next.getMinutes() / 30) * 30 + 30, 0, 0); return next; }
    return start;
}

export function newPersonalEvent(day: Date, eventType: ScheduleEventType = 'ACTIVITY'): EventCreationFormValues {
    const start = startOn(day), end = new Date(start.getTime() + duration[eventType] * 60000);
    return { eventType, title: '', date: dayKey(start), startTime: time(start), endTime: time(end), isRecurring: false,
        locationName: '', locationLat: '', locationLng: '', visibility: 'PRIVATE', publishAt: '' };
}

export function editPersonalEvent(event: ScheduleWorkspaceEvent): EventCreationFormValues {
    const start = new Date(event.startsAt), end = new Date(event.endsAt), rule = event.recurrence;
    return {
        eventType: event.eventType, title: event.title, date: dayKey(start), startTime: time(start), endTime: time(end), isRecurring: Boolean(rule),
        locationName: event.locationText ?? '', locationLat: event.locationLat != null ? String(event.locationLat) : '', locationLng: event.locationLng != null ? String(event.locationLng) : '',
        visibility: event.visibility === 'CLUB_ONLY' ? 'PRIVATE' : event.visibility,
        publishAt: event.publishAt ? `${dayKey(new Date(event.publishAt))}T${time(new Date(event.publishAt))}` : '',
        description: event.description ?? '', hostSquadId: event.hostSquadId ?? null, opponentClubId: event.opponentClubId ?? null,
        recurrenceDays: rule ? order.filter(day => rule.daysOfWeek.includes(day)) : [weekdays[start.getDay()]],
        recurrenceStartDate: rule?.startDate ?? dayKey(start), recurrenceEndDate: rule?.endDate ?? '',
        recurrenceStartTime: rule ? rule.startTime.slice(0, 5) : time(start), recurrenceEndTime: rule ? rule.endTime.slice(0, 5) : time(end),
        recurrenceInterval: rule?.intervalValue, recurrenceTimezone: rule?.timezone,
    };
}
