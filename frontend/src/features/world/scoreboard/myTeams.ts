import type { AuthSessionId } from '../../../utils/authStorage';
import type { Squad } from '../../matchExchange/api';
import { mySquads } from '../../matchExchange/arrange/api';
import { spaces } from '../../squadCommunication/api';
import { shared, detached } from '../cache';

/** The squads the person coaches, plays in or has a child in, and their clubs: what gets a star on a score line. */
export interface MyTeams {
    squadIds: Set<number>; clubIds: Set<number>; /** The clubs of the squads I may arrange matches for: where arranging work is mine. */ arrangeClubIds: Set<number>;
    /** My squads' names by id ("U14 Boys"), and their age groups ("U14"). */ names: Map<number, string>; ages: Set<string>;
}
export const NO_TEAMS: MyTeams = { squadIds: new Set(), clubIds: new Set(), arrangeClubIds: new Set(), names: new Map(), ages: new Set() };


/**
 * My teams, from the squads I may arrange matches for and my squad spaces (coach, player or parent). Shared for a
 * minute; either list failing leaves the other. Backend needed: `/match-history` returning which of my squads a row
 * involves, so this is not worked out in the browser.
 */
export const loadMyTeams = (sessionId: AuthSessionId): Promise<MyTeams> => shared(`my-teams:${sessionId}`, async () => {
    const [arrangeable, mine] = await Promise.all([
        mySquads(detached()).catch((): Squad[] => []),
        spaces(detached()).catch(() => []),
    ]);
    const squads = [...arrangeable.map(squad => ({ id: squad.id, clubId: squad.club_id, name: squad.name, age: squad.category })), ...mine.map(space => ({ id: space.id, clubId: space.club_id, name: space.name, age: space.category }))];
    return {
        squadIds: new Set(squads.map(squad => squad.id)), clubIds: new Set(squads.map(squad => squad.clubId)), arrangeClubIds: new Set(arrangeable.map(squad => squad.club_id)),
        names: new Map(squads.map(squad => [squad.id, squad.name])), ages: new Set(squads.map(squad => squad.age).filter(Boolean)),
    };
});

/**
 * Whether one side of a match is mine: by its squad when the side names one, by its club only when it names none.
 * A side naming another squad of my club is not mine (an academy has many squads).
 */
export const sideIsMine = (side: { clubId: number | null; squadId: number | null }, mine: MyTeams) =>
    side.squadId != null ? mine.squadIds.has(side.squadId) : side.clubId != null && mine.clubIds.has(side.clubId);
