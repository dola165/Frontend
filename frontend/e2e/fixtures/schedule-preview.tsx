import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { CalendarDays, Moon, Sun } from 'lucide-react';
import { Toaster } from 'sonner';
import { apiClient } from '../../src/api/axiosConfig';
import { CalendarPage } from '../../src/pages/CalendarPage';
import { localDateISO, upcomingTrainingDates } from '../../src/components/schedule/scheduleFormUtils';
import type { ScheduleEventOccurrence, ScheduleEventUpsertInput, ScheduleRecurrenceRule } from '../../src/features/schedule/api';
import i18n from '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';

// This entry point is a development fixture. Its complete data store is scoped to this tab.
// The real CalendarPage, editor, permission checks and save handlers are rendered below.
const CLUB_ID = 71001;
const OWNER_ID = 71010;
const CLUB_NAME = 'FC Dinamo Tbilisi';
const squads = [{ id: 71101, name: 'Under 16' }, { id: 71102, name: 'First team' }, { id: 71103, name: 'Under 14' }];
const params = new URLSearchParams(window.location.search);
if (params.get('lang') === 'ka' || params.get('lang') === 'en') void i18n.changeLanguage(params.get('lang')!);
const nextMonday = new Date();
nextMonday.setHours(12, 0, 0, 0);
// A Monday always opens the following week, rather than a session earlier today.
nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
const weekStart = localDateISO(nextMonday);
const addDays = (value: string, count: number) => {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + count);
    return localDateISO(date);
};
const at = (day: number, time: string) => `${addDays(weekStart, day)}T${time}:00`;
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const trainingRule = (daysOfWeek: ScheduleRecurrenceRule['daysOfWeek'], startTime: string, endTime: string): ScheduleRecurrenceRule => ({
    frequency: 'WEEKLY', intervalValue: 1, daysOfWeek, startDate: weekStart,
    endDate: addDays(weekStart, 55), startTime: `${startTime}:00`, endTime: `${endTime}:00`, timezone,
});

type PreviewEvent = ScheduleEventUpsertInput & { eventId: number; clubId: number | null; userId: number | null; status: string };
const makeEvent = (value: Partial<PreviewEvent> & Pick<PreviewEvent, 'eventId' | 'title' | 'eventType' | 'startsAt' | 'endsAt'>): PreviewEvent => ({
    clubId: CLUB_ID, userId: null, visibility: 'PRIVATE', publishAt: null, locationName: null,
    locationLat: null, locationLng: null, description: null, hostSquadId: null, recurrence: null, status: 'SCHEDULED', ...value,
});
const records = new Map<number, PreviewEvent>([
    makeEvent({ eventId: 71201, title: 'U16 · Ball work & small-sided games', eventType: 'TRAINING', startsAt: at(0, '17:00'), endsAt: at(0, '18:30'),
        hostSquadId: squads[0].id, description: 'A short warm-up, passing patterns and small-sided games. Bring boots and water.',
        locationName: 'Dinamo Academy · Pitch 2', recurrence: trainingRule(['MONDAY', 'WEDNESDAY', 'FRIDAY'], '17:00', '18:30') }),
    makeEvent({ eventId: 71202, title: 'First team · Match preparation', eventType: 'TRAINING', startsAt: at(1, '18:00'), endsAt: at(1, '19:30'),
        hostSquadId: squads[1].id, description: 'Build-up play, set pieces and recovery work.',
        locationName: 'Dinamo training ground', recurrence: trainingRule(['TUESDAY', 'THURSDAY'], '18:00', '19:30') }),
    makeEvent({ eventId: 71203, title: 'U16 · Home match', eventType: 'MATCH', startsAt: at(5, '15:00'), endsAt: at(5, '17:00'),
        hostSquadId: squads[0].id, visibility: 'PUBLIC', description: 'Arrive 45 minutes before kick-off. Club kit and shin pads required.', locationName: 'Dinamo Academy · Main pitch' }),
    makeEvent({ eventId: 71204, title: 'Coaches · Weekly catch-up', eventType: 'ACTIVITY', startsAt: at(2, '12:00'), endsAt: at(2, '12:45'),
        description: 'Review the week, agree squad priorities and confirm the weekend plan.', locationName: 'Clubhouse · Meeting room' }),
    makeEvent({ eventId: 71301, clubId: null, userId: OWNER_ID, title: 'Recovery & mobility', eventType: 'ACTIVITY', startsAt: at(1, '09:00'), endsAt: at(1, '09:45'),
        description: 'A little time for mobility and recovery.', locationName: 'Home' }),
].map(event => [event.eventId, event] as const));
let nextId = 71400;

// Optional, deterministic busy-club workload for local performance measurements.
// It never enters the product build or makes a network write.
const extraEvents = Math.min(350, Math.max(0, Number(params.get('load')) || 0));
for (let index = 0; index < extraEvents; index += 1) {
    const eventId = nextId++;
    const hour = String(8 + index % 12).padStart(2, '0');
    records.set(eventId, makeEvent({
        eventId, title: `Squad session ${index + 1}`, eventType: index % 4 ? 'TRAINING' : 'ACTIVITY',
        startsAt: at(index % 7, `${hour}:00`), endsAt: at(index % 7, `${hour}:45`),
        hostSquadId: squads[index % squads.length].id, locationName: `Academy · Pitch ${index % 4 + 1}`,
    }));
}

const occurrence = (event: PreviewEvent, startsAt = event.startsAt, endsAt = event.endsAt): ScheduleEventOccurrence => ({
    eventId: event.eventId,
    occurrenceId: `${event.eventId}:${startsAt}`,
    clubId: event.clubId,
    clubName: event.clubId === CLUB_ID ? CLUB_NAME : null,
    userId: event.userId,
    eventType: event.eventType,
    title: event.title,
    description: event.description ?? null,
    startsAt, endsAt,
    locationName: event.locationName ?? null,
    locationLat: event.locationLat ?? null,
    locationLng: event.locationLng ?? null,
    visibility: event.visibility ?? 'PRIVATE',
    publishAt: event.publishAt ?? null,
    publicNow: event.visibility === 'PUBLIC' || (event.visibility === 'SCHEDULED_PUBLICATION' && !!event.publishAt && Date.parse(event.publishAt) <= Date.now()),
    recurring: !!event.recurrence,
    recurrence: event.recurrence ?? null,
    opponentClubId: event.opponentClubId ?? null,
    opponentClubName: null,
    challengeStatus: null,
    status: event.status,
    conflict: false,
    conflictingEventIds: [],
    challengerSquadId: event.hostSquadId ?? null,
    challengerSquadName: squads.find(squad => squad.id === event.hostSquadId)?.name ?? null,
});

function scheduleWindow(clubId: number | null, from: string, to: string): ScheduleEventOccurrence[] {
    const windowStart = Date.parse(from), windowEnd = Date.parse(to);
    const output: ScheduleEventOccurrence[] = [];
    const include = (value: ScheduleEventOccurrence) => {
        if (Date.parse(value.startsAt) <= windowEnd && Date.parse(value.endsAt) >= windowStart) output.push(value);
    };
    for (const event of records.values()) {
        if (event.clubId !== clubId || event.status === 'CANCELLED') continue;
        if (!event.recurrence) { include(occurrence(event)); continue; }
        const rule = event.recurrence;
        const throughDay = rule.endDate && rule.endDate < to.slice(0, 10) ? rule.endDate : to.slice(0, 10);
        let fromDay = from.slice(0, 10);
        // The same helper used by the editor follows the server's start-date-anchored weekly blocks.
        for (let batch = 0; batch < 100 && fromDay <= throughDay; batch += 1) {
            const dates = upcomingTrainingDates({ ...rule, endDate: throughDay, limit: 6 }, fromDay);
            if (!dates.length) break;
            for (const day of dates) include(occurrence(event, `${day}T${rule.startTime}`, `${day}T${rule.endTime}`));
            fromDay = addDays(dates[dates.length - 1], 1);
        }
    }
    return output.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

const response = (config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse => ({
    config, data, status, statusText: status === 200 ? 'OK' : 'Preview error', headers: {},
});
const reject = (config: InternalAxiosRequestConfig, message: string, status = 400): never => {
    throw new AxiosError(message, 'ERR_PREVIEW_REQUEST', config, undefined, response(config, { message }, status));
};
const payload = (config: InternalAxiosRequestConfig): ScheduleEventUpsertInput => {
    const value = typeof config.data === 'string' ? JSON.parse(config.data) as ScheduleEventUpsertInput : config.data as ScheduleEventUpsertInput;
    if (!value?.title?.trim() || !value.eventType || !Number.isFinite(Date.parse(value.startsAt)) || !Number.isFinite(Date.parse(value.endsAt)) || Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
        return reject(config, 'Add a title and a valid event time.');
    }
    return structuredClone(value);
};

apiClient.defaults.adapter = async config => {
    const method = config.method?.toUpperCase() ?? 'GET';
    const path = new URL(config.url ?? '', window.location.origin).pathname.replace(/^\/api(?=\/)/, '');
    // Nothing below forwards requests or credentials to a network adapter.
    if (method === 'GET' && path === '/clubs/my-membership-context') {
        return response(config, { hasClubMembership: true, canCreateClub: false, clubId: CLUB_ID, clubName: CLUB_NAME, myRole: 'OWNER' });
    }
    if (method === 'GET' && path === `/clubs/${CLUB_ID}/squads`) return response(config, structuredClone(squads));
    if (method === 'GET' && (path === `/schedule/clubs/${CLUB_ID}/events` || path === '/schedule/me/events')) {
        const from = String(config.params?.from ?? `${weekStart}T00:00:00`);
        const to = String(config.params?.to ?? `${addDays(weekStart, 6)}T23:59:59`);
        return response(config, { events: scheduleWindow(path.includes('/clubs/') ? CLUB_ID : null, from, to) });
    }
    if (method === 'POST' && (path === `/schedule/clubs/${CLUB_ID}/events` || path === '/schedule/me/events')) {
        const value = payload(config), eventId = nextId++;
        const clubId = path.includes('/clubs/') ? CLUB_ID : null;
        records.set(eventId, makeEvent({ ...value, eventId, clubId, userId: clubId ? null : OWNER_ID, visibility: clubId ? value.visibility : 'PRIVATE' }));
        return response(config, { eventId, conflict: false, conflictingEventIds: [] });
    }
    const update = /^\/schedule\/events\/(\d+)$/.exec(path);
    if (method === 'PUT' && update) {
        const eventId = Number(update[1]), previous = records.get(eventId);
        if (!previous) return reject(config, 'That event is no longer in this preview.', 404);
        records.set(eventId, { ...previous, ...payload(config), eventId, clubId: previous.clubId, userId: previous.userId });
        return response(config, { eventId, conflict: false, conflictingEventIds: [] });
    }
    if (method === 'DELETE' && update) {
        const eventId = Number(update[1]);
        if (!records.delete(eventId)) return reject(config, 'That event is no longer in this preview.', 404);
        return response(config, {});
    }
    const changeStatus = /^\/schedule\/clubs\/(\d+)\/events\/(\d+)\/(cancel|complete|result)$/.exec(path);
    if (method === 'POST' && changeStatus) {
        const eventId = Number(changeStatus[2]), event = records.get(eventId);
        if (!event || event.clubId !== Number(changeStatus[1])) return reject(config, 'That club event is not in this preview.', 404);
        records.set(eventId, { ...event, status: changeStatus[3] === 'cancel' ? 'CANCELLED' : 'COMPLETED' });
        return response(config, {});
    }
    return reject(config, 'This action is not available in the schedule design preview.', 404);
};

localStorage.setItem('tutorial.calendar.completed', 'true');
const initialLight = params.get('theme') === 'light';
document.documentElement.classList.toggle('dark', !initialLight);
const requestedDate = params.get('date');
const routeDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : weekStart;
const initialRoute = `/calendar?date=${routeDate}${params.get('scope') === 'personal' ? '&scope=personal' : ''}${params.get('newEvent') === '1' ? '&newEvent=1' : ''}`;

export default function SchedulePreview() {
    const [darkMode, setDarkMode] = useState(!initialLight);
    const toggleTheme = () => {
        document.documentElement.classList.toggle('dark', !darkMode);
        setDarkMode(value => !value);
    };
    return <div className={`schedule-design-fixture workspace-page-shell${darkMode ? '' : ' workspace-light'}`}>
        <div className="schedule-design-fixture-note">
            <span className="schedule-design-fixture-brand"><CalendarDays size={15} />GrassKickZ</span>
            <span>Design preview <span aria-hidden="true">·</span> Changes stay in this tab</span>
            <button type="button" onClick={toggleTheme} aria-label={darkMode ? 'Preview light theme' : 'Preview dark theme'} title={darkMode ? 'Preview light theme' : 'Preview dark theme'}>
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
        </div>
        <main className="schedule-design-fixture-page">
            <CalendarPage user={{ id: OWNER_ID, fullName: 'Club owner', role: 'OWNER' }} darkMode={darkMode} setDarkMode={setDarkMode} />
        </main>
        <Toaster theme={darkMode ? 'dark' : 'light'} />
    </div>;
}

const styles = document.createElement('style');
styles.textContent = `
html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
.schedule-design-fixture { display: flex; flex-direction: column; width: 100%; height: 100dvh; background: var(--fc-page-bg); color: var(--fc-text-primary); }
.schedule-design-fixture-note { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; min-height: 38px; padding: 5px 20px; border-bottom: 1px solid var(--fc-border); font-size: 11px; line-height: 1.4; color: var(--fc-text-secondary); background: var(--fc-sidebar-bg); }
.schedule-design-fixture-brand { display: inline-flex; align-items: center; gap: 7px; font-weight: 650; color: var(--fc-text-primary); }
.schedule-design-fixture-note button { display: inline-flex; align-items: center; justify-content: center; height: 30px; width: 30px; border: 1px solid var(--fc-border); border-radius: 7px; cursor: pointer; }
.schedule-design-fixture-note button:focus-visible { outline: 2px solid var(--fc-accent); outline-offset: 2px; }
.schedule-design-fixture-page { flex: 1; min-height: 0; overflow: hidden; }
@media(max-width: 600px) { .schedule-design-fixture-note { padding: 5px 10px; font-size: 10px; gap: 8px; } .schedule-design-fixture-brand { font-size: 0; gap: 0; } }
`;
document.head.append(styles);
const root = document.getElementById('root');
if (root) createRoot(root).render(<MemoryRouter initialEntries={[initialRoute]}><SchedulePreview /></MemoryRouter>);
