import { describe, expect, it } from 'vitest';
import { normalizeNavigationCapabilities } from '../../../../context/navigationCapabilities';
import { describeRoute, normalizePath, pinLabel } from '../pins/describeRoute';
import { exploreDestinations, workDestinations, workspaceDestinations } from '../pins/pinCatalog';
import { workSuggestions } from '../pins/usePins';
import { myClub, primarySectionFor } from '../sections';

const coach = normalizeNavigationCapabilities({ version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 1, label: 'FC Dinamo Tbilisi Academy' } },
    { id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } },
] }, 1);
const georgian = (_english: string, ka: string) => ka;
const english = (en: string) => en;

describe('primary tabs', () => {
    it('sends staff to their club workspace and members to the club page', () => {
        expect(myClub(coach, 1)).toEqual({ ids: [1], path: '/clubs/1' });
        const player = normalizeNavigationCapabilities({ version: 1, workspaces: [{ id: 'club.player', context: { type: 'club', id: 7, label: 'Riverside' } }] }, 2);
        expect(myClub(player, null)).toEqual({ ids: [7], path: '/clubs/7' });
    });

    it('keeps the workspace as My Club when a membership elsewhere loads later, so the tab never changes target', () => {
        const staffAndMember = normalizeNavigationCapabilities({ version: 1, workspaces: [
            { id: 'club.workspace', context: { type: 'club', id: 1, label: 'Dinamo' } },
            { id: 'club.player', context: { type: 'club', id: 7, label: 'Riverside' } },
        ] }, 2);
        expect(myClub(staffAndMember, null).path).toBe('/clubs/1');
        expect(myClub(staffAndMember, 7).path).toBe('/clubs/1');
    });

    it('keeps My Club for a membership the capability list does not describe, and hides it without a club', () => {
        expect(myClub(normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 3), 9)).toEqual({ ids: [9], path: '/clubs/9' });
        expect(myClub(normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 3), null).path).toBeNull();
    });

    it('marks discovery as World and the person’s own club as My Club', () => {
        for (const path of ['/world', '/map', '/clubs', '/clubs/3', '/stadiums/202', '/people', '/matches', '/tournaments/301', '/jobs', '/roles', '/events', '/tryouts', '/admissions/opportunities', '/match-exchange/4', '/store', '/campaigns']) {
            expect(primarySectionFor(path, [1])).toBe('world');
        }
        for (const path of ['/clubs/1', '/clubs/1/workspace', '/my-club']) expect(primarySectionFor(path, [1])).toBe('my-club');
        for (const path of ['/my-squads', '/squads', '/squads/105']) expect(primarySectionFor(path, [1])).toBe('my-squads');
        // A parent on the shared squad page, arriving from Parent Hub with the child in the address.
        expect(primarySectionFor('/squads/105', [1], '?player=4')).toBe('parent-hub');
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

    it('drops tracking and carried context from World addresses but keeps searches and filters', () => {
        expect(normalizePath('/world/clubs', '?utm_source=fb&fbclid=x&gclid=y&near=tbilisi&q=u10&age=U10')).toBe('/world/clubs?age=U10&q=u10');
    });

    it('names pages from the route where it can and defers to the page title elsewhere', () => {
        expect(describeRoute('/squads/105', '', context)).toMatchObject({ label: 'U16 Boys', icon: 'squad', pinnable: true });
        expect(describeRoute('/profile/1', '', context)).toMatchObject({ label: 'My profile', icon: 'person' });
        expect(describeRoute('/calendar', '', context)).toMatchObject({ label: 'My schedule', icon: 'calendar' });
        expect(describeRoute('/matches', '?section=fixtures', context).label).toBe('Matches · Fixtures');
        expect(describeRoute('/world', '?q=u10%20academy', context)).toMatchObject({ label: 'World: u10 academy', pinnable: true });
        expect(describeRoute('/clubs/1/workspace', '?tab=attendance', context)).toMatchObject({ label: null, icon: 'workspace' });
        expect(describeRoute('/tournaments/301', '', context)).toMatchObject({ label: null, icon: 'trophy' });
    });

    it('names World directories and their tabs as World does', () => {
        expect(describeRoute('/world/clubs', '', context)).toMatchObject({ label: 'Clubs', icon: 'club' });
        expect(describeRoute('/world/opportunities', '?type=trials', context).label).toBe('Trials');
        expect(describeRoute('/world/matches', '?tab=events', context).label).toBe('Events');
        expect(describeRoute('/world/venues', '?q=futsal', context).label).toBe('Venues: futsal');
        expect(describeRoute('/world/clubs', '?age=U10', context).label).toBe('Clubs · filtered');
    });

    it('gives one destination one name: the referee workspace is never "Officiating"', () => {
        expect(describeRoute('/referees/me', '', context).label).toBe('Referee workspace');
        const referee = normalizeNavigationCapabilities({ version: 1, workspaces: [{ id: 'referee.workspace', context: { type: 'user', id: 4, label: 'Referee' } }] }, 4);
        expect(workSuggestions(referee, null, english).find(item => item.path === '/referees/me')?.label).toBe('Referee workspace');
    });

    it('resolves labels in the current language when shown, whatever language they were pinned in', () => {
        expect(describeRoute('/calendar', '', { ...context, copy: georgian }).label).toBe('ჩემი განრიგი');
        expect(pinLabel('/world/opportunities?type=trials', 'Trials', { myClubPath: null, copy: georgian })).toBe('გასინჯვები');
        // A page named from its title keeps the title it was pinned with.
        expect(pinLabel('/tournaments/301', 'Tbilisi Cup', { myClubPath: null, copy: georgian })).toBe('Tbilisi Cup');
    });

    it('does not offer to pin what the header already holds', () => {
        for (const path of ['/home', '/world', '/messages', '/requests', '/notifications', '/clubs/1/workspace']) expect(describeRoute(path, '', context).pinnable).toBe(false);
        // The workspace overview is the My Club tab itself.
        expect(describeRoute('/clubs/1/workspace', '?tab=overview', context).pinnable).toBe(false);
    });
});

describe('work and explore catalogues', () => {
    const director = normalizeNavigationCapabilities({ version: 1, workspaces: [
        { id: 'club.workspace', context: { type: 'club', id: 1, label: 'Dinamo' } },
        { id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } },
        { id: 'tournament.workspace', context: { type: 'tournament', id: 301, label: 'Tbilisi Cup' } },
        { id: 'organization.workspace', context: { type: 'organization', id: 77, label: 'GFF East' } },
        { id: 'admin.console', context: { type: 'user', id: 9, label: 'Admin' } },
    ] }, 9);

    it('lists every workspace except the My Club tab and Administration, which have their own places', () => {
        expect(workspaceDestinations(director, '/clubs/1/workspace').map(place => [place.path, place.label, place.kind])).toEqual([
            ['/squads/105', 'U16 Boys', 'Squad'],
            ['/tournaments/301/workspace', 'Tbilisi Cup', 'Tournament'],
            ['/organizations/77/workspace', 'GFF East', 'Organization'],
        ]);
    });

    it('suggests squads, tournaments and organizations from the start, without pinning anything', () => {
        expect(workSuggestions(director, '/clubs/1/workspace', english).map(item => item.path)).toEqual(['/squads/105', '/tournaments/301/workspace', '/organizations/77/workspace']);
        expect(workSuggestions(director, '/clubs/1/workspace', english).every(item => item.visits === null && item.reason)).toBe(true);
    });

    it('keeps the rest of the person’s work in "Your work"', () => {
        const paths = workDestinations(director, '/clubs/1/workspace').map(item => item.path);
        expect(paths).toEqual(expect.arrayContaining(['/clubs/1', '/squads', '/calendar', '/admissions', '/squads/105']));
        expect(paths).not.toContain('/clubs/1/workspace');
    });

    it('names explore destinations exactly as their pins are named, and marks sign-in-only ones', () => {
        for (const item of exploreDestinations(georgian)) expect(pinLabel(item.path, undefined, { myClubPath: null, copy: georgian })).toBe(item.label);
        expect(exploreDestinations().filter(item => item.signedIn).map(item => item.path)).toEqual(['/clubs/following']);
        expect(exploreDestinations().filter(item => item.group === 'support').map(item => item.label)).toEqual(['Store', 'Campaigns', 'Followed clubs']);
    });
});
