import type { TournamentFixtureDto } from "./domain";
import type { BracketSlot } from "./components/TournamentBracketMatch";

/** The server advances into the next match by opening-round order. Never accept an unrelated drop. */
export function isWinnerDestination(
  source: TournamentFixtureDto,
  destination: TournamentFixtureDto,
  slot: BracketSlot,
) {
  return (
    source.stageId === destination.stageId &&
    source.status === "SCHEDULED" &&
    destination.status === "SCHEDULED" &&
    destination.linkedMatchId == null &&
    (destination.roundNumber ?? 1) === (source.roundNumber ?? 1) + 1 &&
    destination.fixtureOrder === Math.ceil((source.fixtureOrder ?? 1) / 2) &&
    slot === ((source.fixtureOrder ?? 1) % 2 ? "HOME" : "AWAY") &&
    (slot === "HOME" ? destination.homeEntryId : destination.awayEntryId) ==
      null
  );
}

export function hasCompletedFeeders(
  fixture: TournamentFixtureDto,
  fixtures: TournamentFixtureDto[],
) {
  if ((fixture.roundNumber ?? 1) <= 1) return true;
  const order = fixture.fixtureOrder ?? 1;
  return [order * 2 - 1, order * 2].every((sourceOrder) =>
    fixtures.some(
      (source) =>
        source.stageId === fixture.stageId &&
        source.roundNumber === (fixture.roundNumber ?? 1) - 1 &&
        source.fixtureOrder === sourceOrder &&
        source.status === "COMPLETED",
    ),
  );
}

