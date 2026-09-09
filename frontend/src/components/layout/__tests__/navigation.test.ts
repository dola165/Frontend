import { describe, expect, it } from 'vitest';
import { clubNavigationItems, normalizeClubNavigationTab } from '../../club/clubNavigation';
import { primaryProductNavigation, resolveNavigationKey, secondaryProductNavigation } from '../navigation';

describe('supported product navigation', () => {
    it('keeps contained features out of global navigation', () => {
        const destinations = [...primaryProductNavigation, ...secondaryProductNavigation];
        const paths = destinations.map((item) => item.path);

        expect(paths).toContain('/store');
        expect(paths).not.toContain('/campaigns');
        expect(paths).not.toContain('/marketplace');
        expect(paths).not.toContain('/agent');
    });

    it('labels partial public surfaces as previews', () => {
        const destinations = [...primaryProductNavigation, ...secondaryProductNavigation];

        expect(primaryProductNavigation.every((item) => !item.preview)).toBe(true);
        expect(destinations.find((item) => item.path === '/jobs')?.preview).toBe(true);
        expect(destinations.find((item) => item.path === '/tournaments')?.preview).toBe(true);
    });

    it('resolves preview routes to their active navigation items', () => {
        expect(resolveNavigationKey('/jobs', null)).toBe('jobs');
        expect(resolveNavigationKey('/tournaments/42', null)).toBe('tournaments');
    });

    it('keeps the public club menu focused on seven destinations', () => {
        expect(clubNavigationItems.map((item) => item.id)).toEqual([
            'overview', 'people', 'teams', 'schedule', 'media', 'store', 'business', 'contact',
        ]);
    });

    it('maps legacy club links to their retained destinations', () => {
        expect(normalizeClubNavigationTab('honours')).toBe('overview');
        expect(normalizeClubNavigationTab('events')).toBe('schedule');
        expect(normalizeClubNavigationTab('pictures')).toBe('media');
        expect(normalizeClubNavigationTab('videos')).toBe('media');
        expect(normalizeClubNavigationTab('facilities')).toBe('overview');
    });
});
