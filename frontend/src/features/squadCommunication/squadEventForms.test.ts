import { afterEach, describe, expect, it, vi } from 'vitest';
import { newSquadEvent } from './squadEventForms';

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

/** Opens the default form at a local wall-clock time in `zone`, for the day it is opened. */
function openAt(zone: string, year: number, month: number, day: number, hours: number, minutes: number, seconds = 0) {
    vi.stubEnv('TZ', zone);
    const now = new Date(year, month - 1, day, hours, minutes, seconds);
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
    const form = newSquadEvent(new Date(now), 11, true);
    return { date: form.date, start: form.startTime, end: form.endTime, day: form.recurrenceDays?.[0], from: form.recurrenceStartDate,
        startTime: form.recurrenceStartTime, endTime: form.recurrenceEndTime, zone: form.recurrenceTimezone };
}

describe('the default training time', () => {
    it.each([
        // opened at,  expected date, start, end
        [10, 0, '2026-10-21', '18:00', '19:30'], // before 18:00: today's evening
        [0, 10, '2026-10-21', '18:00', '19:30'], // just after midnight: still today's evening, not 01:30
        [19, 0, '2026-10-21', '20:00', '21:30'],
        [20, 59, '2026-10-21', '22:00', '23:30'], // the latest start that ends before midnight
        [21, 0, '2026-10-21', '22:00', '23:30'],
        [21, 10, '2026-10-22', '18:00', '19:30'], // 22:30 would end at 00:00
        [22, 31, '2026-10-22', '18:00', '19:30'], // the next half hour plus one is past midnight
        [23, 59, '2026-10-22', '18:00', '19:30'],
    ])('opened at %i:%i gives %s %s-%s', (hours, minutes, date, start, end) => {
        const form = openAt('Asia/Tbilisi', 2026, 10, 21, hours, minutes);
        expect([form.date, form.start, form.end]).toEqual([date, start, end]);
        expect([form.from, form.startTime, form.endTime]).toEqual([date, start, end]);
        expect(form.zone).toBe('Asia/Tbilisi');
    });

    it('rounds a part-minute up rather than starting under an hour from now', () => {
        expect(openAt('Asia/Tbilisi', 2026, 10, 21, 19, 0, 1).start).toBe('20:30');
    });

    it('repeats on the weekday the default lands on', () => {
        expect(openAt('Asia/Tbilisi', 2026, 10, 21, 10, 0).day).toBe('WEDNESDAY');
        expect(openAt('Asia/Tbilisi', 2026, 10, 21, 23, 59).day).toBe('THURSDAY');
    });

    it('rounds on the local wall clock in a :45 zone', () => {
        // Kathmandu is UTC+5:45: epoch half-hours would give :15/:45 local starts.
        expect(openAt('Asia/Kathmandu', 2026, 10, 21, 19, 10)).toMatchObject({ date: '2026-10-21', start: '20:30', end: '22:00' });
        expect(openAt('Asia/Kathmandu', 2026, 10, 21, 21, 10)).toMatchObject({ date: '2026-10-22', start: '18:00', end: '19:30' });
    });

    it('keeps wall-clock times across a daylight-saving change', () => {
        // Berlin falls back at 03:00 on 25 Oct 2026; the next evening is still 18:00-19:30.
        expect(openAt('Europe/Berlin', 2026, 10, 24, 22, 31)).toMatchObject({ date: '2026-10-25', start: '18:00', end: '19:30', day: 'SUNDAY' });
        expect(openAt('Europe/Berlin', 2026, 10, 25, 19, 0)).toMatchObject({ date: '2026-10-25', start: '20:00', end: '21:30' });
        // Santiago springs forward at midnight (00:00 -> 01:00) on 6 Sep 2026.
        expect(openAt('America/Santiago', 2026, 9, 5, 21, 10)).toMatchObject({ date: '2026-09-06', start: '18:00', end: '19:30' });
        expect(openAt('America/Santiago', 2026, 9, 5, 20, 40)).toMatchObject({ date: '2026-09-05', start: '22:00', end: '23:30' });
    });

    it('leaves a chosen later day at its evening', () => {
        vi.stubEnv('TZ', 'Asia/Tbilisi');
        vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 21, 23, 0));
        const form = newSquadEvent(new Date(2026, 9, 30, 9, 0), 11, false);
        expect([form.date, form.startTime, form.endTime]).toEqual(['2026-10-30', '18:00', '19:30']);
    });
});
