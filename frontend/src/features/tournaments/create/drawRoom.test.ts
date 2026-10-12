import { describe, expect, it } from 'vitest';
import { defaultRules } from '../../competitions/api';
import { drawPeek, freshDraft, parseDrawSeed, readDrawDraft } from './drawDraft';
import { drawEstimate, durationWords } from './drawEstimate';

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
        expect(draft).toMatchObject({ visibility: 'PRIVATE', entryCap: 8, registrationPolicy: 'APPROVAL_ONLY', rules: { ageGroup: 'U14', ageCutoff: '2012-01-01', sideSize: 9, matchMinutes: 60 } });
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
});

describe('the estimate', () => {
    const rules = (structure: Parameters<typeof drawEstimate>[0]['structure'], extra = {}) => ({ ...defaultRules(), structure, matchMinutes: 40, restMinutes: 10, pitches: 2, rounds: 3, ...extra });
    it('counts a cup’s matches and the time on its pitches', () => {
        expect(drawEstimate(rules('KNOCKOUT'), 8)).toEqual({ matches: 7, minutes: 190, matchdays: null, setAtDraw: false });
        expect(durationWords(190)).toBe('3 h 10');
    });
    it('counts a league in matchdays, and marks what the draw decides', () => {
        expect(drawEstimate(rules('ROUND_ROBIN'), 6)).toMatchObject({ matches: 15, matchdays: 5 });
        expect(drawEstimate(rules('HOME_AWAY'), 5)).toMatchObject({ matches: 20, matchdays: 10 });
        expect(drawEstimate(rules('GROUPS_KNOCKOUT'), 8)).toMatchObject({ matches: 15, setAtDraw: true });
        expect(drawEstimate(rules('LADDER'), 8).matches).toBeNull();
    });
});
