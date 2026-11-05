import { describe, expect, it } from 'vitest';
import { jobHome, landingFor, type LinkInvite } from './inviteLinkApi';

const invite = (over: Partial<LinkInvite>): LinkInvite => ({ kind: 'APPOINTMENT', id: 1, revision: null, clubId: 4, clubName: 'Dinamo', clubLogoUrl: null,
    invitedBy: 'Levan', job: 'HEAD_COACH', title: 'Head coach', clubWide: false, squads: ['U12'], unavailableReason: null, ...over });

describe('Where an invite link lands', () => {
    it('opens the project a parent or volunteer was added to, My squads for a coach and Club office for an Admin', () => {
        expect(landingFor([invite({ kind: 'PROJECT_HELPER', id: 12, title: 'New kit for U12', squads: [] })])).toBe('/projects/12');
        expect(landingFor([invite({ kind: 'HELPER' })])).toBe('/home');
        expect(landingFor([invite({})])).toBe('/my-squads');
        expect(landingFor([invite({ kind: 'MEMBERSHIP', job: 'COACH' })])).toBe('/my-squads');
        expect(landingFor([invite({ job: 'TEAM_MANAGER' })])).toBe('/my-squads');
        expect(landingFor([invite({ kind: 'MEMBERSHIP', job: 'ADMIN' })])).toBe('/clubs/4/office');
        expect(landingFor([invite({}), invite({ kind: 'MEMBERSHIP', job: 'ADMIN' })])).toBe('/clubs/4/office');
    });
    it('lets current server permissions choose the home for scoped non-coaching and unknown jobs', () => {
        expect(landingFor([invite({ job: 'PHYSIOTHERAPIST' })])).toBe('/clubs/4/work');
        expect(landingFor([invite({ job: 'CUSTOM', title: 'Club owner' })])).toBe('/clubs/4/work');
    });
    it('keeps helpers out of job routing and never borrows the first helper’s club', () => {
        expect(landingFor([invite({ kind: 'PROJECT_HELPER', clubId: 99 }), invite({ job: 'FINANCE_OFFICER' })])).toBe('/clubs/4/work');
        expect(landingFor([invite({ kind: 'HELPER', clubId: 99 }), invite({ kind: 'MEMBERSHIP', job: 'ADMIN' })])).toBe('/clubs/4/office');
        expect(landingFor([invite({}), invite({ clubId: 5 })])).toBe('/requests?view=needs-you');
        expect(landingFor([])).toBe('/home');
    });
    it.each(['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'HEAD_OF_COACHING', 'TRAVEL_COORDINATOR', 'SPECIALIST_COACH', 'GOALKEEPER_COACH', 'STRENGTH_CONDITIONING', 'COACH'])('%s starts in My squads', job => {
        expect(jobHome(4, job)).toBe('/my-squads');
    });
    it.each(['REHABILITATION_COACH', 'EQUIPMENT_MANAGER', 'PHYSIOTHERAPIST'])('%s is on no squad, so starts at the club', job => {
        expect(jobHome(4, job)).toBe('/clubs/4/work');
    });
});
