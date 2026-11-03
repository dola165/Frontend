import { useTranslation } from 'react-i18next';
import type { NotificationItem } from '../../types/notifications';

type Words = Pick<NotificationItem, 'title' | 'body' | 'titleKa' | 'bodyKa'>;

/** A notice's words in the reader's language: Georgian when the notice was written in both. */
export const noticeWords = (notice: Words, language: string | undefined) =>
    language?.startsWith('ka') && notice.titleKa
        ? { title: notice.titleKa, body: notice.bodyKa ?? '' }
        : { title: notice.title, body: notice.body };

export function useNoticeWords() {
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    return (notice: Words) => noticeWords(notice, language);
}
