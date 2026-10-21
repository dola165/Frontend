import { describe, expect, it } from 'vitest';
import { tournamentKickoffLabel, participantProfilePath, registrationWindow, tournamentReadiness } from './tournament-readiness';
import type { TournamentDetail, TournamentEntryDto } from './domain';
const tournament={status:'PLANNING',visibility:'PUBLIC',registrationPolicy:'OPEN',entries:[],fixtures:[],stages:[]} as unknown as TournamentDetail;
describe('Tournament readiness',()=>{
    it('respects registration dates and private invitation entitlement',()=>{
        const now=new Date('2026-10-02T12:00:00').getTime();
        expect(registrationWindow({...tournament,registrationOpensAt:'2026-10-03T12:00:00'},now)).toBe('not-open');
        expect(registrationWindow({...tournament,registrationClosesAt:'2026-10-01T12:00:00'},now)).toBe('closed');
        expect(registrationWindow({...tournament,visibility:'PRIVATE'},now)).toBe('invitation');
        expect(registrationWindow({...tournament,registrationPolicy:'INVITE_ONLY'},now)).toBe('invitation');
        expect(registrationWindow({...tournament,status:'ACTIVE'},now)).toBe('unavailable');
        expect(registrationWindow(tournament,now)).toBe('open');
    });
    it('keeps approved entries awaiting confirmation and excludes cancelled fixtures from setup tasks',()=>{
        const state=tournamentReadiness({...tournament,entries:[{id:1,status:'APPROVED'},{id:2,status:'ACTIVE'}] as TournamentEntryDto[],fixtures:[{id:1,status:'SCHEDULED',scheduledAt:null,locationId:null},{id:2,status:'CANCELLED',scheduledAt:null,locationId:null}] as TournamentDetail['fixtures']});
        expect(state.confirmed.map(e=>e.id)).toEqual([2]);expect(state.pending.map(e=>e.id)).toEqual([1]);expect(state.unscheduled).toBe(1);expect(state.withoutVenue).toBe(1);
    });
    it('links only identities returned by the protected tournament projection',()=>{
        expect(participantProfilePath({clubId:3,squadId:4} as TournamentEntryDto)).toBe('/clubs/3?tab=teams');
        expect(participantProfilePath({userId:9} as TournamentEntryDto)).toBe('/profile/9');
        expect(participantProfilePath({displayName:'Protected player'} as TournamentEntryDto)).toBeNull();
    });
    it('keeps past unresolved fixtures out of Coming up while surfacing their result count',()=>{
        const state=tournamentReadiness({...tournament,fixtures:[{id:1,status:'SCHEDULED',scheduledAt:'2026-10-01T10:00:00'},{id:2,status:'SCHEDULED',scheduledAt:'2026-10-03T10:00:00'}] as TournamentDetail['fixtures']},new Date('2026-10-02T10:00:00').getTime());
        expect(state.upcoming.map(f=>f.id)).toEqual([2]);expect(state.awaitingResult).toBe(1);
    });
});

it('includes the organizer-entered kickoff without inventing a timezone conversion', () => {
 expect(tournamentKickoffLabel('2027-07-01T12:00:00')).toBe('1 Jul 2027 · 12:00');
 expect(tournamentKickoffLabel('2027-07-01T12:00:00-07:00')).toBe('1 Jul 2027 · 12:00');
});
it('keeps absent or invalid kickoffs unannounced', () => {
 expect(tournamentKickoffLabel(null)).toBeNull();
 expect(tournamentKickoffLabel('2027-02-30T12:00:00')).toBeNull();
});
