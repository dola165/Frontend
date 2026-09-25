import type { TournamentEntryDto } from "./domain";

export const participantName = (entry?: TournamentEntryDto) =>
  entry?.squadName || entry?.clubName || entry?.displayName || "—";

// Approval and activation are separate server states. Only confirmed teams can be placed.
export const isBracketParticipant = (entry: TournamentEntryDto) =>
  (entry.clubId != null || entry.draftTeamId != null || entry.userId == null) &&
  entry.status === "ACTIVE";
