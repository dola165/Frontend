import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../api/axiosConfig';
import { loadPreferences } from '../../../../features/preferences/preferencesStore';
import { clearStoredAuth } from '../../../../utils/authStorage';
import { fitPins, VISIBLE_PINS } from '../pins/fitPins';
import { MAX_PINS, readPins, readVisits, recordVisit, writePins, type Pin } from '../pins/pinStore';

// Pins are saved with the preferences on the server: a fake one per account (the signed-in one is `server.current`).
const server = vi.hoisted(() => ({ docs: new Map<number, Record<string, unknown>>(), current: 0 }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: {
    get: vi.fn(async () => ({ data: server.docs.get(server.current) ?? {} })),
    put: vi.fn(async (_url: string, body: Record<string, unknown>) => {
        const doc = { ...server.docs.get(server.current), ...body };
        server.docs.set(server.current, doc);
        return { data: doc };
    }),
} }));

// The store caches per account, so every case uses its own account id.
let nextUser = 100;
const account = () => (server.current = nextUser++);
const pin = (index: number): Pin => ({ path: `/squads/${index}`, label: `Squad ${index}`, icon: 'squad' });

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('pin store', () => {
    it('keeps each account’s pins apart and saves them for the person', async () => {
        const first = account();
        writePins(first, [pin(1)]);
        await vi.waitFor(() => expect(server.docs.get(first)).toEqual({ pins: { pins: [pin(1)] } }));
        const second = account();
        writePins(second, [pin(2), pin(3)]);
        expect(readPins(first).map(item => item.path)).toEqual(['/squads/1']);
        expect(readPins(second).map(item => item.path)).toEqual(['/squads/2', '/squads/3']);
        await vi.waitFor(() => expect(apiClient.put).toHaveBeenLastCalledWith('/users/me/preferences', { pins: { pins: [pin(2), pin(3)] } }));
    });

    it('drops malformed and unsafe entries one by one and keeps the rest', async () => {
        const user = account();
        server.docs.set(user, { pins: { pins: [
            pin(1), { path: '//evil.example', label: 'Away', icon: 'squad' }, { path: 'relative', label: 'No slash', icon: 'squad' },
            { path: '/calendar', label: '   ', icon: 'calendar' }, null, pin(1), { path: '/store', label: 'Store', icon: 'not-an-icon' },
        ] } });
        await loadPreferences(user);
        expect(readPins(user)).toEqual([pin(1), { path: '/store', label: 'Store', icon: 'bookmark' }]);
    });

    it('migrates saved page links, removes retired pages and deduplicates their replacements', async () => {
        const user = account();
        const saved = ['/roles/704', '/people?tab=players', '/account/roles#professions', '/agents/7', '/agent/dashboard', '/clubs/following', '/my-squads', '/squads', '/join-squad', '/matches', '/tournament-series/2'];
        server.docs.set(user, { pins: { pins: saved.map(path => ({ path, label: 'Saved page', icon: 'bookmark' })) } });
        await loadPreferences(user);
        expect(readPins(user).map(item => item.path)).toEqual(['/jobs/704', '/world/people?tab=players', '/account/football#work', '/profile/7?tab=career', '/agent', '/world/clubs?view=following', '/my-squads']);
    });

    it('migrates visit suggestions and cannot record a new visit to a retired page', () => {
        const user = account(), now = Date.now();
        localStorage.setItem(`gk-visits:v1:${user}`, JSON.stringify({
            '/roles/704': { t: [now - 2000, now - 1000], label: 'Job' },
            '/jobs/704': { t: [now - 500], label: 'Job' },
            '/join-squad': { t: [now - 2000, now - 1000, now], label: 'Gone' },
        }));
        expect(readVisits(user)).toEqual({ '/jobs/704': { t: [now - 2000, now - 1000, now - 500], label: 'Job' } });
        recordVisit(user, '/join-squad', 'bookmark', 'Gone');
        expect(readVisits(user)['/join-squad']).toBeUndefined();
    });

    it('treats an unreadable copy and storage that throws as no pins, and still works for the visit', () => {
        const broken = account();
        localStorage.setItem(`gk-prefs:v1:${broken}`, '{not json');
        expect(readPins(broken)).toEqual([]);

        const blocked = account();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(readPins(blocked)).toEqual([]);
        expect(() => writePins(blocked, [pin(1)])).not.toThrow();
        expect(readPins(blocked)).toEqual([pin(1)]);
    });

    it('keeps at most twelve pins', () => {
        const user = account();
        writePins(user, Array.from({ length: MAX_PINS + 3 }, (_, index) => pin(index)));
        expect(readPins(user)).toHaveLength(MAX_PINS);
    });

    it('counts a page once per ten minutes and stores no label for pages the route can name', () => {
        const user = account();
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
        recordVisit(user, '/squads/105', 'squad', null);
        recordVisit(user, '/squads/105', 'squad', null);
        now.mockReturnValue(1_000_000_000_000 + 11 * 60 * 1000);
        recordVisit(user, '/squads/105', 'squad', null);
        expect(readVisits(user)['/squads/105']).toEqual({ t: [1_000_000_000_000, 1_000_000_000_000 + 11 * 60 * 1000], icon: 'squad' });
    });

    it('forgets visits and the local pins at sign-out; the pins come back from the server', async () => {
        const user = account();
        writePins(user, [pin(1)]);
        await vi.waitFor(() => expect(server.docs.get(user)).toEqual({ pins: { pins: [pin(1)] } }));
        recordVisit(user, '/tournaments/301', 'trophy', 'Tbilisi Cup');
        expect(Object.keys(readVisits(user))).toEqual(['/tournaments/301']);
        clearStoredAuth();
        expect(localStorage.getItem(`gk-visits:v1:${user}`)).toBeNull();
        expect(localStorage.getItem(`gk-prefs:v1:${user}`)).toBeNull();
        expect(readVisits(user)).toEqual({});
        expect(readPins(user)).toEqual([]);
        await loadPreferences(user);
        expect(readPins(user)).toEqual([pin(1)]);
    });

    it('carries pins kept only on this device over once', async () => {
        const user = account();
        localStorage.setItem(`gk-pins:v1:${user}`, JSON.stringify({ pins: [pin(4), { path: '//evil.example', label: 'Away', icon: 'squad' }] }));
        await loadPreferences(user);
        expect(readPins(user)).toEqual([pin(4)]);
        await vi.waitFor(() => expect(server.docs.get(user)).toEqual({ pins: { pins: [pin(4)] } }));
        expect(localStorage.getItem(`gk-pins:v1:${user}`)).toBeNull();
    });
});

describe('fitting pins into the header', () => {
    const space = { pins: [110, 110, 130, 120, 90, 100, 90, 90], more: 100, plus: 48, gap: 4, searchField: 300 };

    const room = (available: number, collapsed = available) => ({ ...space, available, collapsed });

    it('shows as many pins as fit, keeping room for "more"', () => {
        expect(fitPins(room(2000))).toEqual({ fit: VISIBLE_PINS, crowded: false });
        expect(fitPins(room(500)).fit).toBe(2);
        expect(fitPins(room(100)).fit).toBe(0);
    });

    it('collapses search only when the pins would not fit beside the field, then uses the room it gives', () => {
        expect(fitPins(room(700, 700 + 300 - 44))).toEqual({ fit: VISIBLE_PINS, crowded: true });
        expect(fitPins({ ...room(700), pins: [110, 90] })).toEqual({ fit: 2, crowded: false });
    });

    it('settles in one state whichever state it is in now (the tabs used to shake between a pin and "1 pin")', () => {
        // Very wide screens count the wider side twice, so collapsing a 400px field gives a single pin far more room.
        const one = { ...room(250, 250 + 2 * (400 - 44)), pins: [220], searchField: 400 };
        const settled = fitPins(one);
        expect(settled).toEqual({ fit: 1, crowded: true });
        for (const now of [{ fit: 0, crowded: false }, { fit: 1, crowded: false }, { fit: 0, crowded: true }, settled]) expect(fitPins(one, now)).toEqual(settled);
    });

    it('needs a few pixels to spare before showing more than now, so rounding never flips it back', () => {
        const edge = { ...room(276, 276), pins: [220], searchField: 0 };
        expect(fitPins(edge, { fit: 1, crowded: false }).fit).toBe(1);
        expect(fitPins(edge, { fit: 0, crowded: false }).fit).toBe(0);
    });

    it('never asks search to collapse where there is no field to collapse', () => {
        expect(fitPins({ ...room(300), searchField: 0 }).crowded).toBe(false);
    });
});
