import { buildMatchdaySchedule, matchdayKickoff } from '../matchdaySchedule';
import type { TournamentDetail, TournamentFixtureDto } from '../domain';

const fixture = (id: number, extra: Partial<TournamentFixtureDto> = {}): TournamentFixtureDto => ({
    id, stageId: 1, stageName: 'Group A', homeEntryId: 1, awayEntryId: 2,
    homeLabel: null, awayLabel: null, winnerEntryId: null, homeScore: null, awayScore: null,
    roundNumber: 1, fixtureOrder: id, scheduledAt: '2027-06-10T10:00:00', locationId: null,
    status: 'SCHEDULED', linkedMatchId: null, ...extra,
});
const tournament = (fixtures: TournamentFixtureDto[]): TournamentDetail => ({
    id: 1, name: 'Academy cup', status: 'PLANNING', organizerOrganizationId: 1,
    participantScope: 'SQUAD', visibility: 'PUBLIC', staffAssignments: [], entries: [], stages: [], fixtures,
});

describe('Matchday schedule checks', () => {
    it('finds the same actual team at the same kickoff across different stages', () => {
        const rows = buildMatchdaySchedule(tournament([
            fixture(1), fixture(2, { stageId: 2, homeEntryId: 3, awayEntryId: 1, scheduledAt: '2027-06-10T10:00' }),
            fixture(3, { homeEntryId: 4, awayEntryId: 5 }),
        ]));
        expect(rows[0].conflictingIds).toEqual([2]);
        expect(rows[1].conflictingIds).toEqual([1]);
        expect(rows[2].conflictingIds).toEqual([]);
    });

    it('does not flag cancelled, completed or unresolved matches as team conflicts', () => {
        const rows = buildMatchdaySchedule(tournament([
            fixture(1), fixture(2, { status: 'CANCELLED' }), fixture(3, { status: 'COMPLETED' }),
            fixture(4, { homeEntryId: null, awayEntryId: null, homeLabel: 'Winner A' }),
            fixture(5, { homeEntryId: null, awayEntryId: null, homeLabel: 'Winner A' }),
        ]));
        expect(rows.every(row => row.conflictingIds.length === 0)).toBe(true);
    });

    it('does not infer duration or rest-time conflicts from different kickoffs', () => {
        const rows = buildMatchdaySchedule(tournament([fixture(1), fixture(2, { scheduledAt: '2027-06-10T10:05:00' })]));
        expect(rows.every(row => row.conflictingIds.length === 0)).toBe(true);
    });

    it('sorts across days, puts missing times last and only flags scheduled matches', () => {
        const rows = buildMatchdaySchedule(tournament([
            fixture(1, { scheduledAt: null }), fixture(2, { scheduledAt: '2027-06-11T08:00:00' }),
            fixture(3), fixture(4, { scheduledAt: 'invalid', status: 'CANCELLED' }),
        ]));
        expect(rows.map(row => row.fixture.id)).toEqual([3, 2, 1, 4]);
        expect(rows.filter(row => row.missingTime).map(row => row.fixture.id)).toEqual([1]);
    });

    it('preserves date and time through daylight-saving dates without browser conversion', () => {
        expect(matchdayKickoff('2027-03-28T01:30:00')).toMatchObject({ day: '2027-03-28', time: '01:30' });
        expect(matchdayKickoff('2027-10-31T01:30:00')).toMatchObject({ day: '2027-10-31', time: '01:30' });
        expect(matchdayKickoff('2028-02-29T23:59:00')).not.toBeNull();
    });

    it.each(['2027-02-29T10:00:00', '2027-06-31T10:00:00', '2027-06-10T24:00:00', '2027-06-10T10:60:00', 'bad'])('handles invalid kickoff %s without crashing', value => {
        expect(matchdayKickoff(value)).toBeNull();
    });

    it('deduplicates clashes when both teams appear in both fixtures', () => {
        expect(buildMatchdaySchedule(tournament([fixture(1), fixture(2)]))[0].conflictingIds).toEqual([2]);
    });

    it('supports legacy offset timestamps without assuming local times are UTC', () => {
        const rows = buildMatchdaySchedule(tournament([
            fixture(1, { scheduledAt: '2027-06-10T10:00:00Z' }),
            fixture(2, { scheduledAt: '2027-06-10T11:00:00+01:00' }),
            fixture(3),
        ]));
        expect(rows.find(row => row.fixture.id === 1)?.conflictingIds).toEqual([2]);
        expect(rows.find(row => row.fixture.id === 3)?.conflictingIds).toEqual([]);
        expect(matchdayKickoff('2027-06-10T23:30:00-04:00')).toMatchObject({ day: '2027-06-10', time: '23:30' });
    });
});
