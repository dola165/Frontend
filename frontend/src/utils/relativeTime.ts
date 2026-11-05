import { appLocale, formatDate } from './formatting';

/** "3 hours ago", "yesterday", then the date: how the age of an update or a change reads. */
export function relativeTime(value: string) {
    const at = new Date(value), diff = at.getTime() - Date.now();
    if (Number.isNaN(at.getTime())) return '';
    const rtf = new Intl.RelativeTimeFormat(appLocale(), { numeric: 'auto' });
    const hour = 3600000, day = 24 * hour;
    if (Math.abs(diff) < hour) return rtf.format(Math.round(diff / 60000), 'minute');
    if (Math.abs(diff) < day) return rtf.format(Math.round(diff / hour), 'hour');
    if (Math.abs(diff) < 7 * day) return rtf.format(Math.round(diff / day), 'day');
    return formatDate(at, { day: 'numeric', month: 'short' });
}
