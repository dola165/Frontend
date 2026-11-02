import { describe, expect, it } from 'vitest';
import type { PublicSquad, PublicStaff } from '../../publicJourney';
import { joinPartFrom, partsFor, squadFits, squadsWithoutCoach, startingPart } from './joinFit';

const squad = (id: number, category: string, gender?: string): PublicSquad => ({ id, name: `${category} ${gender ?? ''}`.trim(), category, gender });
const coach = (squadIds: number[] | null, extra: Partial<PublicStaff> = {}): PublicStaff => ({
    userId: Math.random(), fullName: 'Coach', role: 'COACH',
    responsibilities: squadIds ? [{ title: 'Head coach', specialisations: ['HEAD_COACH'], squadId: null, squadName: null, squadIds, startsOn: '2026-01-01', endsOn: null }] : [],
    ...extra,
});

describe('which squads suit a player', () => {
    it('never offers a youth squad to an adult, and offers senior squads from 16', () => {
        const squads = [squad(1, 'U12'), squad(2, 'U14'), squad(3, 'U19'), squad(4, 'SENIOR', 'MALE')];
        expect(squads.filter(item => squadFits(item, { age: 40 })).map(item => item.id)).toEqual([4]);
        expect(squads.filter(item => squadFits(item, { age: 16 })).map(item => item.id)).toEqual([3, 4]);
    });

    it('takes the three years under an age limit, and the right gender', () => {
        expect(squadFits(squad(1, 'U14'), { age: 13 })).toBe(true);
        expect(squadFits(squad(1, 'U14'), { age: 11 })).toBe(true);
        expect(squadFits(squad(1, 'U14'), { age: 10 })).toBe(false);
        expect(squadFits(squad(1, 'U14'), { age: 14 })).toBe(false);
        expect(squadFits(squad(1, 'U14', 'MALE'), { age: 12, gender: 'FEMALE' })).toBe(false);
        expect(squadFits(squad(1, 'U14', 'MIXED'), { age: 12, gender: 'FEMALE' })).toBe(true);
    });

    it('rules nothing out when the age is unknown', () => {
        expect(squadFits(squad(1, 'U8'), { age: null })).toBe(true);
    });
});

describe('squads with no coach on the club page', () => {
    const squads = [squad(1, 'U12'), squad(2, 'U14')];
    it('names a squad no coach is listed for', () => {
        expect(squadsWithoutCoach(squads, [coach([1])]).map(item => item.id)).toEqual([2]);
    });
    it('names none when the page cannot tell: a coach without squads, a coach for the whole club, or no coaches at all', () => {
        expect(squadsWithoutCoach(squads, [coach([1]), coach(null)])).toEqual([]);
        expect(squadsWithoutCoach(squads, [coach([1], { responsibilities: [{ title: 'Head of coaching', specialisations: ['HEAD_COACH'], squadId: null, squadName: null, clubWide: true, startsOn: '2026-01-01', endsOn: null }] })])).toEqual([]);
        expect(squadsWithoutCoach(squads, [])).toEqual([]);
    });
});

describe('where the pop-up opens', () => {
    it('opens on Play under 18, with no other part', () => {
        expect(startingPart({ minor: true, choice: 'CHILD', hasChildren: false })).toBe('play');
        expect(partsFor(true)).toEqual(['play']);
    });
    it('opens on Play for an adult only after "Play for me" at sign-up', () => {
        expect(startingPart({ minor: false, choice: 'ME', hasChildren: false })).toBe('play');
        expect(startingPart({ minor: false, choice: null, hasChildren: false })).toBe('help');
        expect(startingPart({ minor: false, choice: 'FOLLOW', hasChildren: false })).toBe('help');
    });
    it('opens on My child for a parent', () => {
        expect(startingPart({ minor: false, choice: 'WORK', hasChildren: true })).toBe('child');
        expect(startingPart({ minor: false, choice: 'CHILD', hasChildren: false })).toBe('child');
    });
    it('reads the part from the address', () => {
        expect(joinPartFrom('help')).toBe('help');
        expect(joinPartFrom('1')).toBeNull();
    });
});
