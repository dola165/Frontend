import { describe, expect, it } from 'vitest';
import type { Match } from '../../matchExchange/api';
import type { ScoreRecord } from '../../scores/api';
import { laneOf, trackOf } from '../scoreboard/lanes';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-12T08:00:00Z');
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString();
const MINE = new Set([1]);
// The fields lanes read, built from what a listing says (ids are illustrative).
const listing = (over: Partial<Match>) => ({
    event_id: 5800, club_id: 1, opponent_club_id: null, requested_club_id: null, listing_status: 'OPEN', event_status: 'SCHEDULED', result_status: null,
    starts_at_iso: at(100), ends_at_iso: at(101.5), timezone: 'Asia/Tbilisi', venue_status: 'BOOKED', referee_required: true, referee_status: 'ACCEPTED', referee_responsibility: 'HOST', ...over,
}) as Match;
const lane = (m: Match, detail?: Match) => laneOf(m, { clubIds: MINE, detail, now: NOW });
const offer = (clubId: number, status: string) => ({ id: clubId, squad_id: clubId * 10, squad_name: 'U14', club_name: 'Club', club_id: clubId, note: '', status });

describe('my arrangements in their lanes', () => {
    it('needs me for an invitation to my club, offers to choose, and a played match without an agreed result', () => {
        expect(lane(listing({ club_id: 5, requested_club_id: 1 }))).toEqual({ lane: 'needs', wait: { word: 'Reply by {day}', vars: { day: 'Fri' }, tone: 'warning', ask: 'reply' } });
        expect(lane(listing({ club_id: 5, requested_club_id: 1, starts_at_iso: at(20) }))?.wait?.tone).toBe('danger');
        expect(lane(listing({}), listing({ proposals: [offer(7, 'PENDING'), offer(5, 'PENDING')] }))).toEqual({ lane: 'needs', wait: { word: '{count} offers to choose', vars: { count: 2 }, tone: 'warning', ask: 'choose' } });
        const played = { listing_status: 'ARRANGED', opponent_club_id: 4, starts_at_iso: at(-50), ends_at_iso: at(-48) };
        expect(lane(listing(played))?.wait?.word).toBe('Report score');
        // Whose turn a reported score is, only its record says.
        expect(lane(listing({ ...played, result_status: 'REPORTED' }))?.wait?.word).toBe('Score to confirm');
        const result = (respond: string[], settle: string[] = [], settler: string | null = null) => ({ permissions: { respond, settle }, settler }) as unknown as ScoreRecord;
        expect(laneOf(listing({ ...played, result_status: 'REPORTED' }), { clubIds: MINE, result: result(['AWAY']), now: NOW })?.wait?.word).toBe('Confirm score');
        expect(laneOf(listing({ ...played, result_status: 'REPORTED' }), { clubIds: MINE, result: result([]), now: NOW })).toEqual({ lane: 'waiting', wait: { word: 'Waiting for them to confirm', tone: 'neutral' } });
        expect(lane(listing({ ...played, result_status: 'DISPUTED' }))?.wait).toEqual({ word: 'Result disputed', tone: 'danger' });
        // A dispute: the settler is asked to settle, the clubs wait on them, and a friendly with no settler is done.
        const disputed = listing({ ...played, result_status: 'DISPUTED' });
        expect(laneOf(disputed, { clubIds: MINE, result: result([], ['REFEREE'], 'REFEREE'), now: NOW })?.wait).toEqual({ word: 'Settle score', tone: 'danger' });
        expect(laneOf(disputed, { clubIds: MINE, result: result([], [], 'REFEREE'), now: NOW })).toEqual({ lane: 'waiting', wait: { word: 'Result disputed', tone: 'neutral' } });
        expect(laneOf(disputed, { clubIds: MINE, result: result([]), now: NOW })).toEqual({ lane: 'played' });
        expect(lane(listing({ ...played, result_status: 'FINAL' }))).toEqual({ lane: 'played' });
    });

    it('waits on them for my invitation, my listing without offers, and my offer on theirs; hides a declined offer', () => {
        expect(lane(listing({ requested_club_id: 12 }))?.wait?.word).toBe('Waiting for their answer');
        expect(lane(listing({}), listing({ proposals: [] }))?.wait?.word).toBe('Waiting for offers');
        // Offers not looked at are not claimed to be none.
        expect(lane(listing({}))?.wait?.word).toBe('Open for offers');
        const theirs = listing({ club_id: 9 });
        expect(lane(theirs, listing({ club_id: 9, proposals: [offer(1, 'PENDING')] }))?.wait?.word).toBe('Offer sent');
        expect(lane(theirs, listing({ club_id: 9, proposals: [offer(1, 'DECLINED')] }))).toBeNull();
    });

    it('puts agreed matches in Coming up, agreed results in Played, and called-off ones by their date', () => {
        expect(lane(listing({ listing_status: 'ARRANGED', opponent_club_id: 4 }))).toEqual({ lane: 'coming' });
        expect(lane(listing({ listing_status: 'ARRANGED', opponent_club_id: 4, starts_at_iso: at(-50), ends_at_iso: at(-48), result_status: 'CONFIRMED' }))).toEqual({ lane: 'played' });
        expect(lane(listing({ listing_status: 'CANCELLED', event_status: 'CANCELLED', opponent_club_id: 4 }))).toEqual({ lane: 'coming' });
        expect(lane(listing({ listing_status: 'EXPIRED', starts_at_iso: at(-50), ends_at_iso: at(-48) }))).toBeNull();
        // Agreed with another club: my offer was not taken.
        expect(lane(listing({ club_id: 9, opponent_club_id: 4, listing_status: 'ARRANGED' }))).toBeNull();
    });
});

describe('the four-dot track', () => {
    const states = (m: Match) => trackOf(m, { clubIds: MINE, now: NOW }).map(dot => dot.state);
    const agreed = { listing_status: 'ARRANGED', opponent_club_id: 4 };
    it('shows what is done, mine to do, urgent near kick-off, waiting, or not needed', () => {
        expect(states(listing(agreed))).toEqual(['done', 'done', 'done', 'none']);
        expect(states(listing({ ...agreed, referee_status: 'NEEDED', venue_status: 'NEEDED' }))).toEqual(['done', 'yours', 'yours', 'none']);
        expect(states(listing({ ...agreed, referee_status: 'INVITED' }))).toEqual(['done', 'done', 'waiting', 'none']);
        expect(states(listing({ ...agreed, referee_status: 'NEEDED', starts_at_iso: at(10), ends_at_iso: at(11.5) }))).toEqual(['done', 'done', 'urgent', 'none']);
        expect(states(listing({ club_id: 5, opponent_club_id: 1, listing_status: 'ARRANGED', referee_required: false }))).toEqual(['done', 'done', 'none', 'none']);
        expect(states(listing({ ...agreed, starts_at_iso: at(-50), ends_at_iso: at(-48), result_status: 'CONFIRMED' }))).toEqual(['done', 'done', 'done', 'done']);
        expect(states(listing({ listing_status: 'CANCELLED', event_status: 'CANCELLED', opponent_club_id: 4 }))).toEqual([]);
        // Once played, what was never arranged can no longer be: a dash, never red.
        expect(states(listing({ ...agreed, referee_status: 'NEEDED', starts_at_iso: at(-50), ends_at_iso: at(-48), result_status: 'CONFIRMED' }))).toEqual(['done', 'done', 'none', 'done']);
    });
});
