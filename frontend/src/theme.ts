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

export const themeForRoute = (preference: ThemePreference, pathname: string): 'light' | 'dark' =>
    pathname === '/map' || preference === 'light' ? 'light' : 'dark';

export function applyDocumentTheme(theme: 'light' | 'dark') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
}
