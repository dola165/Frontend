import type { EventCreationFormValues } from '../../components/schedule/EventCreationModal';
import { localDateISO } from '../../components/schedule/scheduleFormUtils';
import type { DayOfWeek, ScheduleEventUpsertInput } from '../schedule/api';
import type * as api from './api';

const weekdays: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const time = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
export function newSquadEvent(date: Date, squadId: number, weekly: boolean): EventCreationFormValues {
    const start = new Date(date); start.setHours(18, 0, 0, 0);
    if (localDateISO(start) === localDateISO() && start <= new Date()) {
        start.setTime(Math.ceil((Date.now() + 3600000) / 1800000) * 1800000);
        if (start.getHours() > 22) { start.setDate(start.getDate()+1); start.setHours(18,0,0,0); }
    }
    const end = new Date(start.getTime() + 90 * 60000);
    const until = new Date(start); until.setDate(until.getDate() + 42);
    return { eventType: 'TRAINING', title: '', date: localDateISO(start), startTime: time(start), endTime: time(end),
        isRecurring: weekly, hostSquadId: squadId, description: '', locationName: '', locationLat: '', locationLng: '',
        visibility: 'PRIVATE', publishAt: '', recurrenceDays: [weekdays[start.getDay()]], recurrenceStartDate: localDateISO(start),
        recurrenceEndDate: localDateISO(until), recurrenceStartTime: time(start), recurrenceEndTime: time(end),
        recurrenceInterval: 1, recurrenceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
export function squadEventPlan(payload: ScheduleEventUpsertInput, playerIds: number[], requestResponses: boolean, requestId: string): api.SquadEventPlan {
    return { requestId, title: payload.title, eventType: payload.eventType, description: payload.description ?? null,
        startsAt: new Date(payload.startsAt).toISOString(), endsAt: new Date(payload.endsAt).toISOString(), location: payload.locationName ?? null,
        timezone: payload.recurrence?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        playerIds: [...playerIds].sort((a,b) => a-b), requestResponses,
        repeat: payload.recurrence ? { endDate: payload.recurrence.endDate ?? '', intervalWeeks: payload.recurrence.intervalValue, daysOfWeek: payload.recurrence.daysOfWeek } : null };
}
export function formPayload(form: EventCreationFormValues): ScheduleEventUpsertInput {
    const repeat = form.isRecurring;
    return { title: form.title.trim(), eventType: form.eventType ?? 'TRAINING', description: form.description?.trim() || null,
        startsAt: `${repeat ? form.recurrenceStartDate : form.date}T${repeat ? form.recurrenceStartTime : form.startTime}:00`,
        endsAt: `${repeat ? form.recurrenceStartDate : form.endDate || form.date}T${repeat ? form.recurrenceEndTime : form.endTime}:00`, locationName: form.locationName.trim() || null,
        recurrence: repeat ? { frequency: 'WEEKLY', startDate: form.recurrenceStartDate!, endDate: form.recurrenceEndDate,
            startTime: form.recurrenceStartTime!, endTime: form.recurrenceEndTime!, daysOfWeek: form.recurrenceDays!,
            intervalValue: form.recurrenceInterval ?? 1, timezone: form.recurrenceTimezone } : null };
}
