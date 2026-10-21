const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Date-input value in the viewer's local calendar, without a UTC date shift. */
export const localDateISO = (date = new Date()): string => {
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 0 || date.getFullYear() > 9999) return '';
    return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// UTC is used only for calendar-day arithmetic here, never to convert event times.
const parseCalendarDay = (value: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
    return parsed.getTime() / DAY_MS;
};

interface TrainingDateOptions {
    startDate: string;
    endDate?: string | null;
    daysOfWeek: readonly string[];
    intervalValue?: number | null;
    limit?: number;
    weekAnchor?: 'START' | 'MONDAY';
}

/** First sessions on or after fromDate (or the plan start), matching backend recurrence. */
export const upcomingTrainingDates = (
    { startDate, endDate, daysOfWeek, intervalValue = 1, limit = 3, weekAnchor = 'START' }: TrainingDateOptions,
    fromDate?: string,
): string[] => {
    const start = parseCalendarDay(startDate);
    const end = endDate ? parseCalendarDay(endDate) : null;
    const from = fromDate === undefined ? start : parseCalendarDay(fromDate);
    const interval = intervalValue ?? 1;
    if (
        start === null ||
        from === null ||
        (endDate && end === null) ||
        (end !== null && end < start) ||
        !Number.isInteger(interval) ||
        interval < 1 ||
        !Number.isFinite(limit) ||
        limit <= 0 ||
        !daysOfWeek.length ||
        daysOfWeek.some((day) => !WEEKDAYS.includes(day))
    )
        return [];

    const count = Math.min(6, Math.floor(limit));
    const selectedDays = new Set(daysOfWeek);
    const first = Math.max(start, from);
    const last = Math.min(end ?? Number.POSITIVE_INFINITY, first + 3659, Date.UTC(9999, 11, 31) / DAY_MS);
    const dates: string[] = [];
    const anchor = weekAnchor === 'MONDAY' ? start - (new Date(start * DAY_MS).getUTCDay() + 6) % 7 : start;
    for (let day = first; day <= last && dates.length < count; day += 1) {
        // Legacy club plans use start-date blocks; invitation series use calendar weeks.
        if (Math.floor((day - anchor) / 7) % interval !== 0) continue;
        const date = new Date(day * DAY_MS);
        if (selectedDays.has(WEEKDAYS[date.getUTCDay()])) dates.push(date.toISOString().slice(0, 10));
    }
    return dates;
};

const timeSeconds = (time: string): number | null => {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? 0);
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return hours * 3600 + minutes * 60 + seconds;
};

/** Positive same-day duration; seconds are retained as fractional minutes. */
export const durationMinutes = (startTime: string, endTime: string): number | null => {
    const start = timeSeconds(startTime);
    const end = timeSeconds(endTime);
    return start !== null && end !== null && end > start ? (end - start) / 60 : null;
};
