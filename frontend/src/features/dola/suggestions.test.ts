import { describe, expect, it } from 'vitest';
import { chooseDolaContext, dolaContexts, dolaSuggestions, normalizeDolaContexts, dolaFollowUps } from './suggestions';

describe('role-specific Dola starters', () => {
    it('keeps family starters focused even when coaching is available', () => {
        const context = chooseDolaContext(['family', 'coach', 'referee', 'discover'], '/parent');
        expect(context).toBe('family');
        expect(dolaSuggestions(context, false).join(' ')).not.toContain('coach update');
        expect(dolaSuggestions(context, false)[0]).toContain('my children');
    });
    it('uses the current workspace and preserves an explicit choice', () => {
        expect(chooseDolaContext(['family', 'referee', 'discover'], '/referees/me')).toBe('referee');
        expect(chooseDolaContext(['family', 'referee', 'discover'], '/referees/me', 'family')).toBe('family');
        expect(chooseDolaContext(['agent', 'discover'], '/agent')).toBe('agent');
        expect(chooseDolaContext(['coach', 'organization', 'discover'], '/clubs/7/workspace')).toBe('organization');
    });
    it('uses venue management context only when currently granted', () => {
        expect(chooseDolaContext(['organization', 'venue', 'discover'], '/stadiums/133/manage')).toBe('venue');
        expect(chooseDolaContext(['discover'], '/stadiums/133/manage')).toBe('discover');
        expect(dolaSuggestions('venue', false)[0]).toContain('my venues');
        expect(dolaFollowUps(['venue-booking', 'venue-availability'], false)).toHaveLength(2);
    });
    it('drops unavailable contexts and never infers coaching from a URL', () => {
        expect(chooseDolaContext(['discover'], '/squads/13', 'coach')).toBe('discover');
        expect(normalizeDolaContexts(['club.workspace', 'ADMIN', 'referee', 'referee'])).toEqual(['referee', 'discover']);
        expect(normalizeDolaContexts(null)).toEqual(['discover']);
    });
    it('offers three localized starters per context without irrelevant coaching prompts', () => {
        for (const context of dolaContexts) {
            expect(dolaSuggestions(context, false)).toHaveLength(3);
            expect(dolaSuggestions(context, true).every(prompt => /[ა-ჰ]/.test(prompt))).toBe(true);
            if (context !== 'coach') expect(dolaSuggestions(context, false).join(' ')).not.toContain('write a coach');
        }
        expect(dolaSuggestions('discover', false).join(' ')).not.toContain('my next squad');
        expect(dolaSuggestions('referee', false)[0]).toContain('accepted referee appointments');
    });
    it('only shows recognized follow-up prompts and removes duplicates', () => {
        expect(dolaFollowUps(['referee-response', 'https://evil.test', 'referee-response'], false)).toEqual(['Help me respond to a referee invitation.']);
    });
});
