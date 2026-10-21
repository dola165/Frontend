import { describe, expect, it } from 'vitest';
import { freshDraft } from '../../tournaments/create/drawDraft';
import { drawProblem } from '../compose/draw/useDrawRoom';

const NOW = Date.parse('2026-10-12T12:00:00+04:00');
const draft = (patch = {}, rules = {}) => { const base = freshDraft({ family: 'CUP' }, 'U14', new Date(NOW)); return { ...base, name: 'Winter Cup', ...patch, rules: { ...base.rules, ...rules } }; };

describe('what stops a tournament being created, said before sending', () => {
    it('lets a complete draft through', () => {
        expect(drawProblem(draft(), 901, NOW)).toBeNull();
    });

    it('asks for an organiser first, then the rules the backend checks, the name last', () => {
        expect(drawProblem(draft(), null, NOW)?.field).toBe('organiser');
        expect(drawProblem(draft({ scope: 'PLAYER' }), 901, NOW)?.field).toBe('scope');
        expect(drawProblem(draft({ entryCap: 40 }), 901, NOW)?.field).toBe('entryCap');
        expect(drawProblem(draft({ startDate: '2026-10-01T10:00' }), 901, NOW)?.field).toBe('startDate');
        expect(drawProblem(draft({ endDate: '2026-10-30T10:00' }), 901, NOW)?.field).toBe('endDate');
        expect(drawProblem(draft({ closesAt: '2026-11-02T00:00' }), 901, NOW)?.field).toBe('closesAt');
        expect(drawProblem(draft({}, { ageCutoff: null }), 901, NOW)?.field).toBe('ageCutoff');
        expect(drawProblem(draft({}, { matchMinutes: 200 }), 901, NOW)).toMatchObject({ field: 'matchMinutes', vars: { max: 120 } });
        expect(drawProblem(draft({}, { ruleset: ' ' }), 901, NOW)?.field).toBe('ruleset');
        expect(drawProblem(draft({ name: '' }), 901, NOW)?.field).toBe('name');
    });

    it('lets an adults’ tournament take players on their own', () => {
        expect(drawProblem(draft({ scope: 'PLAYER' }, { ageGroup: 'SENIOR', ageCutoff: null }), 901, NOW)).toBeNull();
    });
});
