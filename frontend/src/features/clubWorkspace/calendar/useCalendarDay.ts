import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fromIsoDay, isoDay } from '../../../design/calendar/calendarDates';

/** Keep the viewed local day in calendar links and browser history. */
export function useCalendarDay() {
    const [params, setParams] = useSearchParams();
    const [today] = useState(() => new Date());
    const date = useMemo(() => {
        const values = params.getAll('date');
        if (values.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(values[0])) return today;
        const parsed = fromIsoDay(values[0]);
        return parsed && Number.isFinite(parsed.getTime()) && isoDay(parsed) === values[0] ? parsed : today;
    }, [params, today]);
    const setDate = useCallback((next: Date) => {
        if (!Number.isFinite(next.getTime())) return;
        setParams(previous => {
            const updated = new URLSearchParams(previous);
            updated.set('date', isoDay(next));
            return updated;
        }, { replace: true });
    }, [setParams]);
    return [date, setDate] as const;
}
