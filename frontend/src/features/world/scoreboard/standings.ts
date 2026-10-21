import type { GroupStandingsRow, TournamentFixtureDto } from '../../tournaments/domain';

/** A table row as a score site shows it: position, team, played, goal difference, points. */
export interface TableRow { entryId: number; rank: number; label: string; played: number; gd: number; points: number; mine: boolean; /** Lit without being mine (both sides of the match looked at). */ marked?: boolean }

/**
 * Standings in table order (points, goal difference, goals scored), with the viewer's entries marked. With
 * `keepOrder`, the backend's own ranking stands (it applies the competition's tie-breaks, which points alone cannot).
 */
export function tableRows(rows: GroupStandingsRow[], mine: Set<number>, { keepOrder = false, marked }: { keepOrder?: boolean; marked?: Set<number> } = {}): TableRow[] {
    return (keepOrder ? [...rows] : [...rows].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.entryName.localeCompare(b.entryName)))
        .map((row, index) => ({ entryId: row.entryId, rank: index + 1, label: row.entryName, played: row.played, gd: row.goalDifference, points: row.points, mine: mine.has(row.entryId), ...(marked?.has(row.entryId) ? { marked: true } : {}) }));
}

/** A long table kept short: the top three, a gap, then my row with its neighbours. Short tables stay whole. */
export function windowAround(rows: TableRow[], max = 8): (TableRow | 'gap')[] {
    if (rows.length <= max) return rows;
    const at = rows.findIndex(row => row.mine || row.marked);
    if (at < max - 1) return rows.slice(0, max);
    return [...rows.slice(0, 3), 'gap', ...rows.slice(Math.max(3, at - 1), at + 2)];
}

/** One step of a knockout run: the round, and won, lost or still to play. */
export interface CupStep { round: string; /** 'level': played and level, the winner not recorded yet. */ state: 'W' | 'L' | 'level' | 'next'; score?: string; date?: string | null; fixtureId: number }

/** Round names by how many matches the round has: one is the final, two the semi-finals, four the quarter-finals. */
function roundName(fixtures: TournamentFixtureDto[], fixture: TournamentFixtureDto) {
    const size = fixtures.filter(other => other.stageId === fixture.stageId && other.roundNumber === fixture.roundNumber).length;
    return size === 1 ? 'Final' : size === 2 ? 'Semi-final' : size === 4 ? 'Quarter-final' : `Round ${fixture.roundNumber ?? 1}`;
}

/** An entry's way through a knockout stage, and whether it is out. */
export function cupPath(fixtures: TournamentFixtureDto[], entryIds: Set<number>): { steps: CupStep[]; eliminated: boolean } {
    const mine = fixtures.filter(fixture => fixture.status !== 'CANCELLED' && (entryIds.has(fixture.homeEntryId ?? -1) || entryIds.has(fixture.awayEntryId ?? -1)))
        .sort((a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0));
    const steps = mine.map((fixture): CupStep => {
        const home = entryIds.has(fixture.homeEntryId ?? -1);
        if (fixture.status !== 'COMPLETED' || fixture.homeScore == null || fixture.awayScore == null) return { round: roundName(fixtures, fixture), state: 'next', date: fixture.scheduledAt, fixtureId: fixture.id };
        const ours = home ? fixture.homeScore : fixture.awayScore, theirs = home ? fixture.awayScore : fixture.homeScore;
        // A level tie without a recorded winner (penalties not entered yet) is neither won nor lost.
        const state = fixture.winnerEntryId != null ? (entryIds.has(fixture.winnerEntryId) ? 'W' : 'L') : ours === theirs ? 'level' : ours > theirs ? 'W' : 'L';
        return { round: roundName(fixtures, fixture), state, score: `${ours}–${theirs}`, fixtureId: fixture.id };
    });
    return { steps, eliminated: steps.some(step => step.state === 'L') };
}

/** The entry's next match still to play. */
export function nextFixture(fixtures: TournamentFixtureDto[], entryIds: Set<number>) {
    return fixtures.filter(fixture => fixture.status === 'SCHEDULED' && (entryIds.has(fixture.homeEntryId ?? -1) || entryIds.has(fixture.awayEntryId ?? -1)))
        .sort((a, b) => Date.parse(a.scheduledAt ?? '9999') - Date.parse(b.scheduledAt ?? '9999'))[0] ?? null;
}

/**
 * Tournament times carry the venue's wall clock without a zone ("2026-10-17T18:00:00"), and a day alone ("2026-10-17")
 * is its midnight. Every competition so far is in Georgia, UTC+4 all year, so that is how they are read (backend
 * needed: the zone on tournament times). The one place they are read.
 */
export const zoned = (value: string | null | undefined) => value
    ? (/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value.includes('T') ? value : `${value}T00:00`}+04:00`) : null;
