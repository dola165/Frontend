export type ThemePreference = 'map-light' | 'dark' | 'light';

export const isThemePreference = (value: string | null): value is ThemePreference =>
    value === 'map-light' || value === 'dark' || value === 'light';

/** Set only when the person picked an appearance; without it the stored value is an old default, not a choice. */
export const THEME_CHOSEN_KEY = 'theme-chosen';

/**
 * Light unless the person chose dark (owner, 27 October 2026). Until then the app stored 'map-light' (its name for
 * dark) on every visit, chosen or not, so a stored value counts only with the chosen mark; 'dark' is also kept, since
 * it is only ever stored when picked (the Android app's own setting).
 */
export function readThemePreference(storage?: Pick<Storage, 'getItem'>): ThemePreference {
    try {
        const source = storage ?? window.localStorage;
        const saved = source.getItem('theme-preference');
        if (hasChosenTheme(source) && isThemePreference(saved)) return saved;
        return saved === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

/** Whether the person ever picked an appearance on this device. */
export function hasChosenTheme(storage?: Pick<Storage, 'getItem'>) {
    try { return (storage ?? window.localStorage).getItem(THEME_CHOSEN_KEY) === '1'; } catch { return false; }
}

/** The person picked an appearance: kept with its mark, and under the original key for older clients. */
export function chooseThemePreference(value: ThemePreference, storage?: Pick<Storage, 'setItem'>) {
    try {
        const target = storage ?? window.localStorage;
        target.setItem('theme-preference', value);
        target.setItem(THEME_CHOSEN_KEY, '1');
        target.setItem('theme', value === 'light' ? 'light' : 'dark');
    } catch { /* The choice still applies for this visit. */ }
}

/**
 * Every route follows the person's appearance. The World map used to stay light; it now sits
 * under the World navigation and follows the theme like its other pages, so 'map-light' is
 * kept only as the stored name of the dark preference.
 */
export const themeForRoute = (preference: ThemePreference): 'light' | 'dark' =>
    preference === 'light' ? 'light' : 'dark';

export function applyDocumentTheme(theme: 'light' | 'dark') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
}
