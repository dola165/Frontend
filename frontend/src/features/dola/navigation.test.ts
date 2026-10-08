import { describe, expect, it } from 'vitest';
import { isDolaQuestion, readDolaHandoff, dolaNavigationState } from './navigation';

describe('Dola search intent', () => {
    it.each(['How do I join a club?', 'Where is my calendar', 'Can I book a pitch?', 'Explain squad invitations', 'როგორ ვიპოვო კლუბი?', 'სად არის კალენდარი?', '@dola help with training'])('recognizes a question: %s', query => {
        expect(isDolaQuestion(query)).toBe(true);
    });
    it.each(['Giorgi Beridze', 'FC Dinamo Tbilisi', 'Will Smith', 'What If FC', '@howard', 'U16 tournament', 'boots for sale', 'გიორგი ბერიძე', 'დინამო თბილისი', '"How we play"'])('keeps ordinary searches: %s', query => {
        expect(isDolaQuestion(query)).toBe(false);
    });
    it('binds a handoff to the initiating account session', () => {
        const state = dolaNavigationState('  Where is my club? ', 'session-a');
        expect(readDolaHandoff(state, 'session-a')?.message).toBe('Where is my club?');
        expect(readDolaHandoff(state, 'session-b')).toBeNull();
        expect(readDolaHandoff({ dolaQuestion: { message: 'hello', sessionId: 'session-a', requestId: 'invalid' } }, 'session-a')).toBeNull();
    });
});
