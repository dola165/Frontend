import { describe, expect, it } from 'vitest';
import type { TournamentDetail, TournamentFixtureDto } from '../domain';
import { tournamentCalendar } from '../tournament-calendar';
import { tournamentKickoffLabel } from '../tournament-readiness';

const fixture = (extra: Partial<TournamentFixtureDto> = {}): TournamentFixtureDto => ({
    id: 1, stageId: 1, stageName: 'Group A', homeEntryId: 1, awayEntryId: 2,
    homeLabel: 'A', awayLabel: 'B', winnerEntryId: null, homeScore: null, awayScore: null,
    roundNumber: 1, fixtureOrder: 1, scheduledAt: '2027-06-10T12:00:00+04:00', locationId: null,
    status: 'SCHEDULED', linkedMatchId: null, ...extra,
});
const tournament = (fixtures: TournamentFixtureDto[]): TournamentDetail => ({
    id: 1, name: 'Academy cup', status: 'ACTIVE', organizerOrganizationId: 1,
    participantScope: 'SQUAD', visibility: 'PUBLIC', staffAssignments: [], entries: [], stages: [], fixtures,
});

describe('a youth fixture for someone outside the competition', () => {
    it('says its day and no time', () => {
        expect(tournamentKickoffLabel('2027-06-10T12:00:00+04:00', 'en', true)).toBe('10 Jun 2027');
        expect(tournamentKickoffLabel('2027-06-10T10:30:00+04:00', 'en')).toBe('10 Jun 2027 · 10:30');
    });

    it('stays out of the calendar file, which would need a time', () => {
        expect(tournamentCalendar(tournament([fixture({ timeHidden: true })]), 'https://example.test')).not.toContain('BEGIN:VEVENT');
        expect(tournamentCalendar(tournament([fixture()]), 'https://example.test')).toContain('BEGIN:VEVENT');
    });
});
