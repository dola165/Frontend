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
const VETERANS_FROM = 35;

/**
 * Whether a squad suits a player, from its age group as the club typed it. "U14", "U-14" or "U14 A" is for 11 to 13
 * (the three years under its limit); a birth year ("2014") for those born within a year of it; "Senior", "Adult" or
 * "Open" for 16 and over; "Veterans" or "O35" for 35 and over (or the age it names). An age group it cannot read suits
 * no one, so a youth squad is never offered to an adult. A boys' or men's squad is not for a girl, and the other way
 * round; mixed is for all. An unknown age or gender rules nothing out.
 */
export function squadFits(squad: Pick<PublicSquad, 'category' | 'gender'>, player: Player, year = new Date().getFullYear()) {
    const gender = squad.gender?.toUpperCase();
    if (player.gender && (gender === 'MALE' || gender === 'FEMALE') && gender !== player.gender) return false;
    if (player.age == null) return true;
    const category = squad.category?.trim().toUpperCase() ?? '';
    const under = /^U[\s-]?(\d{1,2})(?!\d)/.exec(category);
    if (under) { const limit = Number(under[1]); return player.age < limit && player.age >= limit - 3; }
    if (/^(19|20)\d{2}$/.test(category)) return Math.abs(Number(category) - (year - player.age)) <= 1;
    const over = /^O[\s-]?(\d{2})$/.exec(category);
    if (over) return player.age >= Number(over[1]);
    if (/^(VETERAN|MASTERS)/.test(category)) return player.age >= VETERANS_FROM;
    if (/^(SENIOR|ADULT|OPEN|FIRST)/.test(category)) return player.age >= SENIOR_FROM;
    return false;
}

const ages = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/**
 * Who a squad's own link can be for, by the same rule: children (younger than senior football) and/or adults. Null
 * when its age group can't be read, so nobody is turned away by a guess.
 */
export function squadAudience(squad: Pick<PublicSquad, 'category' | 'gender'>): { children: boolean; adults: boolean } | null {
    const fits = (age: number) => squadFits(squad, { age });
    const children = ages(3, SENIOR_FROM - 1).some(fits), adults = ages(18, 70).some(fits);
    return children || adults ? { children, adults } : null;
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
