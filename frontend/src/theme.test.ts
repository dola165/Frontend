import { describe, expect, it } from 'vitest';
import { applyDocumentTheme, readThemePreference, themeForRoute } from './theme';

describe('account appearance', () => {
    it.each(['light', 'dark', 'map-light'] as const)('restores the explicit %s preference', preference => {
        expect(readThemePreference({ getItem: key => key === 'theme-preference' ? preference : 'light' })).toBe(preference);
    });
    it('migrates light users and recovers invalid or inaccessible storage', () => {
        expect(readThemePreference({ getItem: key => key === 'theme' ? 'light' : 'invalid' })).toBe('light');
        expect(readThemePreference({ getItem: () => { throw new Error('Storage unavailable'); } })).toBe('map-light');
    });
    it('honours explicit modes on every route', () => {
        expect(themeForRoute('light')).toBe('light');
        expect(themeForRoute('dark')).toBe('dark');
    });
    it('treats the stored map-light preference as dark everywhere, the World map included', () => {
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
