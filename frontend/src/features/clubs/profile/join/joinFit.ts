import type { PublicSquad, PublicStaff } from '../../publicJourney';
import { staffAreas } from '../../staffAreas';

/** The three ways into a club, in football words: to play, for my child, to help (jobs, volunteering, coaching). */
export type JoinPart = 'play' | 'child' | 'help';
export const JOIN_PARTS: readonly JoinPart[] = ['play', 'child', 'help'];
export const joinPartFrom = (value: string | null): JoinPart | null => JOIN_PARTS.find(part => part === value) ?? null;

/** Who a squad is looked at for: an age in years (unknown: every squad fits) and, for a child, their gender. */
export interface Player { age: number | null; gender?: 'MALE' | 'FEMALE' | null }

/** Adults are 16 and over here: senior football takes them; youth squads never do. */
const SENIOR_FROM = 16;

/**
 * Whether a squad suits a player. "U14" is for 11 to 13 (the three years under its limit); "Senior" and any other
 * open age group for 16 and over. A boys' or men's squad is not for a girl, and the other way round; mixed is for all.
 * An unknown age or gender rules nothing out.
 */
export function squadFits(squad: PublicSquad, player: Player) {
    const gender = squad.gender?.toUpperCase();
    if (player.gender && (gender === 'MALE' || gender === 'FEMALE') && gender !== player.gender) return false;
    if (player.age == null) return true;
    const under = /^U(\d{1,2})$/i.exec(squad.category?.trim() ?? '');
    if (under) { const limit = Number(under[1]); return player.age < limit && player.age >= limit - 3; }
    return player.age >= SENIOR_FROM;
}

const COACHING = ['HEAD_COACH', 'ASSISTANT_COACH', 'GOALKEEPER_COACH', 'SPECIALIST_COACH'];

const squadIdsOf = (item: PublicStaff['responsibilities'][number]) => item.squadIds ?? (item.squadId == null ? [] : [item.squadId]);

/**
 * The squads with no coach on the club's public page. Only when the page says who coaches which squad: a coach listed
 * without squads, or one for the whole club, could be coaching any of them, and then no squad is named. It reads
 * "No coach on the club page", never "needs a coach".
 */
export function squadsWithoutCoach(squads: PublicSquad[], staff: PublicStaff[]) {
    const coaching = staff.filter(person => person.role === 'COACH' || staffAreas(person).includes('coaching'));
    const unknown = coaching.some(person => !person.responsibilities.length
        || person.responsibilities.some(item => item.clubWide === true || (item.specialisations.some(code => COACHING.includes(code)) && !squadIdsOf(item).length)));
    if (unknown || !coaching.length) return [];
    const covered = new Set(coaching.flatMap(person => person.responsibilities.flatMap(squadIdsOf)));
    return squads.filter(squad => !covered.has(squad.id));
}

/**
 * The part the pop-up opens on, from what the person said they came for. Under 18 only Play is offered (jobs and
 * children are for adults, as in the welcome). An adult starts at Play only after picking "Play for me" at sign-up (a
 * 40-year-old is not taken for a player: the owner, 2 November 2026), at My child as a parent or after "My child",
 * and otherwise at Help out. Every part stays one press away.
 */
export function startingPart({ minor, choice, hasChildren }: { minor: boolean; choice?: string | null; hasChildren: boolean }): JoinPart {
    if (minor || choice === 'ME') return 'play';
    if (hasChildren || choice === 'CHILD') return 'child';
    return 'help';
}

/** The parts a person is offered: only Play under 18. */
export const partsFor = (minor: boolean): readonly JoinPart[] => (minor ? ['play'] : JOIN_PARTS);
