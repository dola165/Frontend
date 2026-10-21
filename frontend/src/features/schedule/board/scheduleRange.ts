import { useSearchParams } from 'react-router-dom';
import { formatDate } from '../../../utils/formatting';

/** A week of day columns, a month calendar, or a day-by-day agenda. */
export type BoardView = 'week' | 'calendar' | 'agenda';

const pad = (value: number) => String(value).padStart(2, '0');
/** Local calendar day, YYYY-MM-DD. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Local wall time without an offset, as the club schedule API expects. */
export const localDateTime = (date: Date) => `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
export const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
/** The same time of day on another day, keeping the length, in local wall time: where a dragged entry lands. */
export function moveToDay(startsAt: string, endsAt: string, day: Date) {
    const start = new Date(startsAt), length = Date.parse(endsAt) - start.getTime();
    const moved = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes());
    return { startsAt: localDateTime(moved), endsAt: localDateTime(new Date(moved.getTime() + length)) };
}
export const startOfWeek = (date: Date) => { const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()); return addDays(day, -((day.getDay() + 6) % 7)); };
const parseDay = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Days shown per view: a week, or four weeks of agenda. */
export const viewLength = (view: BoardView) => (view === 'agenda' ? 28 : 7);

export function rangeLabel(from: Date, days: number) {
    const last = addDays(from, days - 1);
    const sameMonth = from.getMonth() === last.getMonth() && from.getFullYear() === last.getFullYear();
    return sameMonth
        ? `${from.getDate()}–${formatDate(last, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : `${formatDate(from, { day: 'numeric', month: 'short' })} – ${formatDate(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** What a schedule board needs to show a period and move through it. */
export interface BoardPeriod {
    view: BoardView;
    /** First day shown (the month's first day in the calendar view). */
    from: Date;
    days: number;
    label: string;
    isCurrent: boolean;
    shift: (direction: 1 | -1) => void;
    today: () => void;
    setView: (view: BoardView) => void;
    /** Open the week that contains a day (the calendar view's days lead there). */
    goTo?: (date: Date) => void;
}

/**
 * The shown period and view, kept in the URL (`week`, `view`) so a schedule can be shared and survives reloads.
 * `date` from older schedule links opens the week that contains it. Phones get the week too, one day per row.
 */
export function useScheduleRange() {
    const [params, setParams] = useSearchParams();
    const view: BoardView = params.get('view') === 'agenda' ? 'agenda' : 'week';
    const anchor = parseDay(params.get('week')) ?? parseDay(params.get('date')) ?? new Date();
    const from = startOfWeek(anchor);
    const days = viewLength(view);
    const to = addDays(from, days);
    const update = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        next.delete('date');
        setParams(next, { replace: true });
    };
    const thisWeek = dayKey(startOfWeek(new Date()));
    return {
        view, from, to, days, label: rangeLabel(from, days), isCurrent: dayKey(from) === thisWeek,
        setView: (value: BoardView) => update({ view: value === 'agenda' ? 'agenda' : 'week' }),
        shift: (direction: 1 | -1) => update({ week: dayKey(addDays(from, direction * days)) }),
        today: () => update({ week: null }),
        goTo: (date: Date) => update({ week: dayKey(startOfWeek(date)) }),
    };
}

export type ScheduleRange = ReturnType<typeof useScheduleRange>;
