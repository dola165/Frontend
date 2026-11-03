import { describe, expect, it } from 'vitest';
import { noticeWords } from '../useNoticeWords';

const cancelled = {
    title: "Tuesday's U10 training is cancelled",
    body: 'Tuesday 4 November, 17:00.',
    titleKa: 'სამშაბათის U10 ვარჯიში გაუქმდა',
    bodyKa: 'სამშაბათი, 4 ნოემბერი, 17:00.',
};

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
