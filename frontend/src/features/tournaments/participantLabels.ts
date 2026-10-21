import type { TournamentEntryDto } from "./domain";

export const participantName = (entry?: TournamentEntryDto) =>
  entry?.squadName || entry?.clubName || entry?.displayName || "—";

/**
 * Names that tell one tournament's entries apart: the squad alone where it is unique, its club after it where two
 * clubs both bring a "Senior team" ("Senior team (Dinamo)", as the fixtures' own labels read). Read from the
 * entries' club and squad, so a list, a filter and a button's accessible name all say the same.
 */
export function distinctParticipantNames(entries: TournamentEntryDto[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(participantName(entry), (counts.get(participantName(entry)) ?? 0) + 1);
  return (entry?: TournamentEntryDto) => {
    const name = participantName(entry);
    return entry?.squadName && entry.clubName && entry.clubName !== entry.squadName && (counts.get(name) ?? 0) > 1
      ? `${entry.squadName} (${entry.clubName})` : name;
  };
}

// Approval and activation are separate server states. Only confirmed teams can be placed.
export const isBracketParticipant = (entry: TournamentEntryDto) =>
  (entry.clubId != null || entry.draftTeamId != null || entry.userId == null) &&
  entry.status === "ACTIVE";
