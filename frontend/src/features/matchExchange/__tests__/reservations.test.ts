import { describe, expect, it } from 'vitest';
import { reservationIssue, type MatchReservation } from '../reservations';

const match = { event_id: 58, format: '11_A_SIDE', starts_at_iso: '2099-10-23T17:00:00+04:00', ends_at_iso: '2099-10-23T18:30:00+04:00' };
const reservation = (value: Partial<MatchReservation> = {}) => ({
    status: 'CONFIRMED', format: '11_A_SIDE', startsAt: '2099-10-23T16:30:00+04:00', endsAt: '2099-10-23T19:00:00+04:00', allocations: [], ...value,
});

describe('whether a reservation can hold a match', () => {
    it('holds a match it covers in full, at its format', () => {
        expect(reservationIssue(reservation(), match)).toBe('');
        // The same instant written in another zone covers it just the same.
        expect(reservationIssue(reservation({ startsAt: '2099-10-23T12:30:00Z', endsAt: '2099-10-23T15:00:00Z' }), match)).toBe('');
    });
    it('says why not, in words', () => {
        expect(reservationIssue(reservation({ status: 'PENDING' }), match)).toBe('Waiting for the venue to confirm');
        expect(reservationIssue(reservation({ status: 'CANCELLED' }), match)).toBe('Cancelled');
        expect(reservationIssue(reservation({ format: '7_A_SIDE' }), match)).toBe('A different playing format');
        expect(reservationIssue(reservation({ endsAt: '2099-10-23T18:00:00+04:00' }), match)).toBe('Does not cover the whole match');
        expect(reservationIssue(reservation({ allocations: [{ eventId: 61, startsAt: '2099-10-23T18:00:00+04:00', endsAt: '2099-10-23T19:00:00+04:00' }] }), match)).toBe('Already used by an overlapping match');
    });
    it('is not taken by the match it already holds, and any format fits "other"', () => {
        expect(reservationIssue(reservation({ allocations: [{ eventId: 58, startsAt: match.starts_at_iso, endsAt: match.ends_at_iso }] }), match)).toBe('');
        expect(reservationIssue(reservation({ format: 'OTHER' }), match)).toBe('');
    });
});
