import { describe, expect, it } from 'vitest';
import { clubNavigationItems, normalizeClubNavigationTab } from '../../club/clubNavigation';
import { primaryProductNavigation, resolveNavigationKey, secondaryProductNavigation } from '../navigation';

describe('supported product navigation', () => {
    it('keeps contained features out of global navigation', () => {
        const destinations = [...primaryProductNavigation, ...secondaryProductNavigation];
        const paths = destinations.map((item) => item.path);

        expect(paths).toContain('/store');
        expect(paths).toContain('/stadiums');
        expect(paths).toContain('/campaigns');
        expect(paths).not.toContain('/marketplace');
        expect(paths).not.toContain('/agent');
    });

    it('does not label released production-backed destinations as previews', () => {
        const destinations = [...primaryProductNavigation, ...secondaryProductNavigation];

        expect(primaryProductNavigation.every((item) => !item.preview)).toBe(true);
        expect(destinations.find((item) => item.path === '/jobs')?.preview).toBeFalsy();
        expect(destinations.find((item) => item.path === '/tournaments')?.preview).toBeFalsy();
    });

    it('resolves preview routes to their active navigation items', () => {
        expect(resolveNavigationKey('/jobs', null)).toBe('jobs');
        expect(resolveNavigationKey('/jobs/42', null)).toBe('jobs');
        expect(resolveNavigationKey('/roles', null)).toBe('jobs');
        expect(resolveNavigationKey('/roles/42', null)).toBe('jobs');
        expect(resolveNavigationKey('/stadiums/42/manage', null)).toBe('my-organizations');
        expect(resolveNavigationKey('/tournaments/42', null)).toBe('tournaments');
        expect(resolveNavigationKey('/parent', null)).toBe('parent-hub');
        expect(resolveNavigationKey('/demo/commerce', null)).toBe('commerce-demo');
    });

    it('keeps the public club menu aligned with the supported club features', () => {
        expect(clubNavigationItems.map((item) => item.id)).toEqual([
            'overview', 'facilities', 'people', 'teams', 'schedule', 'events', 'honours', 'media', 'business', 'contact',
        ]);
    });

    it('maps legacy club links to their retained destinations', () => {
        expect(normalizeClubNavigationTab('honours')).toBe('honours');
        expect(normalizeClubNavigationTab('events')).toBe('events');
        expect(normalizeClubNavigationTab('pictures')).toBe('media');
        expect(normalizeClubNavigationTab('videos')).toBe('media');
        expect(normalizeClubNavigationTab('facilities')).toBe('facilities');
    });
});
