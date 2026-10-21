import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../utils/formatting';
import { addDays } from './scheduleRange';

const WEEKDAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * The words a schedule writes dates with. Where the browser has no Georgian date data, Georgian comes from the
 * calendar's own day and month names, so a schedule never mixes English dates into Georgian.
 */
export function useScheduleDates() {
    const { t, i18n } = useTranslation();
    const missing = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') && !Intl.DateTimeFormat.supportedLocalesOf(['ka-GE']).length;
    const month = (date: Date) => t(`schedule.editor.months.${date.getMonth()}`);
    const weekday = (date: Date, length: 'long' | 'short') => missing
        ? t(`schedule.editor.weekdays.${WEEKDAY_KEYS[date.getDay()]}.${length}`) : formatDate(date, { weekday: length });
    const dayMonth = (date: Date) => missing ? `${date.getDate()} ${month(date)}` : formatDate(date, { day: 'numeric', month: 'short' });
    return {
        weekday,
        dayMonth,
        /** "Wednesday 21 Oct". */
        day: (date: Date) => `${weekday(date, 'long')} ${dayMonth(date)}`,
        monthYear: (date: Date) => missing ? `${month(date)} ${date.getFullYear()}` : formatDate(date, { month: 'long', year: 'numeric' }),
        /** "19–25 October 2026", or "28 Sep – 4 Oct 2026" across two months. */
        range: (from: Date, days: number) => {
            const last = addDays(from, days - 1);
            if (missing) return from.getMonth() === last.getMonth() ? `${from.getDate()}–${last.getDate()} ${month(last)} ${last.getFullYear()}` : `${dayMonth(from)} – ${dayMonth(last)} ${last.getFullYear()}`;
            return from.getMonth() === last.getMonth() && from.getFullYear() === last.getFullYear()
                ? `${from.getDate()}–${formatDate(last, { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `${formatDate(from, { day: 'numeric', month: 'short' })} – ${formatDate(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
        },
    };
}
