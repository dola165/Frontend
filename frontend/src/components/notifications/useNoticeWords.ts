import { useTranslation } from 'react-i18next';
import type { NotificationItem } from '../../types/notifications';
import { notificationTypeLabel } from '../../utils/notifications';

type Words = Pick<NotificationItem, 'title' | 'body' | 'titleKa' | 'bodyKa'>;

/** A notice's words in the reader's language: Georgian when the notice was written in both. */
export const noticeWords = (notice: Words, language: string | undefined) =>
    language?.startsWith('ka') && notice.titleKa
        ? { title: notice.titleKa, body: notice.bodyKa ?? '' }
        : { title: notice.title, body: notice.body };

/** What step 3's notices are about, in a word or two, where a type's code would otherwise show. */
const TYPE_WORDS: Record<string, readonly [en: string, ka: string]> = {
    FAMILY_PARENT_ASK: ['Parent request', 'მშობლის მოთხოვნა'],
    FAMILY_NEW_PARENT: ['New parent', 'ახალი მშობელი'],
    FAMILY_LINK_UNDONE: ['Parent link undone', 'მშობლის კავშირი გაუქმდა'],
    FAMILY_ASKS: ['Questions from the club', 'კითხვები კლუბისგან'],
    FAMILY_ASK_ANSWERED: ['A parent answered', 'მშობელმა უპასუხა'],
    FAMILY_TEEN_TRIAL: ['Your child’s trial', 'თქვენი შვილის სასინჯი ვარჯიში'],
    CLUB_TEEN_TRIAL: ['A teen’s trial', 'მოზარდის სასინჯი ვარჯიში'],
    CLUB_PERMISSION_REQUEST: ['Permission asked', 'ითხოვენ ნებართვას'],
    CLUB_PERMISSION_COVERED: ['Your yes covers it', 'თქვენი თანხმობა მოქმედებს'],
    CLUB_STAFF_CHILDREN_YES: ['Children’s details', 'ბავშვების მონაცემები'],
    CLUB_STAFF_LINK_OFF: ['Staff link', 'თანამშრომლის ბმული'],
    ADMISSION_ASK_PARENT: ['A parent is needed', 'საჭიროა მშობელი'],
    ADMISSION_PAPER_SIGNED: ['Signed form', 'ხელმოწერილი ფორმა'],
    JOINING_AWAITS_PARENT: ['Waiting for a parent', 'მშობელს ელოდება'],
    PARENT_APPROVAL_REMINDER: ['Parent’s approval', 'მშობლის თანხმობა'],
    WELFARE_CONCERN_RECEIVED: ['Confidential concern', 'კონფიდენციალური შეტყობინება'],
    WELFARE_CONCERN_CLOSED: ['Concern dealt with', 'შეტყობინება განხილულია'],
};

export const noticeTypeWord = (type: string, language: string | undefined) => {
    const words = TYPE_WORDS[type];
    if (!words) return notificationTypeLabel(type);
    return language?.startsWith('ka') ? words[1] : words[0];
};

export function useNoticeTypeWord() {
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    return (type: string) => noticeTypeWord(type, language);
}

export function useNoticeWords() {
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    return (notice: Words) => noticeWords(notice, language);
}
