import type { CompetitionRules, DrawState, Standing, Structure } from '../../competitions/api';
import type { TournamentDetail, TournamentFixtureDto, TournamentStageDto } from '../domain';

/** The pictures a tournament's format is drawn as. */
export type ShapeKind = 'league' | 'cup' | 'groups' | 'swiss' | 'festival' | 'ladder';

const KIND: Record<Structure, ShapeKind> = {
    ROUND_ROBIN: 'league', HOME_AWAY: 'league', SPLIT_LEAGUE: 'league', SWISS: 'swiss', KNOCKOUT: 'cup', GROUPS_KNOCKOUT: 'groups',
    LADDER: 'ladder', ROTATION: 'festival', KING_OF_PITCH: 'festival',
};

/** What a format is called on a row, in football words ("Knockout cup", "Groups & finals"). */
export const FORMAT_WORD: Record<Structure, string> = {
    ROUND_ROBIN: 'League', HOME_AWAY: 'Home & away league', SPLIT_LEAGUE: 'Split league', SWISS: 'Swiss rounds', KNOCKOUT: 'Knockout cup',
    GROUPS_KNOCKOUT: 'Groups & finals', LADDER: 'Ladder', ROTATION: 'Festival', KING_OF_PITCH: 'King of the Pitch',
};

/** A tournament's shape as planned: its picture, its format in words, and how many places it has and has filled. */
export interface PlannedShape { kind: ShapeKind; structure: Structure; word: string; places: number | null; entered: number | null }

/**
 * The planned layer of a tournament's shape, from its published rules and places: all a list row can draw before the
 * draw (the draw's own groups, routes and progress are later layers). Null when the rules are not published (a legacy
 * tournament).
 */
export function plannedShape(rules: Pick<CompetitionRules, 'structure'> | null | undefined, entryCap?: number | null, entryCount?: number | null): PlannedShape | null {
    const structure = rules?.structure;
    if (!structure || !KIND[structure]) return null;
    return { kind: KIND[structure], structure, word: FORMAT_WORD[structure], places: entryCap ?? null, entered: entryCount ?? null };
}

/** One side of a knockout tie: the entry (none for a side still to be decided), its goals over the tie, and whether it went through. */
export interface TieSide { entryId: number | null; score: number | null; won: boolean }
/** A knockout tie: one match, or two legs read as one; a bye when one side has no opponent. */
export interface Tie { id: number; fixtures: TournamentFixtureDto[]; home: TieSide; away: TieSide; state: 'played' | 'level' | 'bye' | 'next'; scheduledAt: string | null }
/** A round of a cup, named by how many ties it has ("Final", "Semi-finals", "Round {n}"). */
export interface CupRound { round: number; name: string; ties: Tie[] }
/** A table in the shape: the stage, its ranking when the draw state carries it (else read for the stage), and how many go through. */
export interface ShapeTable { stageId: number; name: string; standings: Standing[] | null; through: number | null }
/** What has been drawn and played, in the tournament's own shape. */
export type ActualShape =
    | { kind: 'cup'; rounds: CupRound[]; bronze: Tie | null }
    | { kind: 'league' | 'swiss'; tables: ShapeTable[] }
    | { kind: 'groups'; groups: ShapeTable[]; finals: CupRound[]; qualifiers: number | null }
    | { kind: 'festival'; rounds: { round: number; fixtures: TournamentFixtureDto[] }[] }
    | { kind: 'ladder'; table: ShapeTable | null; challenges: TournamentFixtureDto[] };

/** A round's name by its number of ties (two legs are one tie): the final, the semi-finals, the quarter-finals. */
export const roundName = (ties: number) => ties === 1 ? 'Final' : ties === 2 ? 'Semi-finals' : ties === 4 ? 'Quarter-finals' : ties === 8 ? 'Round of 16' : 'Round {n}';

/**
 * A knockout stage as rounds of ties. With the draw's routes, each round is ordered so the two ties feeding one tie of
 * the next round sit together (an engine draw folds the seeds, 1 v 8, so fixture order alone does not); two legs are
 * read as one tie by the draw's aggregates. A legacy bracket, without routes, keeps fixture order.
 */
export function cupRounds(fixtures: TournamentFixtureDto[], routes: DrawState['routes'] = [], aggregates: DrawState['aggregates'] = []): CupRound[] {
    const firstLeg = new Map(aggregates.map(tie => [tie.deciding_fixture_id, tie.first_fixture_id]));
    const firstLegs = new Set(firstLeg.values());
    const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]));
    const deciding = fixtures.filter(fixture => !firstLegs.has(fixture.id) && fixture.status !== 'CANCELLED');
    const numbers = [...new Set(deciding.map(fixture => fixture.roundNumber ?? 1))].sort((a, b) => a - b);
    const inRound = (round: number) => deciding.filter(fixture => (fixture.roundNumber ?? 1) === round).sort((a, b) => (a.fixtureOrder ?? 0) - (b.fixtureOrder ?? 0));
    let rounds = new Map(numbers.map(round => [round, inRound(round)]));
    if (routes.length && numbers.length > 1) {
        const ordered = new Map<number, TournamentFixtureDto[]>();
        const visit = (fixture: TournamentFixtureDto) => {
            const round = fixture.roundNumber ?? 1;
            if (ordered.get(round)?.some(other => other.id === fixture.id)) return;
            ordered.set(round, [...(ordered.get(round) ?? []), fixture]);
            for (const slot of ['HOME', 'AWAY']) {
                const source = byId.get(routes.find(route => route.target_fixture_id === fixture.id && route.slot === slot)?.source_fixture_id ?? -1);
                if (source && !firstLegs.has(source.id)) visit(source);
            }
        };
        inRound(numbers[numbers.length - 1]).forEach(visit);
        for (const round of numbers) { const seen = new Set((ordered.get(round) ?? []).map(fixture => fixture.id)); ordered.set(round, [...(ordered.get(round) ?? []), ...inRound(round).filter(fixture => !seen.has(fixture.id))]); }
        rounds = ordered;
    }
    const tieOf = (last: TournamentFixtureDto): Tie => {
        const legs = [byId.get(firstLeg.get(last.id) ?? -1), last].filter((leg): leg is TournamentFixtureDto => Boolean(leg));
        const lead = legs[0], homeId = lead.homeEntryId, awayId = lead.awayEntryId;
        const scored = legs.every(leg => leg.status === 'COMPLETED' && leg.homeScore != null && leg.awayScore != null);
        const goals = (id: number | null) => legs.reduce((sum, leg) => sum + (leg.homeEntryId === id ? leg.homeScore ?? 0 : leg.awayEntryId === id ? leg.awayScore ?? 0 : 0), 0);
        const bye = last.status === 'COMPLETED' && (homeId == null) !== (awayId == null) && last.homeScore == null;
        const aggregate = aggregates.find(tie => tie.deciding_fixture_id === last.id)?.winner ?? null;
        const winner = aggregate ?? last.winnerEntryId ?? (scored && goals(homeId) !== goals(awayId) ? (goals(homeId) > goals(awayId) ? homeId : awayId) : null);
        const side = (id: number | null): TieSide => ({ entryId: id, score: scored ? goals(id) : null, won: winner != null && winner === id });
        return { id: last.id, fixtures: legs, home: side(homeId), away: side(awayId), state: bye ? 'bye' : scored ? (winner == null ? 'level' : 'played') : 'next', scheduledAt: lead.scheduledAt };
    };
    return numbers.map(round => { const ties = (rounds.get(round) ?? []).map(tieOf); return { round, name: roundName(ties.length), ties }; });
}

/**
 * The actual layer of a tournament's shape, from its detail and (for engine tournaments) its draw state: the cup's
 * rounds, the tables, the groups and their finals, a festival's rounds, a ladder. Null before anything is drawn. The
 * engine's groups are first-phase round-robin stages and how many go through is the draw's; a legacy tournament's
 * hand-built groups are typed GROUP and carry their own advance count. Groups are never guessed from a stage type
 * on an engine tournament.
 */
export function actualShape(detail: Pick<TournamentDetail, 'stages' | 'fixtures'>, rules: Pick<CompetitionRules, 'structure'> | null, draw: DrawState | null): ActualShape | null {
    if (!detail.stages.length) return null;
    const plan = draw?.plan ?? null;
    const byOrder = (a: TournamentStageDto, b: TournamentStageDto) => a.stageOrder - b.stageOrder || a.id - b.id;
    const drawn = (stageId: number) => draw?.stages.find(stage => stage.id === stageId);
    const fixturesOf = (stageId: number) => detail.fixtures.filter(fixture => fixture.stageId === stageId);
    const knockouts = detail.stages.filter(stage => stage.stageType === 'KNOCKOUT').sort(byOrder);
    const tables = detail.stages.filter(stage => stage.stageType !== 'KNOCKOUT').sort(byOrder);
    const table = (stage: TournamentStageDto, through: number | null): ShapeTable => ({ stageId: stage.id, name: stage.name, standings: drawn(stage.id)?.standings ?? null, through });
    const kind: ShapeKind = rules?.structure ? KIND[rules.structure] : knockouts.length && tables.length ? 'groups' : knockouts.length ? 'cup' : 'league';
    if (kind === 'festival') {
        const numbers = [...new Set(detail.fixtures.map(fixture => fixture.roundNumber ?? 1))].sort((a, b) => a - b);
        return { kind, rounds: numbers.map(round => ({ round, fixtures: detail.fixtures.filter(fixture => (fixture.roundNumber ?? 1) === round) })) };
    }
    if (kind === 'ladder') return { kind, table: tables[0] ? table(tables[0], null) : null, challenges: [...detail.fixtures].sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? '')) };
    if (kind === 'cup') {
        const main = knockouts.find(stage => (drawn(stage.id)?.phase ?? 1) === 1) ?? knockouts[0];
        const bronze = knockouts.find(stage => stage !== main);
        return { kind, rounds: main ? cupRounds(fixturesOf(main.id), draw?.routes, draw?.aggregates) : [], bronze: bronze ? cupRounds(fixturesOf(bronze.id), draw?.routes, draw?.aggregates)[0]?.ties[0] ?? null : null };
    }
    if (kind === 'groups') {
        const groups = plan ? tables.filter(stage => (drawn(stage.id)?.phase ?? 1) === 1) : tables;
        const qualifiers = plan ? plan.qualifiers : groups[0]?.advanceCount || null;
        return { kind, groups: groups.map(stage => table(stage, qualifiers)), finals: cupRounds(knockouts.flatMap(stage => fixturesOf(stage.id)), draw?.routes, draw?.aggregates), qualifiers };
    }
    return { kind: kind === 'swiss' ? 'swiss' : 'league', tables: tables.map(stage => table(stage, null)) };
}
