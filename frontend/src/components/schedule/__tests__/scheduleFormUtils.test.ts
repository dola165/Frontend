import { durationMinutes, localDateISO, upcomingTrainingDates } from '../scheduleFormUtils';

describe('localDateISO', () => {
    it('uses local calendar fields at both ends of a day', () => {
        expect(localDateISO(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
        expect(localDateISO(new Date(2026, 11, 31, 23, 55))).toBe('2026-12-31');
        expect(localDateISO(new Date('invalid'))).toBe('');
    });
});

describe('upcomingTrainingDates', () => {
    it('finds actual selected sessions when the start boundary is not a training day', () => {
        expect(upcomingTrainingDates({ startDate: '2026-09-16', daysOfWeek: ['MONDAY', 'FRIDAY'] }))
            .toEqual(['2026-09-18', '2026-09-21', '2026-09-25']);
    });

    it('includes the final date and rejects a finite window without a session', () => {
        expect(upcomingTrainingDates({ startDate: '2026-09-16', endDate: '2026-09-18', daysOfWeek: ['FRIDAY'] }))
            .toEqual(['2026-09-18']);
        expect(upcomingTrainingDates({ startDate: '2026-09-16', endDate: '2026-09-16', daysOfWeek: ['FRIDAY'] }))
            .toEqual([]);
        expect(upcomingTrainingDates({ startDate: '2026-09-18', endDate: '2026-09-18', daysOfWeek: ['FRIDAY'] }))
            .toEqual(['2026-09-18']);
    });

    it('anchors alternate weeks at the start boundary, including Mondays in the first block', () => {
        expect(upcomingTrainingDates({ startDate: '2026-09-16', daysOfWeek: ['MONDAY', 'FRIDAY'], intervalValue: 2, limit: 4 }))
            .toEqual(['2026-09-18', '2026-09-21', '2026-10-02', '2026-10-05']);
    });
    it('uses calendar Monday anchors for squad invitations while keeping legacy plans unchanged', () => {
        expect(upcomingTrainingDates({ startDate: '2026-09-16', daysOfWeek: ['MONDAY', 'FRIDAY'], intervalValue: 2, limit: 4, weekAnchor: 'MONDAY' }))
            .toEqual(['2026-09-18', '2026-09-28', '2026-10-02', '2026-10-12']);
    });

    it('uses an inclusive fromDate without shifting the original recurrence anchor', () => {
        const plan = { startDate: '2026-09-16', daysOfWeek: ['MONDAY', 'FRIDAY'], intervalValue: 2 };
        expect(upcomingTrainingDates(plan, '2026-09-21')).toEqual(['2026-09-21', '2026-10-02', '2026-10-05']);
        expect(upcomingTrainingDates(plan, '2026-09-22')).toEqual(['2026-10-02', '2026-10-05', '2026-10-16']);
        expect(upcomingTrainingDates(plan, '2026-09-01')).toEqual(['2026-09-18', '2026-09-21', '2026-10-02']);
    });

    it('handles leap days and year boundaries without date normalization', () => {
        expect(upcomingTrainingDates({ startDate: '2028-02-28', daysOfWeek: ['TUESDAY'], limit: 1 })).toEqual(['2028-02-29']);
        expect(upcomingTrainingDates({ startDate: '2026-12-31', daysOfWeek: ['FRIDAY'], limit: 1 })).toEqual(['2027-01-01']);
    });

    it('rejects malformed dates, reversed windows and unknown or absent weekdays', () => {
        for (const startDate of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', 'invalid']) {
            expect(upcomingTrainingDates({ startDate, daysOfWeek: ['MONDAY'] })).toEqual([]);
        }
        expect(upcomingTrainingDates({ startDate: '2026-09-16', endDate: '2026-09-15', daysOfWeek: ['MONDAY'] })).toEqual([]);
        expect(upcomingTrainingDates({ startDate: '2026-09-16', endDate: 'bad', daysOfWeek: ['MONDAY'] })).toEqual([]);
        expect(upcomingTrainingDates({ startDate: '2026-09-16', daysOfWeek: ['MONDAY'] }, 'bad')).toEqual([]);
        expect(upcomingTrainingDates({ startDate: '2026-09-16', daysOfWeek: [] })).toEqual([]);
        expect(upcomingTrainingDates({ startDate: '2026-09-16', daysOfWeek: ['MONDAY', 'FUNDAY'] })).toEqual([]);
    });

    it('caps preview size, de-duplicates weekdays and bounds sparse recurrence searches', () => {
        const plan = { startDate: '2026-09-16', daysOfWeek: ['MONDAY', 'MONDAY'] };
        expect(upcomingTrainingDates({ ...plan, limit: 100 })).toHaveLength(6);
        expect(upcomingTrainingDates({ ...plan, limit: 0 })).toEqual([]);
        expect(upcomingTrainingDates({ ...plan, intervalValue: 0 })).toEqual([]);
        expect(upcomingTrainingDates({ ...plan, intervalValue: 1.5 })).toEqual([]);
        expect(upcomingTrainingDates({ ...plan, intervalValue: 1000 }, '2026-09-23')).toEqual([]);
    });
});

describe('durationMinutes', () => {
    it('accepts minute and second precision, retaining elapsed seconds', () => {
        expect(durationMinutes('18:00', '19:30')).toBe(90);
        expect(durationMinutes('18:00:00', '19:30:00')).toBe(90);
        expect(durationMinutes('18:00:30', '18:01:00')).toBe(0.5);
    });

    it('rejects equal, reversed and overnight times', () => {
        expect(durationMinutes('18:00', '18:00')).toBeNull();
        expect(durationMinutes('19:30', '18:00')).toBeNull();
        expect(durationMinutes('23:30', '00:30')).toBeNull();
    });

    it('rejects malformed or out-of-range values', () => {
        for (const value of ['', '8:00', '24:00', '18:60', '18:00:60', '18:00Z', '18:00:00.000', ' 18:00']) {
            expect(durationMinutes(value, '19:30')).toBeNull();
            expect(durationMinutes('17:00', value)).toBeNull();
        }
    });
});
