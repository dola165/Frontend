import { describe, expect, it } from 'vitest';
import { landingFor, type LinkInvite } from './inviteLinkApi';

const invite = (over: Partial<LinkInvite>): LinkInvite => ({ kind: 'APPOINTMENT', id: 1, revision: null, clubId: 4, clubName: 'Dinamo', clubLogoUrl: null,
    invitedBy: 'Levan', job: 'HEAD_COACH', title: 'Head coach', clubWide: false, squads: ['U12'], unavailableReason: null, ...over });

describe('Where an invite link lands', () => {
    it('opens the project a parent or volunteer was added to, and the club for a job', () => {
        expect(landingFor([invite({ kind: 'PROJECT_HELPER', id: 12, title: 'New kit for U12', squads: [] })])).toBe('/projects/12');
        expect(landingFor([invite({ kind: 'HELPER' })])).toBe('/home');
        expect(landingFor([invite({ clubWide: true })])).toBe('/clubs/4/office');
        expect(landingFor([invite({})])).toBe('/my-squads');
    });
});
