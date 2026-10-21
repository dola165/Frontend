import i18next from 'i18next';

/** Follow the app selection, not the OS/browser language. No i18n initialization side effects. */
export const appLanguage = () =>
    (i18next.resolvedLanguage ?? i18next.language ?? 'en').toLowerCase().startsWith('ka') ? 'ka' : 'en';
export const appLocale = () => (appLanguage() === 'ka' ? 'ka-GE' : 'en-GB');

// Formatter construction is expensive in dense calendars. Share a bounded set
// by locale/options; formatted values themselves remain fresh on every call.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatter = (options: Intl.DateTimeFormatOptions) => {
    const locale = appLocale();
    const key = `${locale}:${JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)))}`;
    let formatter = dateFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, options);
        if (dateFormatters.size >= 32) dateFormatters.delete(dateFormatters.keys().next().value!);
        dateFormatters.set(key, formatter);
    }
    return formatter;
};

const asDate = (value: string | Date) => {
    if (value instanceof Date) return value;
    // Calendar dates have no time zone. Parse them locally, never as UTC midnight.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
            ? date
            : new Date(NaN);
    }
    return new Date(value);
};

export const formatDate = (
    value: string | Date,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
) => {
    const date = asDate(value);
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter(options).format(date);
};
export const formatTime = (value: string | Date) => formatDate(value, { hour: '2-digit', minute: '2-digit' });
export const formatDateTime = (value: string | Date) =>
    formatDate(value, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatMoney = (value: number, currency = 'GEL') =>
    Number.isFinite(value)
        ? new Intl.NumberFormat(appLocale(), {
              style: 'currency',
              currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          }).format(value)
        : '—';
