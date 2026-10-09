import { describe, expect, it } from 'vitest';
import { normalizeNavigationCapabilities } from '../../../../context/navigationCapabilities';
import { describeRoute, normalizePath } from '../pins/describeRoute';
import { myClub, primarySectionFor } from '../sections';

const coach = normalizeNavigationCapabilities({ version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 1, label: 'FC Dinamo Tbilisi Academy' } },
    { id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } },
] }, 1);

describe('primary tabs', () => {
    it('sends staff to their club workspace and members to the club page', () => {
        expect(myClub(coach, 1)).toEqual({ ids: [1], path: '/clubs/1/workspace' });
        const player = normalizeNavigationCapabilities({ version: 1, workspaces: [{ id: 'club.player', context: { type: 'club', id: 7, label: 'Riverside' } }] }, 2);
        expect(myClub(player, null)).toEqual({ ids: [7], path: '/clubs/7' });
    });

    it('keeps My Club for a membership the capability list does not describe, and hides it without a club', () => {
        expect(myClub(normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 3), 9)).toEqual({ ids: [9], path: '/clubs/9' });
        expect(myClub(normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 3), null).path).toBeNull();
    });

    it('marks discovery as World and the person’s own club as My Club', () => {
        for (const path of ['/world', '/map', '/clubs', '/clubs/3', '/stadiums/202', '/people', '/matches', '/tournaments/301', '/jobs', '/roles', '/events', '/tryouts', '/admissions/opportunities', '/match-exchange/4']) {
            expect(primarySectionFor(path, [1])).toBe('world');
        }
        for (const path of ['/clubs/1', '/clubs/1/workspace', '/squads', '/squads/105', '/my-club']) expect(primarySectionFor(path, [1])).toBe('my-club');
        expect(primarySectionFor('/home', [1])).toBe('home');
        expect(primarySectionFor('/calendar', [1])).toBeNull();
        expect(primarySectionFor('/tournaments/301/workspace', [1])).toBeNull();
    });
});

describe('pin labels', () => {
    const context = { capabilities: coach, userId: 1, myClubPath: '/clubs/1/workspace' };

    it('keeps only the query values that change what a page shows', () => {
        expect(normalizePath('/clubs/1/workspace/', '?tab=attendance&dialog=open')).toBe('/clubs/1/workspace?tab=attendance');
    });

    it('names pages from the route where it can and defers to the page title elsewhere', () => {
        expect(describeRoute('/squads/105', '', context)).toMatchObject({ label: 'U16 Boys', icon: 'squad', pinnable: true });
        expect(describeRoute('/profile/1', '', context)).toMatchObject({ label: 'My profile', icon: 'person' });
        expect(describeRoute('/calendar', '', context)).toMatchObject({ label: 'My schedule', icon: 'calendar' });
        expect(describeRoute('/matches', '?section=fixtures', context).label).toBe('Matches & competitions · Fixtures');
        expect(describeRoute('/world', '?q=u10%20academy', context).label).toBe('World: u10 academy');
        expect(describeRoute('/clubs/1/workspace', '?tab=attendance', context)).toMatchObject({ label: null, icon: 'workspace' });
        expect(describeRoute('/tournaments/301', '', context)).toMatchObject({ label: null, icon: 'trophy' });
    });

    it('does not offer to pin what the header already holds', () => {
        for (const path of ['/home', '/world', '/messages', '/requests', '/notifications', '/clubs/1/workspace']) expect(describeRoute(path, '', context).pinnable).toBe(false);
    });
});
