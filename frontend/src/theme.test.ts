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
    it.each(['/calendar', '/profile/1', '/clubs/1/workspace', '/map'])('honours explicit modes on %s', route => {
        expect(themeForRoute('light', route)).toBe('light');
        expect(themeForRoute('dark', route)).toBe(route === '/map' ? 'light' : 'dark');
    });
    it('keeps the mixed preference light only on the authenticated map', () => {
        expect(themeForRoute('map-light', '/map')).toBe('light');
        expect(themeForRoute('map-light', '/calendar')).toBe('dark');
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
