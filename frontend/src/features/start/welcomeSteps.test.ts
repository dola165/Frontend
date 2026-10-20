import { describe, expect, it } from 'vitest';
import { cardSteps, closed, done, opened, skipped, welcomeSteps } from './welcomeSteps';

describe('the welcome steps', () => {
    it('follow from what the person does, and go straight to clubs near you when nothing fits', () => {
        expect(welcomeSteps(['COACH', 'PARENT'])).toEqual(['roles', 'club', 'child', 'follow', 'business']);
        expect(welcomeSteps(['CLUB_STAFF', 'ORGANIZER', 'VENUE_MANAGER'])).toEqual(['roles', 'club', 'tournament', 'venue', 'follow', 'business']);
        expect(welcomeSteps(['FAN', 'PLAYER', 'REFEREE'])).toEqual(['roles', 'follow', 'business']);
        expect(welcomeSteps([])).toEqual(['roles', 'follow', 'business']);
    });

    it('remember skipped steps once, never the optional business question, and forget what was done', () => {
        let progress = opened(null, 'roles');
        expect(progress).toEqual({ state: 'OPEN', at: 'ROLES' });
        progress = skipped(progress, 'roles');
        progress = skipped(progress, 'business');
        expect(progress.skipped).toEqual(['ROLES']);
        expect(done(progress, 'roles').skipped).toEqual([]);
    });

    it('closing ends the popup for good; what was not reached comes back on the card until dismissed', () => {
        const steps = welcomeSteps(['PARENT']);
        const progress = closed(skipped(opened(null, 'child'), 'roles'), steps, 'child');
        expect(progress).toEqual({ state: 'DONE', at: null, skipped: ['ROLES', 'CHILD', 'FOLLOW'] });
        expect(cardSteps(progress)).toEqual(['roles', 'child', 'follow']);
        expect(cardSteps({ ...progress, cardDismissed: true })).toEqual([]);
        // Leaving to do the step's own task counts it as done.
        expect(closed(done(opened(null, 'child'), 'child'), steps, 'follow').skipped).toEqual(['FOLLOW']);
        // An open popup, a finished one and an account that never had one show no card.
        expect(cardSteps(opened(null, 'roles'))).toEqual([]);
        expect(cardSteps(closed(opened(null, 'business'), steps, null))).toEqual([]);
        expect(cardSteps(null)).toEqual([]);
    });
});
