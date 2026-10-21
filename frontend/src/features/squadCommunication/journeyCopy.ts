import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** Scoped copy: follows the app language without changing shared locale registration. */
export function useJourneyCopy() {
    const { i18n } = useTranslation();
    const georgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    return useCallback((english: string, georgianText: string) => georgian ? georgianText : english, [georgian]);
}
