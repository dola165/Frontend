import { describe, expect, it } from 'vitest';
import { hasFullMapAccess } from '../mapAccess';

describe('hasFullMapAccess', () => {
    it.each(['COACH', 'CLUB_ADMIN', 'ORGANIZER', 'AGENT', 'ADMIN', 'SYSTEM_ADMIN'])(
        'gives the %s account role the full map without membership context',
        (role) => expect(hasFullMapAccess(role, null)).toBe(true)
    );

    it.each(['PLAYER', 'FAN', undefined])('keeps %s on club-only discovery', (role) => {
        expect(hasFullMapAccess(role, null)).toBe(false);
    });

    it('recognizes staff membership for otherwise restricted accounts', () => {
        expect(hasFullMapAccess('PLAYER', 'COACH')).toBe(true);
    });
});
