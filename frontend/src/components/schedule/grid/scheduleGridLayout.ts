import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { formatDate as formatAppDate, formatTime as formatAppTime } from '../../../utils/formatting';
import { eventTypeCopy, type ScheduleWorkspaceEvent } from '../workspaceTypes';

// Sizes, dates and positions shared by the month and timeline boards, and the times a dropped event moves to.
export const SLOT_HEIGHT = 40;

export const TIMELINE_GUTTER_WIDTH = 64;

export const HOURS = Array.from({ length: 24 }, (_, index) => index);

export const pad = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

export const parseDate = (value: string) => new Date(value.includes('T') ? value : `${value}T00:00:00`);

export const isPast = (value: string) => parseDate(value).getTime() < Date.now();

export const sameDay = (left: Date, right: Date) => toDateKey(left) === toDateKey(right);

export const timelineDayMinWidth = (dayCount: number) => {
    if (dayCount === 1) return 520;
    if (dayCount >= 7) return 136;
    if (dayCount >= 5) return 150;
    return 176;
};

export const monthGrid = (cursorDate: Date) => {
    const firstDay = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const start = new Date(firstDay);
    const offset = (firstDay.getDay() + 6) % 7;
    start.setDate(firstDay.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return { date, inMonth: date.getMonth() === cursorDate.getMonth() };
    });
};

export const formatTime = (value: string) =>
    formatAppTime(parseDate(value));

export const formatDay = (value: Date) =>
    formatAppDate(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export const eventStyle = (event: ScheduleWorkspaceEvent, selected: boolean): CSSProperties => {
    const tone = event.conflict
        ? { accent: 'var(--state-danger)', soft: 'var(--state-danger-soft)' }
        : { accent: eventTypeCopy[event.eventType].accent, soft: eventTypeCopy[event.eventType].soft };

    return {
        borderColor: tone.accent,
        backgroundColor: tone.soft,
        boxShadow: selected ? `inset 0 0 0 1px ${tone.accent}` : undefined
    };
};

export const eventTimelinePosition = (event: ScheduleWorkspaceEvent) => {
    const start = parseDate(event.startsAt);
    const end = parseDate(event.endsAt);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = sameDay(start,end) ? end.getHours() * 60 + end.getMinutes() : 1440;
    const top = (startMinutes / 60) * SLOT_HEIGHT;
    const height = Math.max(((endMinutes - startMinutes) / 60) * SLOT_HEIGHT, SLOT_HEIGHT * 0.8);
    return { top, height };
};

export type Lane = { lane: number; of: number };

/** Events that overlap in a day column sit side by side: each gets a lane and the number of lanes it shares. */
export const laneLayout = (events: ScheduleWorkspaceEvent[]) => {
    const placed = new Map<string, Lane>();
    let cluster: { id: string; lane: number; end: number }[] = [], clusterEnd = 0;
    const close = () => { const of = Math.max(0, ...cluster.map(item => item.lane)) + 1; cluster.forEach(item => placed.set(item.id, { lane: item.lane, of })); cluster = []; };
    for (const event of [...events].sort((a, b) => parseDate(a.startsAt).getTime() - parseDate(b.startsAt).getTime())) {
        const start = parseDate(event.startsAt).getTime(), end = parseDate(event.endsAt).getTime();
        if (cluster.length && start >= clusterEnd) close();
        const used = new Set(cluster.filter(item => item.end > start).map(item => item.lane));
        let lane = 0; while (used.has(lane)) lane += 1;
        cluster.push({ id: event.id, lane, end }); clusterEnd = Math.max(clusterEnd, end);
    }
    close();
    return placed;
};

export const laneStyle = (place?: Lane): CSSProperties => place && place.of > 1 ? { left: `calc(${(place.lane / place.of) * 100}% + 3px)`, width: `calc(${100 / place.of}% - 6px)`, right: 'auto' } : {};

export const resolveSlotDate = (day: Date, hour: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const minutes = offset >= rect.height / 2 ? 30 : 0;
    const next = new Date(day);
    next.setHours(hour, minutes, 0, 0);
    return next;
};

export const computeMonthDropTimes = (
    event: ScheduleWorkspaceEvent,
    targetDateKey: string
): { newStartsAt: string; newEndsAt: string } => {
    const origStart = parseDate(event.startsAt);
    const origEnd = parseDate(event.endsAt);
    const durationMs = origEnd.getTime() - origStart.getTime();

    const [y, m, d] = targetDateKey.split('-').map(Number);
    const newStart = new Date(y, m - 1, d, origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const toIso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
    return { newStartsAt: toIso(newStart), newEndsAt: toIso(newEnd) };
};

export const computeTimelineDropTimes = (
    event: ScheduleWorkspaceEvent,
    targetDateKey: string,
    pointerY: number,
    overRect: DOMRect
): { newStartsAt: string; newEndsAt: string } => {
    const origStart = parseDate(event.startsAt);
    const origEnd = parseDate(event.endsAt);
    const durationMs = origEnd.getTime() - origStart.getTime();

    const relativeY = pointerY - overRect.top;
    const fractionOfDay = relativeY / overRect.height;
    const totalMinutes = Math.round(fractionOfDay * 24 * 60 / 15) * 15;
    const clampedMinutes = Math.max(0, Math.min(totalMinutes, 1439));

    const [y, m, d] = targetDateKey.split('-').map(Number);
    const newStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    newStart.setMinutes(clampedMinutes);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const toIso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
    return { newStartsAt: toIso(newStart), newEndsAt: toIso(newEnd) };
};
