export type ThemePreference = 'map-light' | 'dark' | 'light';

export const isThemePreference = (value: string | null): value is ThemePreference =>
    value === 'map-light' || value === 'dark' || value === 'light';

export function readThemePreference(storage?: Pick<Storage, 'getItem'>): ThemePreference {
    try {
        const source = storage ?? window.localStorage;
        const saved = source.getItem('theme-preference');
        if (isThemePreference(saved)) return saved;
        return source.getItem('theme') === 'light' ? 'light' : 'map-light';
    } catch {
        return 'map-light';
    }
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
