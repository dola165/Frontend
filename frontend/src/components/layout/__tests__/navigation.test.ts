import { describe, expect, it } from 'vitest';
import { clubNavigationItems, normalizeClubNavigationTab } from '../../club/clubNavigation';
import { isNavigationDestinationActive, primaryProductNavigation, resolveNavigationKey, secondaryProductNavigation } from '../navigation';

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
        expect(resolveNavigationKey('/stadiums/42/manage', null)).toBe('my-venues');
        expect(resolveNavigationKey('/tournaments/42', null)).toBe('matches');
        expect(resolveNavigationKey('/tournaments/setup', null)).toBe('matches');
        expect(resolveNavigationKey('/match-exchange/42', null)).toBe('matches');
        expect(resolveNavigationKey('/parent', null)).toBe('parent-hub');
        expect(resolveNavigationKey('/demo/commerce', null)).toBe('commerce-demo');
    });

    it('keeps the public club menu aligned with the supported club features', () => {
        expect(clubNavigationItems.map((item) => item.id)).toEqual([
            'overview', 'posts', 'facilities', 'people', 'teams', 'schedule', 'events', 'honours', 'media', 'business', 'contact',
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

it('distinguishes venue, organization, agent, request and public discovery destinations', () => {
    expect(resolveNavigationKey('/my-organizations', null, { search: '?kind=VENUE' })).toBe('my-venues');
    expect(resolveNavigationKey('/my-organizations', null)).toBe('my-organizations');
    expect(resolveNavigationKey('/stadiums/42', null)).toBe('stadiums');
    expect(resolveNavigationKey('/organizations/42', null, { venueIds: [42] })).toBe('my-venues');
    expect(resolveNavigationKey('/organizations/43', null, { venueIds: [42] })).toBe('my-organizations');
    expect(resolveNavigationKey('/agent', null)).toBe('agent-hub');
    expect(resolveNavigationKey('/parent/enrollment', null)).toBe('parent-hub');
    expect(resolveNavigationKey('/requests', null)).toBe('requests');
    expect(resolveNavigationKey('/tryouts/51', null)).toBe('tryouts');
    expect(resolveNavigationKey('/events', null)).toBe('events');
    expect(secondaryProductNavigation.find(item => item.path === '/tryouts')?.authRequired).toBe(false);
});
it('recognizes every approved club and avoids prefix collisions with unrelated clubs', () => {
    const context = { clubIds: [1, 121] };
    expect(resolveNavigationKey('/clubs/121/workspace', 1, context)).toBe('my-club');
    expect(resolveNavigationKey('/clubs/121', 1, context)).toBe('my-club');
    expect(resolveNavigationKey('/clubs/1210', 1, context)).toBe('clubs');
    expect(isNavigationDestinationActive({ id: 'clubs', path: '/clubs' }, '/clubs/121', '', 'my-club')).toBe(false);
});
it('marks scoped workspace shortcuts by their path and required query', () => {
    const item = { id: 'tournament.create:organization:1', path: '/tournaments/setup?organizer=1' };
    expect(isNavigationDestinationActive(item, '/tournaments/setup', '?organizer=1&step=teams', 'tournament-setup')).toBe(true);
    expect(isNavigationDestinationActive(item, '/tournaments/setup', '?organizer=121', 'tournament-setup')).toBe(false);
    const workspace = { id: 'club.workspace:club:1', path: '/clubs/1/workspace' };
    expect(isNavigationDestinationActive(workspace, '/clubs/1/workspace', '?tab=personnel', 'my-club')).toBe(true);
    expect(isNavigationDestinationActive(workspace, '/clubs/11/workspace', '', 'clubs')).toBe(false);
});
