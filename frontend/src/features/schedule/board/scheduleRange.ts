import { useSearchParams } from 'react-router-dom';
import { formatDate } from '../../../utils/formatting';

export type BoardView = 'week' | 'agenda';

const pad = (value: number) => String(value).padStart(2, '0');
/** Local calendar day, YYYY-MM-DD. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Local wall time without an offset, as the club schedule API expects. */
export const localDateTime = (date: Date) => `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
export const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
export const startOfWeek = (date: Date) => { const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()); return addDays(day, -((day.getDay() + 6) % 7)); };
const parseDay = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Days shown per view: a week, or four weeks of agenda. */
export const viewLength = (view: BoardView) => (view === 'week' ? 7 : 28);

export function rangeLabel(from: Date, days: number) {
    const last = addDays(from, days - 1);
    const sameMonth = from.getMonth() === last.getMonth() && from.getFullYear() === last.getFullYear();
    return sameMonth
        ? `${from.getDate()}–${formatDate(last, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : `${formatDate(from, { day: 'numeric', month: 'short' })} – ${formatDate(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const prefersAgenda = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches;

/**
 * The shown period and view, kept in the URL (`week`, `view`) so a schedule can be shared and survives reloads.
 * `date` from older schedule links opens the week that contains it.
 */
export function useScheduleRange() {
    const [params, setParams] = useSearchParams();
    const view: BoardView = params.get('view') === 'week' ? 'week' : params.get('view') === 'agenda' ? 'agenda' : prefersAgenda() ? 'agenda' : 'week';
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
        setView: (value: BoardView) => update({ view: value }),
        shift: (direction: 1 | -1) => update({ week: dayKey(addDays(from, direction * days)) }),
        today: () => update({ week: null }),
        goTo: (date: Date) => update({ week: dayKey(startOfWeek(date)) }),
    };
}

export type ScheduleRange = ReturnType<typeof useScheduleRange>;
