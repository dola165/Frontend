import { describe, expect, it } from 'vitest';
import { defaultRules } from '../../competitions/api';
import { drawPeek, entryPolicyOf, freshDraft, openDraft, parseDrawSeed, readDrawDraft } from './drawDraft';
import { drawEstimate, durationParts } from './drawEstimate';

describe('the Draw room’s address', () => {
    it('carries the organiser and the family it starts from, and reads them back', () => {
        expect(drawPeek()).toBe('draw-new');
        expect(drawPeek({ organizerId: 901, family: 'LEAGUE' })).toBe('draw-o901.fLEAGUE');
        expect(parseDrawSeed('o901.fLEAGUE')).toEqual({ organizerId: 901, family: 'LEAGUE' });
        expect(parseDrawSeed('new')).toEqual({});
        expect(parseDrawSeed('o0.fTRAMPOLINE')).toEqual({});
    });
});

describe('a new tournament', () => {
    it('starts with the likely answers: a Saturday three weeks out, entries closing a week before, private, the usual wording', () => {
        const draft = freshDraft({ family: 'CUP' }, 'U14', new Date(2026, 9, 12, 12));
        expect(draft.startDate).toBe('2026-10-31T10:00');
        expect(draft.endDate).toBe('2026-10-31T17:00');
        expect(draft.closesAt).toBe('2026-10-24T00:00');
        expect(draft).toMatchObject({ visibility: 'PRIVATE', entryCap: 8, registrationPolicy: 'APPROVAL_ONLY', rules: { ageGroup: 'U14', ageCutoff: '2026-10-31', sideSize: 9, matchMinutes: 60 } });
        expect(draft.rules.ruleset).not.toMatch(/UEFA|FIFA|GFF/);
        expect(freshDraft({ family: 'LEAGUE' }, 'SENIOR', new Date(2026, 9, 12)).endDate).toBe('2026-12-26T17:00');
    });

    it('continues only a draft this version can read', () => {
        const draft = freshDraft();
        expect(readDrawDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
        expect(readDrawDraft({ ...draft, scope: 'TEAM' })).toBeNull();
        expect(readDrawDraft({ ...draft, rules: { ...draft.rules, structure: 'LADDER' } })).toBeNull();
        expect(readDrawDraft('nonsense')).toBeNull();
    });

    it('opens from its address: fresh when nothing was written, else the kept draft under the address’s organiser and format', () => {
        const kept = { ...freshDraft({ organizerId: 901, family: 'CUP' }), hostClubId: 2 };
        expect(openDraft(kept, { organizerId: 17, family: 'LEAGUE' }, 'SENIOR')).toMatchObject({ organizerId: 17, rules: { family: 'LEAGUE' } });
        const written = { ...kept, name: 'Autumn Cup' };
        expect(openDraft(written, { organizerId: 17, family: 'LEAGUE' }, 'SENIOR')).toMatchObject({ name: 'Autumn Cup', organizerId: 17, hostClubId: null, rules: { family: 'LEAGUE', structure: 'ROUND_ROBIN' } });
        expect(openDraft(written, {}, 'SENIOR')).toBe(written);
    });

    it('takes entries as they come only where the backend would: squads or players in an Open tournament', () => {
        const draft = { ...freshDraft(), registrationPolicy: 'OPEN' as const };
        expect(entryPolicyOf(draft)).toBe('APPROVAL_ONLY');
        expect(entryPolicyOf({ ...draft, scope: 'SQUAD' })).toBe('OPEN');
        expect(entryPolicyOf({ ...draft, scope: 'SQUAD', rules: { ...draft.rules, eligibilityCategory: 'Girls' } })).toBe('APPROVAL_ONLY');
    });
});

describe('the estimate', () => {
    const rules = (structure: Parameters<typeof drawEstimate>[0]['structure'], extra = {}) => ({ ...defaultRules(), structure, matchMinutes: 40, restMinutes: 10, pitches: 2, rounds: 3, ...extra });
    it('counts a cup’s matches and the time on its pitches', () => {
        expect(drawEstimate(rules('KNOCKOUT'), 8)).toEqual({ matches: 7, minutes: 190, matchdays: null, setAtDraw: false });
        expect(durationParts(190)).toEqual({ hours: 3, minutes: 10 });
    });
    it('counts a league in matchdays, and marks what the draw decides', () => {
        expect(drawEstimate(rules('ROUND_ROBIN'), 6)).toMatchObject({ matches: 15, matchdays: 5 });
        expect(drawEstimate(rules('HOME_AWAY'), 5)).toMatchObject({ matches: 20, matchdays: 10 });
        expect(drawEstimate(rules('GROUPS_KNOCKOUT'), 8)).toMatchObject({ matches: 15, setAtDraw: true });
        expect(drawEstimate(rules('LADDER'), 8).matches).toBeNull();
    });
});
