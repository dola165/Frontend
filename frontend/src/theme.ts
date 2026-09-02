export type ThemePreference = 'map-light' | 'dark' | 'light';

export const isThemePreference = (value: string | null): value is ThemePreference =>
    value === 'map-light' || value === 'dark' || value === 'light';

