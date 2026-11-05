import { describe, expect, it } from 'vitest';
import { applyDocumentTheme, chooseThemePreference, readThemePreference, themeForRoute, THEME_CHOSEN_KEY } from './theme';

const stored = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });

describe('account appearance', () => {
    it('is light for someone who never chose', () => {
        expect(readThemePreference(stored({}))).toBe('light');
        // The app stored map-light (its dark) on every visit until 27 October 2026: without the mark it is not a choice.
        expect(readThemePreference(stored({ 'theme-preference': 'map-light', theme: 'dark' }))).toBe('light');
        expect(readThemePreference({ getItem: () => { throw new Error('Storage unavailable'); } })).toBe('light');
    });
    it.each(['light', 'dark', 'map-light'] as const)('keeps the chosen %s preference', preference => {
        expect(readThemePreference(stored({ 'theme-preference': preference, [THEME_CHOSEN_KEY]: '1' }))).toBe(preference);
    });
    it('keeps dark, which is stored only when picked (the Android app’s own setting)', () => {
        expect(readThemePreference(stored({ 'theme-preference': 'dark' }))).toBe('dark');
    });
    it('stores a choice with its mark and the legacy key', () => {
        const values: Record<string, string> = {};
        chooseThemePreference('dark', { setItem: (key, value) => { values[key] = value; } });
        expect(values).toEqual({ 'theme-preference': 'dark', [THEME_CHOSEN_KEY]: '1', theme: 'dark' });
        expect(readThemePreference(stored(values))).toBe('dark');
    });
    it('honours explicit modes on every route', () => {
        expect(themeForRoute('light')).toBe('light');
        expect(themeForRoute('dark')).toBe('dark');
        expect(themeForRoute('map-light')).toBe('dark');
    });
    it('updates both the CSS variant and native-control theme when switching in place', () => {
        applyDocumentTheme('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.dataset.theme).toBe('dark');
        applyDocumentTheme('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.dataset.theme).toBe('light');
    });
});
