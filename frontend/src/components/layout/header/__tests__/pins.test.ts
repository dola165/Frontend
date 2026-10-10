import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearStoredAuth } from '../../../../utils/authStorage';
import { fitPins, VISIBLE_PINS } from '../pins/fitPins';
import { MAX_PINS, readPins, readVisits, recordVisit, writePins, type Pin } from '../pins/pinStore';

// The store caches per account, so every case uses its own account id.
let nextUser = 100;
const account = () => nextUser++;
const pin = (index: number): Pin => ({ path: `/squads/${index}`, label: `Squad ${index}`, icon: 'squad' });

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('pin store', () => {
    it('keeps each account’s pins apart', () => {
        const first = account(), second = account();
        writePins(first, [pin(1)]);
        writePins(second, [pin(2), pin(3)]);
        expect(readPins(first).map(item => item.path)).toEqual(['/squads/1']);
        expect(readPins(second).map(item => item.path)).toEqual(['/squads/2', '/squads/3']);
        expect(JSON.parse(localStorage.getItem(`gk-pins:v1:${first}`)!)).toEqual({ pins: [pin(1)] });
    });

    it('drops malformed and unsafe entries one by one and keeps the rest', () => {
        const user = account();
        localStorage.setItem(`gk-pins:v1:${user}`, JSON.stringify({ pins: [
            pin(1), { path: '//evil.example', label: 'Away', icon: 'squad' }, { path: 'relative', label: 'No slash', icon: 'squad' },
            { path: '/calendar', label: '   ', icon: 'calendar' }, null, pin(1), { path: '/store', label: 'Store', icon: 'not-an-icon' },
        ] }));
        expect(readPins(user)).toEqual([pin(1), { path: '/store', label: 'Store', icon: 'bookmark' }]);
    });

    it('treats unreadable JSON and storage that throws as no pins, and still works for the visit', () => {
        const broken = account();
        localStorage.setItem(`gk-pins:v1:${broken}`, '{not json');
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

    it('forgets visit history when the sign-in changes, but keeps pins', () => {
        const user = account();
        writePins(user, [pin(1)]);
        recordVisit(user, '/tournaments/301', 'trophy', 'Tbilisi Cup');
        expect(Object.keys(readVisits(user))).toEqual(['/tournaments/301']);
        clearStoredAuth();
        expect(localStorage.getItem(`gk-visits:v1:${user}`)).toBeNull();
        expect(readVisits(user)).toEqual({});
        expect(readPins(user)).toEqual([pin(1)]);
    });
});

describe('fitting pins into the header', () => {
    const space = { pins: [110, 110, 130, 120, 90, 100, 90, 90], more: 100, plus: 48, gap: 4, searchField: 300 };

    it('shows as many pins as fit, keeping room for "more"', () => {
        expect(fitPins({ ...space, available: 2000 }, false)).toEqual({ fit: VISIBLE_PINS, crowded: false });
        expect(fitPins({ ...space, available: 500 }, false).fit).toBe(2);
        expect(fitPins({ ...space, available: 100 }, false).fit).toBe(0);
    });

    it('collapses search only when the pins would not fit beside the field, and does not flip back once it has', () => {
        const wide = fitPins({ ...space, available: 700 }, false);
        expect(wide.crowded).toBe(true);
        // With search collapsed the pins gain the field's width, and the header stays crowded rather than oscillating.
        expect(fitPins({ ...space, available: 700 + 300 - 44 }, true)).toEqual({ fit: VISIBLE_PINS, crowded: true });
        expect(fitPins({ ...space, pins: [110, 90], available: 700 }, false)).toEqual({ fit: 2, crowded: false });
    });

    it('never asks search to collapse where there is no field to collapse', () => {
        expect(fitPins({ ...space, searchField: 0, available: 300 }, false).crowded).toBe(false);
    });
});
