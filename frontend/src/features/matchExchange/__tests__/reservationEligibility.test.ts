import { describe, expect, it } from 'vitest';
import { reservationIssue, reservationTiming } from '../reservationEligibility';
const booking = { status: 'CONFIRMED', format: '11_A_SIDE', startsAt: '2026-10-30T07:00:00Z', endsAt: '2026-10-30T09:00:00Z' };
const match = { startsAt: '2026-10-30T11:00', endsAt: '2026-10-30T12:30', timezone: 'Asia/Tbilisi', format: '11_A_SIDE' };
describe('reservation eligibility before submission', () => {
  it('keeps entered times in their original timezone on devices outside the rental timezone', () => {
    const rental = { ...booking, timezone: 'Asia/Tbilisi' };
    expect(reservationTiming(rental, { startsAt: '2026-10-30T07:30', endsAt: '', timezone: 'UTC' })).toEqual({ startsAt: '2026-10-30T07:30', endsAt: '2026-10-30T09:00', timezone: 'UTC' });
    expect(reservationTiming(rental, { startsAt: '', endsAt: '2026-10-30T08:30', timezone: 'UTC' })).toEqual({ startsAt: '2026-10-30T07:00', endsAt: '2026-10-30T08:30', timezone: 'UTC' });
    expect(reservationTiming(rental, { startsAt: '', endsAt: '', timezone: 'UTC' })).toEqual({ startsAt: '2026-10-30T11:00', endsAt: '2026-10-30T13:00', timezone: 'Asia/Tbilisi' });
  });
  it('compares the full interval in the match timezone', () => {
    expect(reservationIssue(booking, match)).toBe('');
    expect(reservationIssue(booking, { ...match, endsAt: '2026-10-30T13:01' })).toMatch(/full match/);
    expect(reservationIssue(booking, { ...match, timezone: 'UTC' })).toMatch(/full match/);
  });
  it('explains owner approval, incompatible pitch and overlapping allocation separately', () => {
    expect(reservationIssue({ ...booking, status: 'PENDING' }, match)).toBe('pending');
    expect(reservationIssue({ ...booking, format: '5_A_SIDE' }, match)).toMatch(/format/);
    expect(reservationIssue({ ...booking, allocations: [{ startsAt: '2026-10-30T08:00:00Z', endsAt: '2026-10-30T09:00:00Z' }] }, match)).toMatch(/overlapping/);
    expect(reservationIssue({ ...booking, allocations: [{ startsAt: '2026-10-30T08:30:00Z', endsAt: '2026-10-30T09:00:00Z' }] }, match)).toBe('');
  });
});
