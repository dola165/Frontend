import { describe, expect, it } from 'vitest';
import type { DrawState } from '../../competitions/api';
import type { TournamentFixtureDto, TournamentStageDto } from '../domain';
import { actualShape, cupRounds, plannedShape } from './shapeOf';

const fixture = (id: number, round: number, order: number, home: number | null, away: number | null, extra: Partial<TournamentFixtureDto> = {}): TournamentFixtureDto => ({
    id, stageId: 1, stageName: 'Cup', homeEntryId: home, homeLabel: null, awayEntryId: away, awayLabel: null, winnerEntryId: null, homeScore: null, awayScore: null,
    roundNumber: round, fixtureOrder: order, scheduledAt: null, locationId: null, status: 'SCHEDULED', linkedMatchId: null, ...extra,
});
const played = (home: number, away: number, homeScore: number, awayScore: number) => ({ status: 'COMPLETED' as const, homeScore, awayScore, winnerEntryId: homeScore > awayScore ? home : away });
const route = (target: number, slot: 'HOME' | 'AWAY', source: number) => ({ target_fixture_id: target, slot, source_fixture_id: source, outcome: 'WINNER' });
const stage = (id: number, name: string, stageType: TournamentStageDto['stageType'], extra: Partial<TournamentStageDto> = {}): TournamentStageDto =>
    ({ id, parentStageId: null, name, stageType, stageOrder: id, status: 'ACTIVE', advanceCount: 0, ...extra });

describe('the planned shape', () => {
    it('draws the format published, and nothing for a tournament without rules', () => {
        expect(plannedShape({ structure: 'GROUPS_KNOCKOUT' }, 12, 4)).toMatchObject({ kind: 'groups', word: 'Groups & finals', places: 12, entered: 4 });
        expect(plannedShape({ structure: 'HOME_AWAY' })?.kind).toBe('league');
        expect(plannedShape(null)).toBeNull();
    });
});

describe('a cup', () => {
    it('puts the two ties feeding one semi-final together, as the routes say (an engine draw folds 1 v 8)', () => {
        // Seeds 1–8 folded: 1v8, 2v7, 3v6, 4v5; the next round folds again: winners of 1v8 and 4v5 meet.
        const quarters = [fixture(11, 1, 1, 1, 8), fixture(12, 1, 2, 2, 7), fixture(13, 1, 3, 3, 6), fixture(14, 1, 4, 4, 5)];
        const semis = [fixture(21, 2, 1, null, null), fixture(22, 2, 2, null, null)];
        const final = fixture(31, 3, 1, null, null);
        const routes = [route(21, 'HOME', 11), route(21, 'AWAY', 14), route(22, 'HOME', 12), route(22, 'AWAY', 13), route(31, 'HOME', 21), route(31, 'AWAY', 22)];
        const rounds = cupRounds([...quarters, ...semis, final], routes);
        expect(rounds.map(round => round.name)).toEqual(['Quarter-finals', 'Semi-finals', 'Final']);
        expect(rounds[0].ties.map(tie => tie.id)).toEqual([11, 14, 12, 13]);
    });

    it('keeps fixture order for a bracket without routes (a tournament from before the engine)', () => {
        const rounds = cupRounds([fixture(11, 1, 2, 3, 4), fixture(12, 1, 1, 1, 2), fixture(21, 2, 1, null, null)]);
        expect(rounds[0].ties.map(tie => tie.id)).toEqual([12, 11]);
    });

    it('says a bye is one and sends its side through without a score', () => {
        const [round] = cupRounds([fixture(11, 1, 1, 1, null, { status: 'COMPLETED', winnerEntryId: 1 }), fixture(12, 1, 2, 2, 3)]);
        expect(round.ties[0]).toMatchObject({ state: 'bye', home: { entryId: 1, won: true, score: null } });
        expect(round.ties[1].state).toBe('next');
    });

    it('reads two legs as one tie, adding the goals, and names the round by its ties', () => {
        const legs = [fixture(11, 1, 1, 1, 2, played(1, 2, 2, 1)), fixture(12, 1, 2, 3, 4, played(3, 4, 0, 0)), fixture(13, 1, 3, 2, 1, played(2, 1, 1, 0)), fixture(14, 1, 4, 4, 3, played(4, 3, 1, 3))];
        const aggregates: DrawState['aggregates'] = [
            { deciding_fixture_id: 13, first_fixture_id: 11, replay_fixture_id: null, resolution: 'PENALTIES', ready: true, tied: true, winner: 1 },
            { deciding_fixture_id: 14, first_fixture_id: 12, replay_fixture_id: null, resolution: 'PENALTIES', ready: true, tied: false, winner: 3 },
        ];
        const [round] = cupRounds(legs, [], aggregates);
        expect(round.name).toBe('Semi-finals');
        expect(round.ties[0]).toMatchObject({ home: { entryId: 1, score: 2, won: true }, away: { entryId: 2, score: 2, won: false }, state: 'played' });
        expect(round.ties[1]).toMatchObject({ home: { entryId: 3, score: 3, won: true }, away: { entryId: 4, score: 1 } });
    });
});

describe('the actual shape', () => {
    it('finds nothing before the draw', () => {
        expect(actualShape({ stages: [], fixtures: [] }, { structure: 'KNOCKOUT' }, null)).toBeNull();
    });

    it('takes an engine tournament’s groups from the draw (round-robin stages, qualifiers from the plan)', () => {
        const draw = { plan: { qualifiers: 2 }, stages: [{ id: 1, name: 'Group A', stage_type: 'ROUND_ROBIN', phase: 1, title_route: false, carry_results: false, standings: [] }, { id: 2, name: 'Group B', stage_type: 'ROUND_ROBIN', phase: 1, title_route: false, carry_results: false, standings: [] }], routes: [], aggregates: [], slots: [], transitioned: false } as unknown as DrawState;
        const shape = actualShape({ stages: [stage(1, 'Group A', 'ROUND_ROBIN'), stage(2, 'Group B', 'ROUND_ROBIN')], fixtures: [] }, { structure: 'GROUPS_KNOCKOUT' }, draw);
        expect(shape).toMatchObject({ kind: 'groups', qualifiers: 2, finals: [] });
        expect(shape?.kind === 'groups' && shape.groups.map(group => group.through)).toEqual([2, 2]);
    });

    it('reads a legacy tournament from its stage types and advance counts', () => {
        const shape = actualShape({ stages: [stage(1, 'Group A', 'GROUP', { advanceCount: 2 }), stage(2, 'Finals', 'KNOCKOUT')], fixtures: [fixture(9, 1, 1, 1, 2, { stageId: 2 })] }, null, null);
        expect(shape).toMatchObject({ kind: 'groups', qualifiers: 2 });
        expect(shape?.kind === 'groups' && shape.finals[0].rounds[0].name).toBe('Final');
    });

    it('draws each tier of the finals as its own bracket, the title first, with its third-place match', () => {
        const draw = { plan: { qualifiers: 2 }, stages: [{ id: 3, title_route: false, phase: 2 }, { id: 2, title_route: true, phase: 2 }, { id: 4, title_route: false, phase: 2 }], routes: [
            { target_fixture_id: 31, slot: 'HOME', source_fixture_id: 21, outcome: 'WINNER' }, { target_fixture_id: 31, slot: 'AWAY', source_fixture_id: 22, outcome: 'WINNER' },
            { target_fixture_id: 41, slot: 'HOME', source_fixture_id: 21, outcome: 'LOSER' }, { target_fixture_id: 41, slot: 'AWAY', source_fixture_id: 22, outcome: 'LOSER' },
        ], aggregates: [], slots: [], transitioned: true } as unknown as DrawState;
        const stages = [stage(1, 'Group A', 'ROUND_ROBIN'), stage(2, 'Cup', 'KNOCKOUT'), stage(3, 'Plate', 'KNOCKOUT'), stage(4, 'Third place', 'KNOCKOUT')];
        // Plate drawn first in stage order, yet the title tier leads; the third-place stage follows the Cup it belongs to.
        stages[2].stageOrder = 1;
        const fixtures = [fixture(21, 1, 1, 1, 2, { stageId: 2 }), fixture(22, 1, 2, 3, 4, { stageId: 2 }), fixture(31, 2, 1, null, null, { stageId: 2 }), fixture(41, 1, 1, null, null, { stageId: 4 }),
            fixture(51, 1, 1, 5, 6, { stageId: 3 }), fixture(52, 1, 2, 7, 8, { stageId: 3 }), fixture(61, 2, 1, null, null, { stageId: 3 })];
        const shape = actualShape({ stages, fixtures }, { structure: 'GROUPS_KNOCKOUT' }, draw);
        expect(shape?.kind === 'groups' && shape.finals.map(tier => [tier.name, tier.rounds.map(round => round.name), tier.bronze?.id ?? null])).toEqual([
            ['Cup', ['Semi-finals', 'Final'], 41], ['Plate', ['Semi-finals', 'Final'], null],
        ]);
    });

    it('ranks a ladder and Swiss rounds in the engine’s order, which the draw state does not carry', () => {
        const ranking = [{ entryId: 2, rank: 1 }, { entryId: 1, rank: 2 }] as never;
        expect(actualShape({ stages: [stage(1, 'Ladder', 'ROUND_ROBIN')], fixtures: [] }, { structure: 'LADDER' }, null, ranking)).toMatchObject({ kind: 'ladder', table: { standings: ranking } });
        expect(actualShape({ stages: [stage(1, 'Swiss', 'ROUND_ROBIN')], fixtures: [] }, { structure: 'SWISS' }, null, ranking)).toMatchObject({ kind: 'swiss', tables: [{ standings: ranking }] });
        expect(actualShape({ stages: [stage(1, 'League', 'ROUND_ROBIN')], fixtures: [] }, { structure: 'ROUND_ROBIN' }, null, ranking)).toMatchObject({ tables: [{ standings: null }] });
    });
});
