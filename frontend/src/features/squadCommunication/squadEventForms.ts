import type { EventCreationFormValues } from '../../components/schedule/EventCreationModal';
import { localDateISO } from '../../components/schedule/scheduleFormUtils';
import type { DayOfWeek, ScheduleEventUpsertInput } from '../schedule/api';
import type * as api from './api';

const weekdays: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const time = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const DEFAULT_START = 18 * 60, DEFAULT_LENGTH = 90, DAY = 24 * 60;
/** The local wall-clock time `minutes` past midnight of `day` (DST days and :45 zones keep the wall time). */
const atMinutes = (day: Date, minutes: number) => { const at = new Date(day); at.setHours(0, minutes, 0, 0); return at; };
/**
 * The default session runs 90 minutes from 18:00 local time on the chosen day. Once today's 18:00 has
 * passed it starts at the first local half hour at least an hour from now; when that would not end
 * before midnight it moves to 18:00 the next day. Rounding uses the local wall clock, so zones with a
 * :30 or :45 offset still get :00/:30 starts.
 */
export function newSquadEvent(date: Date, squadId: number, weekly: boolean): EventCreationFormValues {
    let start = atMinutes(date, DEFAULT_START);
    const now = new Date();
    if (localDateISO(start) === localDateISO(now) && start <= now) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() || now.getMilliseconds() ? 1 : 0);
        const soonest = Math.ceil((nowMinutes + 60) / 30) * 30;
        if (soonest + DEFAULT_LENGTH < DAY) start = atMinutes(start, soonest);
        else { const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1); start = atMinutes(tomorrow, DEFAULT_START); }
    }
    const end = atMinutes(start, start.getHours() * 60 + start.getMinutes() + DEFAULT_LENGTH);
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
