import type { HistoryMatch } from '../../matchHistory/api';
import type { Match, Squad } from '../../matchExchange/api';
import { isoDayOf } from '../format';
import { fitsGender, type MySquad } from '../front/coach/mySquads';

/** A squad that can answer an open match: its age group and, from its name, who plays in it. */
export type FitSquad = Pick<MySquad, 'id' | 'clubId' | 'name' | 'ageGroup' | 'gender'>;

/** The squads I may arrange matches for, with the gender their name says ("U14 Girls"), as squads that can answer. */
export const fitSquads = (squads: Squad[]): FitSquad[] => squads.map(squad => ({
    id: squad.id, clubId: squad.club_id, name: squad.name, ageGroup: squad.category,
    gender: /girls|women|female/i.test(squad.name) ? 'FEMALE' : /boys|men\b|male/i.test(squad.name) ? 'MALE' : /mixed/i.test(squad.name) ? 'MIXED' : null,
}));

/**
 * The squad of mine an open match suits: the same age group and a gender the listing admits (read from its squad's
 * name: backend needed, a gender on listings). Never for my own club's listings, one sent to a club, or one already
 * agreed.
 */
export function fitOf(match: Match, squads: FitSquad[]): FitSquad | null {
    if (squads.some(squad => squad.clubId === match.club_id) || match.requested_club_id != null || match.opponent_club_id != null) return null;
    return squads.find(squad => squad.ageGroup === match.age_group && fitsGender(match.squad_name, squad.gender)) ?? null;
}

/** The days each of my squads already plays, from my coming matches. */
export function busyDaysOf(upcoming: HistoryMatch[], squads: FitSquad[]): Map<number, Set<string>> {
    const busy = new Map(squads.map(squad => [squad.id, new Set<string>()]));
    for (const match of upcoming) {
        if (!match.startsAt || match.fixtureStatus === 'CANCELLED') continue;
        for (const id of [match.homeSquadId, match.awaySquadId]) if (id != null) busy.get(id)?.add(isoDayOf(match.startsAt));
    }
    return busy;
}
