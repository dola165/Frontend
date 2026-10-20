import { describe, expect, it } from 'vitest';
import { cardSteps, closed, done, opened, skipped, stepFromParam, stepFromStored } from './welcomeSteps';

describe('the setup steps', () => {
    it('are the same five for everyone; old addresses and saved progress land on the step that replaced theirs', () => {
        expect(['roles', 'about', 'clubs', 'profile', 'page'].map(stepFromParam)).toEqual(['roles', 'about', 'clubs', 'profile', 'page']);
        expect(['club', 'follow', 'child', 'tournament', 'venue', 'business', 'nope'].map(stepFromParam))
            .toEqual(['clubs', 'clubs', 'page', 'page', 'page', 'page', null]);
        expect(stepFromStored('PAGE')).toBe('page');
        expect(stepFromStored('FOLLOW')).toBe('clubs');
        expect(stepFromStored('ABOUT')).toBe('about');
        expect(stepFromStored('CHILD')).toBe('page');
        expect(stepFromStored(null)).toBeNull();
    });

    it('remember skipped steps once, never the profile or page offers, and forget what was done', () => {
        let progress = opened(null, 'roles');
        expect(progress).toEqual({ state: 'OPEN', at: 'ROLES' });
        progress = skipped(progress, 'about');
        progress = skipped(progress, 'roles');
        progress = skipped(progress, 'profile');
        progress = skipped(progress, 'page');
        expect(progress.skipped).toEqual(['ROLES', 'ABOUT']);
        expect(done(progress, 'roles').skipped).toEqual(['ABOUT']);
    });

    it('"Skip setup" ends it for good; the steps not reached come back on the card until dismissed', () => {
        const progress = closed(opened(null, 'about'), 'about');
        expect(progress).toEqual({ state: 'DONE', at: null, skipped: ['ABOUT', 'FOLLOW'] });
        expect(cardSteps(progress)).toEqual(['about', 'clubs']);
        expect(cardSteps({ ...progress, cardDismissed: true })).toEqual([]);
        // Finishing, or leaving to create a page, keeps only what was skipped on the way.
        expect(closed(skipped(opened(null, 'roles'), 'roles'), null).skipped).toEqual(['ROLES']);
        // Progress saved by the earlier welcome still shows, as the steps that replaced it.
        expect(cardSteps({ state: 'DONE', skipped: ['CLUB', 'FOLLOW', 'BUSINESS', 'ROLES'] })).toEqual(['roles', 'clubs']);
        // An open setup, a finished one and an account that never had one show no card.
        expect(cardSteps(opened(null, 'roles'))).toEqual([]);
        expect(cardSteps(closed(opened(null, 'profile'), null))).toEqual([]);
        expect(cardSteps(null)).toEqual([]);
    });
});
