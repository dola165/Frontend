import { describe, expect, it } from 'vitest';
import { noticeTypeWord, noticeWords } from '../useNoticeWords';

const cancelled = {
    title: "Tuesday's U10 training is cancelled",
    body: 'Tuesday 4 November, 17:00.',
    titleKa: 'სამშაბათის U10 ვარჯიში გაუქმდა',
    bodyKa: 'სამშაბათი, 4 ნოემბერი, 17:00.',
};

describe('noticeTypeWord', () => {
    it('gives step 3\'s notices words in both languages, and others their name as before', () => {
        expect(noticeTypeWord('FAMILY_PARENT_ASK', 'en')).toBe('Parent request');
        expect(noticeTypeWord('FAMILY_PARENT_ASK', 'ka')).toBe('მშობლის მოთხოვნა');
        expect(noticeTypeWord('CLUB_STAFF_CHILDREN_YES', 'en')).toBe('Children’s details');
        expect(noticeTypeWord('FAMILY_LINK_UNDONE', 'ka')).toBe('მშობლის კავშირი გაუქმდა');
        expect(noticeTypeWord('TRYOUT_APPLICATION_REJECTED', 'en')).toBe('Tryout Application Rejected');
    });
});

describe('noticeWords', () => {
    it('shows a Georgian reader the Georgian words', () => {
        expect(noticeWords(cancelled, 'ka')).toEqual({ title: cancelled.titleKa, body: cancelled.bodyKa });
    });

    it('shows an English reader the English words', () => {
        expect(noticeWords(cancelled, 'en')).toEqual({ title: cancelled.title, body: cancelled.body });
    });

    it('falls back to English for a notice written in English only', () => {
        expect(noticeWords({ title: 'Club invitation', body: 'Dinamo invited you.', titleKa: null, bodyKa: null }, 'ka'))
            .toEqual({ title: 'Club invitation', body: 'Dinamo invited you.' });
    });
});
