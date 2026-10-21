import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/formatting';

const WEEKDAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Family summaries reuse calendar labels when the browser omits Georgian Intl date data. */
export function useFamilyDateLabels() {
    const { t, i18n } = useTranslation();
    const missingGeorgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka')
        && !Intl.DateTimeFormat.supportedLocalesOf(['ka-GE']).length;
    const fallback = (date: Date) => missingGeorgian && Number.isFinite(date.getTime());
    const month = (date: Date) => t(`schedule.editor.months.${date.getMonth()}`);
    const weekday = (date: Date, length: 'long' | 'short') => t(`schedule.editor.weekdays.${WEEKDAY_KEYS[date.getDay()]}.${length}`);
    return {
        nextDate: (date: Date) => fallback(date) ? `${weekday(date, 'long')} ${date.getDate()} ${month(date)}`
            : formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' }),
        shortDate: (date: Date) => fallback(date) ? `${date.getDate()} ${month(date)}`
            : formatDate(date, { day: 'numeric', month: 'short' }),
        weekday: (date: Date) => fallback(date) ? weekday(date, 'short') : formatDate(date, { weekday: 'short' }),
    };
}
