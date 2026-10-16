import { describe, expect, it } from 'vitest';
import { chooseDolaContext } from './suggestions';
import { dolaSubject } from './subject';

describe('what Dola is asked about', () => {
    it('takes the record on screen from the address', () => {
        expect(dolaSubject('/my-squads', '?tab=updates&squad=103')).toEqual({ kind: 'SQUAD', id: 103 });
        expect(dolaSubject('/squads/105', '')).toEqual({ kind: 'SQUAD', id: 105 });
        expect(dolaSubject('/jobs/12', '')).toEqual({ kind: 'JOB', id: 12 });
        expect(dolaSubject('/campaigns/90012', '')).toEqual({ kind: 'FUNDRAISER', id: 90012 });
        expect(dolaSubject('/clubs/1/store', '')).toEqual({ kind: 'CLUB', id: 1 });
        expect(dolaSubject('/my-squads', '')).toBeNull();
        expect(dolaSubject('/home', '?player=4')).toBeNull();
    });
    it('on Parent Hub, the child chosen in the address or remembered for the session', () => {
        expect(dolaSubject('/parent', '?player=4', 9)).toEqual({ kind: 'CHILD', id: 4 });
        expect(dolaSubject('/parent', '', 9)).toEqual({ kind: 'CHILD', id: 9 });
        expect(dolaSubject('/parent', '?player=x')).toBeNull();
    });
    it('treats My squads as the coach context for a coach who is also a parent', () => {
        expect(chooseDolaContext(['family', 'coach', 'discover'], '/my-squads')).toBe('coach');
        expect(chooseDolaContext(['family', 'discover'], '/my-squads')).toBe('family');
    });
});
