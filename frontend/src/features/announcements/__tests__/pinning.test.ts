import { describe, expect, it } from 'vitest';
import { dayText, expiryFor, isPinned, pinnedText, pinnedUntil } from '../pinning';

const now = new Date(2026, 9, 10, 9, 30); // Saturday 10 October 2026, 09:30 local
const message = (created: Date, expires: Date | null) => ({ kind: 'ANNOUNCEMENT' as const, created_at: created.toISOString(), expires_at: expires?.toISOString() ?? null });

describe('how long an announcement stays pinned', () => {
    it('pins until the end of the chosen day', () => {
        expect(expiryFor('1', '', now)).toEqual(new Date(2026, 9, 11, 23, 59));
        expect(expiryFor('7', '', now)).toEqual(new Date(2026, 9, 17, 23, 59));
        expect(expiryFor('date', '2026-10-21', now)).toEqual(new Date(2026, 9, 21, 23, 59));
        expect(expiryFor('date', '', now)).toBeNull();
    });
    it('keeps older announcements without an expiry pinned for a week from posting', () => {
        const old = message(new Date(2026, 9, 1, 12), null);
        expect(pinnedUntil(old)).toEqual(new Date(2026, 9, 8, 12));
        expect(isPinned(old, now.getTime())).toBe(false);
        expect(isPinned(message(new Date(2026, 9, 9, 12), null), now.getTime())).toBe(true);
    });
    it('says until when, in words', () => {
        expect(dayText(new Date(2026, 9, 10, 23, 59), now)).toBe('today');
        expect(dayText(new Date(2026, 9, 11, 23, 59), now)).toBe('tomorrow');
        expect(pinnedText(message(new Date(2026, 9, 9), new Date(2026, 9, 16, 23, 59)), now)).toMatch(/^Pinned until Fri,? 16 Oct$/);
        expect(pinnedText(message(new Date(2026, 9, 1), new Date(2026, 9, 5)), now)).toBe('No longer pinned');
    });
});
